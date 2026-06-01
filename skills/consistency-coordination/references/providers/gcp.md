# Consistency & coordination — GCP

Only the managed pieces that change the generic recipe. For anything not listed,
the generic recipe (self-hosted etcd/ZooKeeper, Cassandra, etc.) is the answer.

## Service mapping
- **Cloud Spanner** — the decision-changing service: a horizontally-sharded SQL
  database offering **external consistency** (the strongest practical guarantee —
  linearizable *and* globally serializable transactions) **across regions**. It
  achieves this with **TrueTime** (GPS + atomic-clock bounded clock uncertainty) plus
  Paxos per shard. Reach for Spanner when you genuinely need global strong
  consistency with SQL and are willing to pay for it; it removes the usual "you can't
  have strong consistency across regions cheaply" constraint — at a real cost.
- **Firestore / Datastore** — strongly consistent reads and queries within a region;
  multi-region modes add availability. Document model, not tunable-per-query like
  Cassandra.
- **Bigtable** — single-cluster strong consistency; replicated/multi-cluster routing
  becomes **eventually consistent** across clusters. Consistent-hashing-style
  range/row-key sharding (mind hot row-key ranges).
- **No managed ZooKeeper/etcd primitive** — GKE runs etcd for Kubernetes' own control
  plane; for app-level coordination, run etcd/ZooKeeper yourself or use Spanner/
  Firestore transactions as the coordination point.

## Limits / things that bite (verify against current docs)
- Spanner's external consistency is **not free**: writes incur a commit-wait tied to
  TrueTime uncertainty and cross-region Paxos round trips — budget the added write
  latency; price scales with node/processing units.
- Bigtable multi-cluster replication is eventually consistent; don't assume a write
  in cluster A is instantly visible in cluster B.
- Firestore has per-document and transaction contention limits (hot documents
  throttle).

## Pitfalls
- Reaching for Spanner when regional strong consistency (Firestore/Cloud SQL) or
  eventual consistency would meet the requirement — paying for global serializability
  no one asked for (YAGNI).
- Assuming Bigtable cross-cluster reads are strongly consistent.
- Ignoring Spanner commit-wait latency in a tight write-path budget.
