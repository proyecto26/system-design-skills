# Caching — generic / self-hosted

The vendor-neutral default. When no cloud is named, this is the answer.

## What to run
- **Memcached** — multithreaded LRU object cache; simplest, highest raw
  throughput for get/set. No persistence, no replication, no rich types.
- **Redis** (open source / Valkey) — single-threaded core, rich data structures,
  optional persistence (RDB/AOF), replication, and **Redis Cluster** for
  horizontal sharding via hash slots (16,384 slots, consistent-hash-like).

## Topology
- Single node for small hot sets.
- Primary + replicas for read scaling and failover (replica promotion on primary
  loss; expect a brief unavailability + possible loss of un-replicated writes).
- Cluster mode (sharded) when the hot set or QPS exceeds one node. Client or proxy
  routes keys to shards by hash slot.

## Limits / things that bite
- A node is bounded by RAM (the hot set must fit) and by a single core for
  Redis command execution — a hot key can saturate one shard regardless of total
  cluster size. Mitigate with an L1 tier or key replication (see deep-dive).
- Persistence (AOF fsync) trades durability for write latency; RDB snapshots can
  cause fork/latency spikes on large datasets.
- Eviction is configured per instance (`maxmemory-policy`: `allkeys-lru`,
  `volatile-ttl`, etc.) — set it deliberately; the default may reject writes when
  full.

## Pitfalls
- No managed failover — you operate Sentinel/Cluster yourself.
- Cluster mode restricts multi-key ops to a single slot (hash tags needed).
- Backups/persistence and security (TLS, auth) are on you.

Operationally heavier than a managed service, but zero lock-in and full control.
Use when running your own infra or for portability across clouds.
