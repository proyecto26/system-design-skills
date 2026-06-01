---
name: sharded-counters
description: This skill should be used when the user needs a "sharded counter", "distributed counter", to "count likes / views at scale", handles a "high-write counter" or "hot counter contention", asks about "approximate counting", "real-time counts", or "HyperLogLog". It gives the recipe for absorbing write-heavy counting without a single hot row. Use it whenever one row/key takes concurrent increments faster than it can serialize them, even if the user doesn't say "sharded counter".
---

# Sharded counters

Count a thing that is incremented far faster than a single row, key, or
partition can serialize writes — likes, views, votes, rate tallies, inventory
decrements. The trap is the **hot counter**: every writer contends on one
record, so latency climbs and throughput plateaus no matter how big the box is.
Getting it wrong turns a trivial `+1` into the bottleneck of the whole feature.

## When to reach for this
Concurrent increments to a single logical count exceed what one row/key can
absorb — a viral post's like count, a live-event view counter, a global
rate tally. The symptom is write contention (lock waits, CAS retries, partition
hot-spotting) on one record while the rest of the store is idle. Reaching for
this means the *write* side is the problem, and an exact-to-the-millisecond
total is not required.

## When NOT to
Low write rate (a single atomic `INCR` handles thousands/sec — don't shard a
counter nobody is hammering; YAGNI). Counts that must be transactionally exact
and read-after-write consistent at every instant (bank balances, seat
inventory at sell-out) — that's a transactional decrement, see
`consistency-coordination`, not a fan-out tally. Counting *distinct* items
exactly (unique visitors) where you also need the member list — that's a set in
the store, not a counter. If reads dominate and writes are cheap, you need a
cached aggregate, not sharding.

## Clarify first
- **Write rate to the hottest single count** — peak increments/sec on *one*
  logical counter, not the aggregate (→ `back-of-the-envelope`).
- **Exact or approximate** — is an off-by-a-few total acceptable, and for how
  long may shards disagree (eventual)? Drives shard count and read path.
- **Counting occurrences or distinct items** — a running total vs. unique-count
  (likes vs. unique viewers) decides plain shards vs. HyperLogLog.
- **Read rate and freshness** — how often is the total read, and how stale may
  the served number be (sub-second? minutes?).
- **Time-windowed or lifetime** — "views in the last hour" needs bucketed keys
  and expiry; a lifetime total does not.

## The options
- **Single atomic counter** — one row/key with atomic `INCR`/`UPDATE +1`. Use
  when peak write rate on the hottest count is well within one node's serialized
  write throughput. The default; don't outgrow it prematurely.
- **Write-sharded (striped) counter** — split one logical count into N physical
  shards (`counter:{id}:shard:{0..N-1}`); each write increments a random/hashed
  shard, reads **sum all N**. Use when single-key contention is the bottleneck
  and the total may be eventually consistent.
- **Approximate distinct count (HyperLogLog)** — a fixed-size probabilistic
  sketch (~12 KB) that counts *unique* items with ~2% error. Use for uniques at
  scale where exact membership isn't needed (unique visitors, distinct search
  terms).
- **Time-windowed (bucketed) counters** — key the counter by time bucket
  (`views:{id}:2026-06-01T14`), increment the current bucket, sum recent buckets
  on read, expire old ones. Use for "last N minutes/hours" rate-style counts.
- **Aggregate-on-read + cached total** — sum shards (or roll up) periodically and
  serve the cached number. Use when reads vastly outnumber writes and a slightly
  stale total is fine (pairs with `caching`).

## Trade-offs

| Option | What it solves | What it worsens | Change it when |
|---|---|---|---|
| Single atomic counter | Simplest; exact; read-after-write trivial | One hot record caps write throughput; contention under spikes | Increments on one count exceed one node → shard the writes |
| Write-sharded counter | Spreads write load N-way; removes the hot spot | Reads cost N lookups + sum; total is eventually consistent; pick N up front | Read cost of summing N grows painful → cache the aggregate / roll up |
| HyperLogLog | Counts uniques in fixed tiny memory at huge scale | ~2% error; can't list members or do exact counts | Exact uniques or the member set is required → use a stored set |
| Time-windowed buckets | Cheap rolling/rate counts; old data self-expires | More keys; window boundaries need care; cross-bucket reads sum many keys | You need an exact lifetime total → keep a separate lifetime counter |
| Aggregate-on-read + cache | Cheap reads of a heavy-write count | Served total lags writes by the refresh interval | Reads must be fresh-to-the-write → read shards live (eat the N-sum) |

## Behavior under stress
A counter is a tiny thing that punches above its weight in an outage.

- **Hot-shard skew:** if writes pick shards by `hash(userId)` instead of random,
  one viral actor or a bad hash can still pile onto one shard. *Mitigate:* pick
  the shard at random per write; size N to peak contention, not average.
- **Read amplification on spikes:** when a count goes viral, reads of the total
  multiply the N-shard sum across the read fan-out and can overload the store.
  *Mitigate:* cache the aggregate and refresh on an interval, not per read
  (→ `caching`).
- **Lost increments:** fire-and-forget increments (or a crash before flush in a
  buffered/write-back path) silently undercount. *Mitigate:* use the store's
  atomic increment, accept the eventual-consistency window explicitly, and
  reconcile from a source of truth if exactness later matters.
- **Window-boundary stampede:** time-bucketed counters all roll to a new key at
  the top of the hour — a synchronized cold bucket plus a flood of reads. *Mitigate:*
  pre-create buckets and jitter rollups.
- **Mass expiry:** bucketed counters expiring together can spike the store.
  *Mitigate:* stagger TTLs.

**Monitor:** per-shard write distribution (skew), increments/sec vs. node
ceiling, read-path latency for the N-sum, sketch error budget (HLL), and
under/over-count drift against any source of truth.

## How to apply
1. **Clarify the inputs** — peak increments/sec on the *hottest single count*,
   exact-vs-approximate tolerance, occurrence-vs-distinct, read rate, and
   freshness budget (see *Clarify first*). If no number shows one count is too
   hot, stay on a single atomic counter (YAGNI).
2. **Pick from the trade-off table** — single atomic if it fits one node;
   write-sharded if single-key contention is the wall; HyperLogLog for uniques;
   time-buckets for rolling windows. Combine (e.g. sharded + cached aggregate).
3. **Set the key knobs** — choose N (shard count) from peak contention, the
   shard-selection rule (random, not user-hashed), the read aggregation method,
   bucket granularity + TTL for windows, and the cache refresh interval.
4. **Stress-test the choice** — walk *Behavior under stress*: confirm shard
   skew, read amplification, lost increments, and window boundaries each have a
   mitigation the traffic profile actually needs.
5. **Size it with numbers** — N ≥ peak increments/sec ÷ per-shard write ceiling;
   confirm the N-sum read cost and any HLL error fit the budget
   (→ `back-of-the-envelope`).
6. **Pick a provider** — default to the generic recipe; open a provider file
   only if the user named a cloud (see *Choosing a provider*).

## Dos and don'ts
**Do**
- Start with a single atomic counter; shard only when a number shows one count
  is the bottleneck.
- Pick the write shard at **random** so load spreads evenly regardless of the
  actor.
- Cache the summed aggregate and refresh on an interval when reads dominate.
- Use HyperLogLog for uniques-at-scale and state the ~2% error as a known cost.
- Expire time-bucket keys with staggered TTLs and pre-create the next bucket.
- State the eventual-consistency window out loud — sharding trades exact-now for
  throughput.

**Don't**
- Don't shard a counter that a single `INCR` already handles (premature
  sharding adds read cost for nothing).
- Don't hash the shard by user/entity ID — a hot actor reconcentrates the load.
- Don't sum N shards on every read of a viral count — cache the aggregate.
- Don't use a sharded/eventual counter where the number must be transactionally
  exact (money, sell-out inventory) → `consistency-coordination`.
- Don't reach for HyperLogLog when you also need the member list or an exact
  count.

## Numbers that matter
The deciding figure is **peak increments/sec on the single hottest count** vs. a
node's serialized write ceiling — that ratio sets N. A HyperLogLog sketch is
~12 KB for billions of uniques at ~2% standard error, regardless of cardinality
— the reason it beats a stored set at scale. Reading a sharded total costs N
lookups, so N trades write headroom for read cost. For QPS rates, per-node write
ceilings, and storage sizing, don't restate them here — see `back-of-the-envelope`.

## Interface sketch
A sharded counter is a key contract, not one value:

- **Write:** `INCR counter:{id}:shard:{rand(0..N-1)}` (atomic, fire to one shard).
- **Read:** `sum(GET counter:{id}:shard:{0..N-1})` — or read the cached aggregate
  `count:{id}` refreshed every T seconds.
- **Distinct:** `PFADD uniq:{id} {member}` then `PFCOUNT uniq:{id}` (HLL sketch).
- **Windowed:** `INCR views:{id}:{bucket}` with a TTL; read sums the recent
  buckets.

Decide N, the shard-selection rule, the aggregation/refresh policy, and the
window granularity up front — they are the contract, not implementation details.

## Choosing a provider
Default to the generic recipe above. If the user names a cloud, read
`references/providers/<provider>.md` for the managed-service mapping,
quotas/limits, and provider-specific trade-offs. If no file exists for that
provider, the generic recipe is the answer.

## Diagram
To visualize the fan-out write path (writer → random shard) and the
aggregate-on-read sum (read → N shards → cached total), use the in-plugin
`architecture-diagram` skill — shards share the store color, the read fan-out is
a dashed sum arrow, and the cached aggregate sits in the cache color.

## Related building blocks
- `data-storage` — *depends on* this for where the shards physically live;
  sharding/partitioning theory and key design are *owned* there.
- `caching` — *pairs with* this to serve the cached aggregate so a viral count's
  reads don't re-sum N shards every time.
- `consistency-coordination` — *depends on* this for the exact-vs-eventual count
  decision; transactional/atomic semantics and quorum are *owned* there.
- `back-of-the-envelope` — *feeds into* this: it supplies the per-count write
  rate and per-node ceiling that justify sharding and set N.
- `system-design` — *owned-concept lives in* the orchestrator: the reasoning
  loop, the trade-off method, and the ten failure modes.

## References
- **`references/deep-dive.md`** — shard-count math, random vs. hashed selection,
  HyperLogLog mechanics and error, time-bucket layout, roll-up/aggregation
  patterns, and reconciliation. Read when designing the counter in detail.
- **`references/providers/{generic,aws,azure,gcp}.md`** — service mappings,
  atomicity/contention limits, and pitfalls per environment.
