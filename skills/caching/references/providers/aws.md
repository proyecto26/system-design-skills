# Caching — AWS

## Service mapping
- **ElastiCache for Redis / Valkey** — managed Redis; replication, automatic
  failover (Multi-AZ), cluster mode (sharding), backups. The default managed cache.
- **ElastiCache for Memcached** — managed Memcached; multithreaded, simple,
  node-based scaling; no persistence/replication.
- **ElastiCache Serverless** — auto-scaling capacity, pay-per-use; removes node
  sizing at a price premium.
- **DAX** — DynamoDB Accelerator; an in-line write-through cache *specifically*
  for DynamoDB (microsecond reads) — use only when the origin is DynamoDB.
- **CloudFront** — edge caching for static/media (→ `content-delivery`).

## When to pick which
Redis for replication/persistence/data structures and Multi-AZ failover;
Memcached for a plain horizontally-scaled object cache; DAX only with DynamoDB;
Serverless when load is spiky and you don't want to size nodes.

## Limits / things that bite (verify against current docs)
- Multi-AZ failover takes seconds and can drop un-replicated writes.
- Cluster mode shards by hash slot; cross-slot multi-key ops need hash tags.
- Node memory and network bandwidth are per instance type — a hot key still
  saturates one shard.
- ElastiCache lives in your VPC; cross-AZ data transfer is billable.

## Pitfalls
- Reaching for DAX when the origin isn't DynamoDB (it isn't a general cache).
- Forgetting `maxmemory-policy` / eviction config carries over from Redis.
- Assuming Serverless is cheaper at steady high load — it usually isn't.
- Lock-in: DAX and ElastiCache configs don't port directly to other clouds.
