# Data Storage — AWS

## Service mapping → options
- **RDS** (Postgres/MySQL/MariaDB) — managed relational; automated backups,
  read replicas, Multi-AZ failover. The default managed SQL.
- **Aurora** — RDS-compatible (Postgres/MySQL) with a distributed storage layer:
  up to 15 low-lag read replicas, fast failover, storage auto-grows. Pick over
  plain RDS when you need more read scale and quicker failover.
- **DynamoDB** — managed key-value + document; partition key (+ optional sort
  key), single-digit-ms reads, on-demand or provisioned capacity, auto-sharded.
  Maps to key-value / wide-column options.
- **ElastiCache** — managed Redis/Memcached (see `caching`), not a system of
  record.
- **Keyspaces** (managed Cassandra), **Neptune** (graph), **DocumentDB**
  (Mongo-compatible) — use when you specifically need those models.

## Limits / things that bite (verify against current docs)
- **DynamoDB:** item size capped (~400 KB); a single partition has a throughput
  ceiling, so a hot partition key throttles even when total capacity is spare —
  design the PK for even spread. Strongly-consistent reads cost more RCUs and
  only work on the base table, not global secondary indexes (GSIs are eventually
  consistent).
- **RDS/Aurora:** Multi-AZ failover takes seconds to ~a minute; an async read
  replica can lag and lose the tail if promoted. Connection limits scale with
  instance size — front with **RDS Proxy** to survive Lambda/spiky fan-out.
- Cross-AZ data transfer is billable.

## Provider-specific trade-offs
- DynamoDB is serverless and scales effortlessly but locks you into its data
  model and query style (no joins, access patterns must be designed up front);
  migrating off is real work.
- Aurora decouples compute from storage (cheap replicas) but is AWS-only.
- On-demand DynamoDB is convenient but pricier than well-sized provisioned
  capacity at steady high load.

## Pitfalls
- Choosing DynamoDB then fighting it with scan-heavy/ad-hoc queries it isn't built
  for — that's a relational workload.
- Hot partition key throttling while the table looks under-provisioned.
- Skipping RDS Proxy and exhausting connections under serverless fan-out.
- Assuming GSIs are strongly consistent.
