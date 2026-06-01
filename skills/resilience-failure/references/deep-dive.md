# Resilience & failure deep-dive

Mechanics that don't belong in the lean SKILL.md. Read when designing the
resilience layer in detail.

## Timeouts (the foundation)

An unbounded wait is the seed of most cascades: a thread blocked on a slow
dependency is a thread that can't serve anyone else, and pool exhaustion turns
"one slow dependency" into "the whole service is down."

- Set the timeout from the dependency's **measured p99**, not a round number.
  Too tight manufactures failures out of normal tail latency; too loose lets a
  sick dependency hold resources.
- **Budget end-to-end, not per-hop.** If the user-facing SLA is 1 s and a request
  fans out A→B→C, the inner timeouts must sum to less than the outer one, or the
  outer caller times out while inner work keeps running (wasted, and still
  holding resources). Propagate a deadline down the call chain.
- Distinguish **connect** vs **read** timeouts; a connect timeout should be short.

## Retries: backoff, jitter, budgets

Naked immediate retries are the classic outage amplifier — they hit a struggling
dependency hardest exactly when it's weakest, and synchronized retries arrive in
lockstep waves.

- **Exponential backoff:** delay = `base * 2^attempt`, capped at a max. Spreads
  attempts out over time.
- **Jitter** is the part people skip and the part that matters. Without it, all
  clients that failed at the same instant retry at the same instant — a
  synchronized herd. Use *full jitter*: `sleep = random(0, base * 2^attempt)`.
  This decorrelates clients and flattens the retry spike.
- **Retry budget:** cap retries as a fraction of total requests (e.g. retries may
  be at most 10% of traffic). A per-call attempt cap (2–3) isn't enough on its
  own — under a broad outage, even "3 attempts each" across all callers is a 3–4×
  load multiplier. The budget bounds the *aggregate*.
- **Only retry idempotent operations**, or operations carrying an idempotency key
  so the server dedups duplicates. Retrying a non-idempotent write (charge card,
  send message) double-applies the side effect. The key contract is owned by
  `api-design`.
- **Retry only retryable errors:** timeouts, 503, connection resets. Never retry
  a 400/422 (the request is wrong; retrying just wastes capacity).

## Circuit breaker (state machine)

A breaker stops calling a dependency that's clearly failing, so callers fail fast
(freeing threads) and the dependency gets breathing room to recover.

States:
- **Closed** — calls flow normally; the breaker counts failures (rolling window
  or consecutive-failure threshold).
- **Open** — failure threshold tripped; calls are rejected *immediately* (fail
  fast) without touching the dependency, for a cool-down period. This is what
  prevents the retry pile-on against a dead dependency.
- **Half-open** — after the cool-down, admit a *small* number of trial calls. If
  they succeed, close; if they fail, re-open. Half-open is the herd guard: it
  lets a trickle through instead of the full backlog the instant the dependency
  looks alive.

Tuning: a too-sensitive breaker trips on a transient blip and over-sheds; a
too-lax one lets the cascade start before it opens. Track state transitions —
frequent flapping means the thresholds or half-open probe rate need tuning.
Combine with a fallback: when the breaker is open, serve the degraded response.

## Bulkheads

Named after a ship's watertight compartments: partition resources so a flood in
one section doesn't sink the vessel. Give each downstream dependency its **own**
thread pool / connection pool / concurrency limit. Then a dependency that goes
slow can only exhaust *its* pool — calls to healthy dependencies keep flowing.
The cost is lower peak utilization (you can't share the slack) and more pools to
size. Size each pool to that dependency's concurrency × latency, with headroom.

## Graceful degradation patterns

Pick the fallback per feature; the goal is a useful answer, not a perfect one:
- **Stale cache:** serve the last-known-good value (mark it stale — see the
  response contract in SKILL.md). Best when slightly old data is fine.
- **Default / static value:** a sensible constant (e.g. "trending" list when the
  personalized recommender is down).
- **Partial result:** return what succeeded, omit what failed, tell the client.
- **Hide the feature:** drop the non-essential widget rather than fail the page.
- **Fail closed (deliberately):** for money/auth/safety, an error is correct —
  never serve a degraded *wrong* answer where correctness is the point.

Degradation must be tested like any other path; untested fallbacks fail when
finally exercised, in the middle of the incident.

## Rate-limiting algorithms

The job: count work per key (user / IP / API key / tenant / global) and reject or
shape what exceeds the limit. Counters live in a fast shared store (e.g. Redis
`INCR`/`EXPIRE`), not a disk DB.

- **Token bucket** — a bucket of capacity `B` refills at `R` tokens/sec; each
  request spends one; empty ⇒ reject. **Allows bursts** up to `B` then settles to
  `R`. Memory-efficient, the common default (Amazon, Stripe). Two knobs (size,
  rate) can be fiddly to tune.
- **Leaky bucket** — a FIFO queue drained at a fixed rate; full ⇒ drop. Produces a
  **smooth, constant outflow** (good when a downstream needs steady input), but a
  burst fills the queue with old requests and delays fresh ones.
- **Fixed window counter** — one counter per clock window (per minute); simple and
  cheap, but a burst straddling the window boundary can admit up to **2×** the
  limit.
- **Sliding window log** — store a timestamp per request, count those inside the
  rolling window. **Exact**, but memory-heavy (stores rejected requests too).
- **Sliding window counter** — weight the previous window's count by the overlap
  fraction. Smooths the boundary spike of fixed-window at a fraction of the log's
  memory; an approximation (Cloudflare reports ~0.003% error). Good default for
  distributed limiting.

**Distributed rate limiting** has two hazards:
- **Race condition:** read-then-increment from concurrent requests under-counts.
  Fix with an atomic op — a Redis Lua script or sorted-set operation — not a
  read-modify-write with a lock (locks kill throughput).
- **Synchronization:** with multiple limiter nodes, a centralized store (Redis)
  beats sticky sessions, which don't rebalance. For multi-region, sync counters
  eventually-consistent and accept slight over-admission, or shard limits per
  region.

**Hard vs soft:** hard limiting never exceeds the threshold; soft tolerates brief
overage. **On reject:** return `429` with `Retry-After`; optionally enqueue the
work for later instead of dropping it (e.g. non-urgent jobs).

## SPOF analysis and failover

Walk every component and ask: *if this single box vanishes, does the system
stop?* Each "yes" is a SPOF to remove with redundancy.

- **Active-passive (failover):** one node serves; a standby takes over on
  heartbeat loss. Cold standby = slower recovery; hot standby = faster, costlier.
  Risk: writes not yet replicated to the standby are **lost** on promotion.
- **Active-active:** all nodes serve and share load; losing one sheds its share.
  Needs the routing layer (DNS/LB) or app to know all nodes, and conflict handling
  if both accept writes.
- **Multi-region:** survives a whole-datacenter loss; geo-route normally, redirect
  all traffic to a healthy region on outage. Cross-region replication is
  asynchronous, so failover trades some recent writes for availability.

The **consistency** consequences of any failover (what's lost, quorum behavior
under a partition, single-writer guarantees) are owned by
`consistency-coordination` — decide *consistency-first* (reject writes without
quorum) vs *availability-first* (accept locally, reconcile later) there.

## Common mistakes

- Retries with no jitter, no budget, no idempotency — the textbook amplifier.
- No timeout, or a timeout looser than the caller's own deadline.
- A circuit breaker with no fallback — you fail fast into an error instead of a
  degraded answer.
- One shared thread pool for all dependencies (no bulkhead) — one slow one takes
  everything.
- Treating the rate-limiter store as infallible — decide fail-open vs fail-closed.
- Untested degradation paths that only run during the incident they were meant to
  survive.
