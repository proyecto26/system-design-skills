# Data Storage — Azure

## Service mapping → options
- **Azure SQL Database** — managed relational (SQL Server engine); auto-backups,
  read replicas, geo-replication, elastic pools. The default managed SQL.
  **Azure Database for PostgreSQL/MySQL** when you need those engines.
- **Cosmos DB** — globally distributed multi-model: key-value, document
  (Mongo API), wide-column (Cassandra API), graph (Gremlin). Maps to all the
  NoSQL options; auto-sharded by a **partition key**, single-digit-ms reads.
- **Azure Cache for Redis** — managed Redis (see `caching`), not a system of
  record.

## Limits / things that bite (verify against current docs)
- **Cosmos DB:** throughput is provisioned in **RUs** (request units); a single
  **logical partition** has a size cap (~20 GB) and a per-partition RU ceiling, so
  a bad partition key creates hot partitions that throttle. Choose a
  high-cardinality, evenly-accessed partition key — it can't be changed later
  without a data migration.
- Cosmos offers **five consistency levels** (strong → eventual); stronger levels
  cost more RUs and add cross-region latency. This is a knob the generic model
  doesn't have — pick deliberately (consistency theory → `consistency-coordination`).
- **Azure SQL** has DTU/vCore service tiers that cap CPU/IO/connections; hitting
  the tier ceiling throttles. Connection limits scale with tier.

## Provider-specific trade-offs
- Cosmos DB's turnkey multi-region writes are powerful but expensive and
  Azure-specific (lock-in); the multi-region consistency choice is yours to own.
- Azure SQL hides patching/HA but the API-compatibility layer (e.g. Mongo/Cassandra
  on Cosmos) is not 100% — verify the features you depend on.

## Pitfalls
- Under-provisioning RUs → throttling (429s) under load; or over-provisioning →
  large bills.
- Choosing a low-cardinality Cosmos partition key and hitting the 20 GB / hot-
  partition wall.
- Defaulting Cosmos to **strong** consistency everywhere and paying latency/RU
  cost where eventual would do.
