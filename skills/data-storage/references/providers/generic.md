# Data Storage — Generic (self-hosted / open-source)

The default answer when no cloud is named. These are the engines the SKILL.md
options map to, self-hosted or run anywhere.

## Engine mapping → options
- **Relational/SQL** → **PostgreSQL** (rich types, JSONB, materialized views,
  strong default) or **MySQL/MariaDB** (huge ecosystem, simple replication).
- **Document** → **MongoDB** (flexible schema, secondary indexes, multi-doc
  transactions in recent versions).
- **Key-value** → **Redis** (in-memory, rich structures; also a cache — see
  `caching`) or **Riak** (durable, distributed).
- **Wide-column** → **Cassandra** (leaderless, write-heavy, tunable consistency)
  or **HBase** (Hadoop ecosystem).
- **Graph** → **Neo4j**.
- **Connection pooler** → **PgBouncer** (Postgres), **ProxySQL** (MySQL).

## Limits / things that bite (verify against current docs)
- A single relational node's practical ceiling is roughly **~1k QPS** and low-TB
  datasets before replicas/sharding (→ `back-of-the-envelope`); exact numbers
  depend on schema, indexes, and query mix.
- Postgres connections are processes — the default `max_connections` is low
  (often ~100); exceed it and new connections error. Pool with PgBouncer.
- MySQL async replication can lag and lose the un-replicated tail on failover;
  enable semi-sync if you can't afford that loss.
- Cassandra: consistency is tunable per query (`ONE`/`QUORUM`/`ALL`) — picking
  `ONE` for both read and write gives no read-your-writes guarantee.

## Trade-offs specific to self-hosting
- You own failover, backups, replica promotion, and resharding — no managed
  automation. Cheaper and portable (no lock-in), but operationally heavy.
- Sharding is mostly manual (app-level routing or a layer like Vitess/Citus);
  managed clouds hide more of this.

## Pitfalls
- Defaulting to NoSQL for "scale" when one Postgres node would serve the load.
- Running without a connection pooler and hitting `max_connections` under spike.
- Treating self-managed async replicas as strongly consistent.
- No tested failover/restore runbook — replication is not a backup.
