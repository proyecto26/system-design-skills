# Sharded counters — GCP

Only the contention/atomicity differences that change the recipe. Default to the
generic recipe; this maps it to GCP services.

## Service mapping
- **Firestore distributed counter** — Google's documented pattern is *exactly*
  write-sharding: split a counter into N sub-documents, increment a random shard
  in a transaction, sum the shards on read. Firestore caps sustained writes to a
  single document (~1/sec), so sharding is mandatory above trivial rates.
- **Bigtable counter** — atomic increment on a cell (`ReadModifyWrite`). Distribute
  load by designing the **row key** to avoid hot-spotting (salt/field-promote the
  key); a sequential or single hot row key serializes on one tablet.
- **Spanner** — transactional `UPDATE … SET c = c + 1`; exact and strongly
  consistent, but a single hot row contends on locks — shard the row (N rows
  summed) for write-heavy counts.
- **Memorystore for Redis / Valkey** — managed Redis for the fast path: `INCR`,
  HyperLogLog, key sharding. Use for microsecond tallies and HLL uniques.

## When to pick which
Firestore distributed counter for app-level counts that must be durable (use the
built-in shard pattern); Bigtable when increments are huge-scale and you control
the row-key design; Spanner when the count must be transactionally exact (shard
the row only if writes are hot); Memorystore Redis for ephemeral fast tallies.

## Limits / things that bite (verify against current docs)
- Firestore: ~**1 write/sec sustained per document** — a single counter doc hits
  this fast; the N-shard read sums all sub-docs.
- Bigtable: a hot row key concentrates on one tablet; throughput is per-tablet, so
  row-key design (salting) is the real contention lever.
- Spanner: a single hot row serializes on locks; cross-row reads to sum shards add
  latency but stay strongly consistent.
- Memorystore Basic tier has no failover/SLA — a restart loses the cache;
  instances are regional and VPC-attached.

## Pitfalls
- Incrementing one Firestore document at high rate and hitting the per-document
  write limit — use the distributed-counter shard pattern.
- A monotonic/sequential Bigtable row key creating a tablet hot spot — salt or
  field-promote the key.
- Assuming Spanner's strong consistency removes contention — a hot row still
  serializes; shard it for write-heavy counts.
- Lock-in: Firestore's shard pattern and Bigtable row-key design don't port
  directly to other clouds.
