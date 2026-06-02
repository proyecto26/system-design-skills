---
name: back-of-the-envelope
description: This skill should be used when the user needs to "estimate QPS", "back-of-the-envelope" (BOTEC) numbers, "how much storage / bandwidth", "how many servers", "peak load", "capacity planning", or wants the standard latency / throughput / availability numbers to ground a design (latency table, QPS rates, powers of two, nines). Use it whenever a design decision hinges on scale — convert any "high traffic" / "huge data" phrase into concrete numbers before choosing components, even if the user doesn't say "estimate".
---

# Back-of-the-Envelope Estimation (BOTEC)

Turn vague scale ("high traffic", "huge data") into a few concrete numbers that
*decide the design*. BOTECs are quick, approximate calculations — feasibility
checks, not precision. The point is the process and directional correctness:
they tell you when a single database won't do, when caching is forced, when a
write spike needs a queue.

> A design for 1k QPS and one for 1M QPS are different systems. 10 GB fits in
> RAM; 10 TB needs distributed storage. Estimate first, choose second.

## When to reach for this
At step 2 of any design (right after requirements), and any time a choice depends
on scale: sizing the read vs write path, deciding sharding vs a single node,
justifying a cache, or sanity-checking a proposed component against load.

## When NOT to
Don't chase precision or model every microservice — that's the opposite of the
technique. Don't estimate what won't change a decision (YAGNI). Round
aggressively: "99,987 / 9.1" is "100,000 / 10". Always **label units** and
**write assumptions down**.

## Clarify first
Estimates are only as good as their inputs. Pin down:
- **DAU/MAU** and what fraction is active daily.
- **Actions per user per day** (posts, reads, messages…).
- **Read:write ratio** — which path dominates.
- **Object sizes** — per record and per media blob.
- **Retention** — how long data is kept (drives total storage).
- **Peak factor** — peak is typically ~2× average; spikier for some workloads.

## The core estimations (recipes)
Work each as a single multiply/divide chain. Full worked numbers and the CPU-time
derivation are in `references/estimation-recipes.md`.

- **QPS** = `DAU × actions_per_user_per_day ÷ 86,400`. **Peak QPS ≈ 2 × QPS**
  (state your peak factor).
- **Storage/day** = `writes_per_day × avg_object_size`. **Total** =
  `storage/day × retention_days` (watch base-10 vs base-2; storage is sold base-10).
- **Bandwidth** = `QPS × payload_size` (separate read and write; egress usually
  dominates and costs money).
- **Number of servers** = `peak_QPS ÷ per_server_QPS`. Use the per-server rates
  below as the divisor.
- **Concurrent connections / memory** = `concurrent_users × per_connection_cost`;
  check the working set fits RAM (else it's an IO-bound, disk-backed design).

## Numbers that matter
These are the reference points to *know*, so you can estimate without lookups.
Full tables (latency, server specs, request types, powers of two, nines) live in
`references/numbers-to-remember.md` — load it when you need a specific figure.

The two that drive most decisions:

| What | Rule of thumb |
|---|---|
| Single SQL/RDBMS node | ~**1,000** QPS |
| Key-value store node | ~**10,000** QPS |
| Cache server (Redis/Memcached) | ~**100,000–1M** QPS |
| One modern CPU core | ~**1,000** simple requests/s → a 64-core box ≈ **64k** req/s |
| Read 1 MB: memory vs SSD vs disk | ~**μs vs tens–hundreds of μs vs ms** (memory ≫ SSD ≫ disk) |

**Think in orders of magnitude, not exact values.** CPU-bound work is ~1×,
memory-bound ~10×, IO-bound ~100× the time. That ratio, not the decimals, is what
shifts an architecture.

## Dos and don'ts
Distilled from the recipes and the ways estimates mislead.

**Do**
- **Do round to one significant figure** and reason in orders of magnitude — the
  ratio (1× / 10× / 100×) is what shifts an architecture, not the decimals.
- **Do size on peak, not average.** State the peak multiplier (≈2× is a common
  default; spikier for bursty workloads) before picking capacity.
- **Do estimate reads and writes separately** — a 95% read ratio and a write
  spike pull the design in opposite directions.
- **Do label units and write assumptions down**, so a "GB" isn't ambiguous and
  the chain can be re-checked when an input changes.

**Don't**
- **Don't carry false precision.** Decimals imply a confidence the inputs don't
  support; "99,987" is "100,000".
- **Don't trust per-server rates as universal.** "1k QPS for SQL" is a
  point-query rule of thumb; range scans, joins, and fat payloads can be 10×
  worse — use it for the order of magnitude, then validate with real benchmarks.
- **Don't conflate base-2 and base-10.** RAM is base-2; storage/network marketing
  is base-10 — close enough for an estimate, but only if the units are stated.
- **Don't compute what won't change the decision.** If a number doesn't move the
  architecture, skip it (YAGNI).

## Diagram
Estimation is usually a table, not a picture — keep the numbers and assumptions
inline. When a derived number forces a structural change (e.g. "300k QPS > single
DB → shard / add replicas"), that belongs in the architecture diagram itself; use
the `architecture-diagram` skill when drawing the design those numbers justify.

## Related building blocks
- `requirements-scoping` — *depends on* it for the inputs (DAU, action rates, ratios, SLAs) this skill turns into numbers.
- `data-storage` — *feeds into* it: the storage totals and shard counts computed here drive its SQL/NoSQL and partitioning choices.
- `caching` — *feeds into* it: a high read ratio or hot working set sized here is the case *for* a cache.
- `scaling-evolution` — *feeds into* it: when an estimate crosses a per-node ceiling, that ceiling is the next bottleneck to plan around.
- `system-design` — *owned-concept lives here for the reasoning loop*; this is the orchestrator that calls this skill at step 2.

## References
- **`references/numbers-to-remember.md`** — the cheat sheet: latency table, typical server spec, per-server QPS rates, CPU/memory/IO-bound request types, powers of two, availability nines. Read when you need a specific figure.
- **`references/estimation-recipes.md`** — worked examples (Twitter-scale QPS + storage, the 64-core→64k req/s CPU-time derivation, bandwidth and server-count sizing). Read to see a full chain end to end.

## Scripts
For a deterministic check of a sizing chain (the one place exact arithmetic earns
its keep), run the calculator rather than doing it by hand:
- **`scripts/botec.py`** — `python3 scripts/botec.py --dau 150e6 --actions 2 --peak 2 --obj-bytes 1e6 --media-frac 0.10 --retention-days 1825 --server-qps 1000 --json` → QPS, peak, storage/day & total, bandwidth, server count. Per-server-QPS defaults mirror the rules of thumb above (override with `--server-qps`).
- **`scripts/test_botec.py`** — asserts the calculator matches `expected_outputs/twitter_scale.json` (the worked Twitter example), so the prose recipe and the math can't drift.
