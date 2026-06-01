# Sharded counters — generic (vendor-neutral)

The default answer when no cloud is named. Self-hosted / open-source primitives.

## Service mapping (generic recipe → tools)
- **Single atomic counter** → Redis `INCR`/`INCRBY`; SQL `UPDATE … SET c = c + 1`
  (one row); any store with an atomic increment.
- **Write-sharded counter** → N Redis keys `counter:{id}:shard:{i}`, increment a
  random shard, sum on read (`MGET` the N shards). In SQL, N rows keyed by
  `(id, shard)` with `SELECT SUM(c) … GROUP BY id`.
- **Approximate distinct (uniques)** → Redis HyperLogLog (`PFADD` / `PFCOUNT` /
  `PFMERGE`) — ~12 KB per sketch, ~2% error, mergeable across shards/windows.
- **Time-windowed** → Redis keys per time bucket with `EXPIRE`, or a wide-column
  store (Cassandra) with a counter column per `(id, bucket)`.
- **Eventual aggregate at very high write scale** → Cassandra **counter columns**
  (the cluster handles distribution; counters are eventually consistent and
  non-idempotent on retry — see pitfalls).

## When to pick which
- Redis for the hot path: atomic ops, HLL built in, microsecond increments,
  trivial key sharding. The common choice for likes/views/rate tallies.
- SQL single-row counter only at low write rates; shard to N rows when the row
  lock is the wall.
- Cassandra counters when writes are distributed-scale and eventual consistency
  is acceptable; avoid where retries must not double-count.

## Limits / things that bite (verify against current docs)
- A single Redis instance is **single-threaded** for command execution — one hot
  key is capped by one core's op rate; sharding the *key* (not just the cluster)
  is what removes the hot spot.
- Redis Cluster shards by hash slot: `counter:{id}:shard:{i}` keys spread across
  the cluster only if the slots differ — don't wrap the whole key in a hash tag.
- Redis HLL: ~12 KB max per key, ~0.81%/√m (~2%) standard error; `PFCOUNT` on a
  union of large sketches is comparatively expensive — cache it.
- Cassandra counter columns are **not idempotent**: a timed-out write that is
  retried may apply twice (over-count). They can't be part of a row with
  non-counter columns, and deletes-then-reuse is unsafe.
- SQL single-row counters serialize on a row lock; contention shows as lock waits
  and deadlocks long before the box is CPU-bound.

## Pitfalls
- Treating a Redis counter as durable without AOF/replication — a crash drops
  recent increments.
- Choosing N once for the average and getting crushed when one count goes viral
  — size N to peak on the hottest count.
- Summing shards on every read instead of caching the aggregate.
- Using Cassandra counters where exactness matters (retry double-count).
