# Caching — GCP

## Service mapping
- **Memorystore for Redis / Valkey** — managed Redis; Basic tier (single node) and
  Standard tier (replicated with automatic failover); read replicas for read
  scaling; Cluster mode for sharded horizontal scale.
- **Memorystore for Memcached** — managed Memcached; auto-scaled nodes for a
  simple distributed object cache.
- **Cloud CDN** — edge caching for static/media (→ `content-delivery`).

## When to pick which
Redis Standard for HA + failover and data structures; Redis Cluster when one node
isn't enough; Memcached for a plain horizontally-scaled object cache; read
replicas when reads dominate but the dataset fits one shard.

## Limits / things that bite (verify against current docs)
- Basic tier has **no failover and no SLA** — a node restart loses the cache.
- Instances are regional and VPC-attached; cross-region access adds latency.
- Per-instance memory and network throughput caps; a hot key saturates one shard.
- Maintenance windows can cause brief failovers — design for transient
  unavailability.

## Pitfalls
- Using Basic tier in production and being surprised by data loss on maintenance.
- Forgetting Memorystore is regional — multi-region needs your own replication.
- Assuming Memcached tier offers persistence/replication (it doesn't).
