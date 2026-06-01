# Data Storage — GCP

## Service mapping → options
- **Cloud SQL** (Postgres/MySQL/SQL Server) — managed relational; backups, read
  replicas, HA failover. The default managed SQL for single-region scale.
- **Spanner** — horizontally-scalable relational: SQL + ACID transactions
  *across shards* and regions, with strong (external) consistency. The rare store
  that scales writes without giving up joins/transactions — at premium cost.
- **Bigtable** — wide-column (the original Bigtable); huge write throughput,
  sorted row keys for range scans. Maps to the wide-column option.
- **Firestore** — managed document store with real-time sync; maps to the
  document option for app/mobile data.
- **Memorystore** — managed Redis/Memcached (see `caching`), not a system of
  record.

## Limits / things that bite (verify against current docs)
- **Bigtable:** performance hinges on **row-key design** — monotonically
  increasing keys (timestamps, sequential IDs) hot-spot one node ("hotspotting");
  use a salted/field-promoted key for even spread. No secondary indexes and no
  joins — design the row key around your queries.
- **Spanner:** avoid monotonic primary keys for the same hot-spotting reason;
  capacity is provisioned in **nodes/processing units** and strong cross-region
  consistency adds commit latency. Powerful but the most expensive option.
- **Cloud SQL:** vertical scale and connection limits are bounded by instance
  size; read replicas are async and can lag.

## Provider-specific trade-offs
- Spanner removes the classic "shard and lose transactions" trade-off but is
  GCP-only and priced for it — justify with a real cross-shard-transaction need.
- Bigtable/Firestore lock you into their data and query models; migrating off is
  real work.

## Pitfalls
- Monotonic row/primary keys in Bigtable or Spanner → hotspotting one node while
  the cluster looks idle.
- Reaching for Spanner when a single Cloud SQL node (or replicas) would serve the
  load — paying for scale you don't need (YAGNI).
- Expecting Bigtable to do ad-hoc queries or joins — it's query-pattern-first.
