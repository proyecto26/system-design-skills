# Sharded counters deep-dive

Mechanics that don't belong in the lean SKILL.md. Read when designing the
counter in detail.

## Why one counter goes hot

A single logical count is one row/key. Every increment must serialize against
every other — a row lock (SQL `UPDATE … SET c = c + 1`), a compare-and-swap
retry loop, or a single-threaded shard handling one atomic op at a time. Under
contention, writers queue: throughput plateaus at the *serialization* rate of
that one record, and added concurrency only deepens the queue (latency climbs,
CAS retries multiply). Scaling the box up doesn't help — the limit is one
record's write path, not the machine.

## Write-sharded (striped) counter

Split the logical count into N physical sub-counters and **sum on read**:

```
write:  shard = rand(0, N-1);  INCR counter:{id}:shard:{shard}
read:   total = sum(GET counter:{id}:shard:{i} for i in 0..N-1)
```

- **Pick the shard at random per write**, not by `hash(actorId)`. Hashing by the
  actor reconcentrates load when one actor (a celebrity, a bot, a retry storm) is
  responsible for the spike — the exact case sharding exists to fix. Random
  spreads evenly regardless of who writes.
- **Choosing N:** `N ≥ ceil(peak_increments_per_sec / per_shard_write_ceiling)`,
  then round up for headroom and skew. Bigger N spreads writes better but makes
  every read sum more keys. N is a knob between write headroom and read cost;
  pick it from the *peak on the hottest single count*, not the average across all
  counters.
- **Eventual consistency:** a read may catch some shards mid-increment, so the
  total can lag the true value by the in-flight writes. This is the core trade:
  throughput for exact-now. State the window; if it's unacceptable, you don't
  want a sharded counter (→ `consistency-coordination`).

## Aggregation on read and roll-up

Summing N shards per read is fine at low read rates. When reads dominate or the
count goes viral:

- **Cached aggregate:** a background job (or a periodic task) sums the shards and
  writes `count:{id}`; reads serve that. Refresh interval = freshness budget.
  Pairs with `caching`.
- **Two-tier roll-up:** shards → periodic roll-up into a durable lifetime total
  (e.g. flush hourly buckets into a `total` column). Keeps the hot path in fast
  storage and the source-of-truth total in durable storage.
- **Read-time vs. write-time aggregation:** aggregate on read when writes are the
  hot path (most counters); aggregate on write (maintain a materialized total)
  only when reads are hotter than writes and you can afford the write coupling.

## HyperLogLog (approximate distinct count)

Counting *unique* items (unique visitors, distinct terms) exactly needs storing
every member — memory grows with cardinality. HyperLogLog is a probabilistic
sketch that estimates cardinality in **fixed** memory:

- Hash each member; use the leading bits to pick one of `m` registers, and record
  the position of the leftmost 1-bit in the rest. Cardinality is estimated from
  the harmonic mean of register values (a long run of leading zeros implies many
  distinct items were seen).
- **~12 KB** holds the standard `m = 16384` registers and estimates up to
  billions of uniques at **~0.81% / √m ≈ 2%** standard error — independent of how
  large the true count is.
- **Mergeable:** sketches union losslessly (take the max per register), so
  per-shard or per-window sketches combine into a global unique count. This is
  what makes HLL scale across nodes and time buckets.
- **Limits:** you cannot list members, remove a member, or get an exact count.
  If any of those is required, use a stored set (and accept the memory cost) or a
  different structure.

## Time-windowed (bucketed) counters

For "views in the last hour / 5 minutes":

```
write:  bucket = floor(now / granularity);  INCR views:{id}:{bucket}  (+ TTL)
read:   sum the buckets covering the window
```

- **Granularity** trades resolution for key count: 1-minute buckets give a tight
  sliding window but more keys to sum; 1-hour buckets are cheap but coarse.
- **TTL** each bucket to just beyond the longest window read, so old data
  self-expires — no cleanup job.
- **Stagger TTLs / pre-create buckets** so an entire counter's buckets don't
  expire or cold-start at the same instant (window-boundary stampede). HLL
  sketches can be bucketed the same way for windowed unique counts.

## Reconciliation and durability

Increments to an in-memory store (e.g. Redis) are fast but not durable by
default; a crash can lose recent increments. Options:

- Enable persistence (AOF) and/or replication for the counter store.
- Treat the fast counter as a *cache* of a durable source of truth (events in a
  log/DB) and reconcile periodically — exact when it matters, fast on the hot
  path. The event log is owned by `messaging-streaming` / `data-storage`.
- For money or inventory, do **not** use an eventual sharded counter — use a
  transactional decrement with the right isolation (→ `consistency-coordination`).

## Common mistakes

- Sharding a counter a single `INCR` already handled (read cost for no gain).
- Hashing the shard by actor ID, so a hot actor lands on one shard anyway.
- Summing N shards on every read of a viral count instead of caching the total.
- One TTL for all buckets → synchronized mass expiry.
- Using HLL where the member list or an exact count is later required.
- Assuming the in-memory counter is durable without persistence/reconciliation.
