# Caching deep-dive

Mechanics that don't belong in the lean SKILL.md. Read when designing the cache
layer in detail.

## Invalidation patterns (the hard part)

"There are only two hard things in CS: cache invalidation and naming things."
Pick the pattern that matches the staleness budget:

- **Invalidate-on-write (delete):** on update, delete the cache key; next read
  repopulates. Simple, but there's a race — a concurrent read can repopulate the
  *old* value between the store write and the delete. Mitigate with delete-after-
  commit ordering, or short TTL as a backstop.
- **Update-on-write (write-through):** keep cache and store in lockstep. No stale
  window, slower writes.
- **TTL expiry:** let entries die after N seconds. Bounds staleness without
  tracking writes. Add **jitter** so keys written together don't expire together
  (mass-expiry stampede).
- **Versioned keys:** embed a version in the key (`user:123:v7`). A write bumps
  the version, so readers naturally fetch a fresh key and old keys age out. Turns
  invalidation into a write, sidestepping delete races. Costs key churn.

For read-your-writes: write-through the writer's own keys, or pin the writer to
read from the store for a short window. → `consistency-coordination`.

## Single-flight (request coalescing)

On a miss for a hot key, only let **one** request recompute/fetch; others wait for
that result. Prevents the thundering herd. Implement with a per-key lock/mutex
(in-process) or a distributed lock (e.g. Redis `SETNX` with a short TTL). Pair
with **probabilistic early refresh**: refresh a key *before* its TTL with a
probability that rises as expiry approaches, so it's renewed by one request
during normal traffic instead of expiring under load.

## Tiered caching (L1 + L2)

- **L1 — local/in-process** (per app instance): nanosecond access, no network
  hop, but small and per-instance (so N copies, weaker consistency).
- **L2 — distributed** (Redis/Memcached): shared across instances, larger, one
  network hop.

Read L1 → L2 → origin. L1 absorbs hot keys (mitigating the hot-key problem) at
the cost of cross-instance staleness. Use short L1 TTLs.

## Sharding a distributed cache

Spreading keys across cache nodes needs a mapping that survives node
add/remove without remapping everything:

- **Modulo hashing** (`hash(key) % N`) remaps almost all keys when N changes →
  mass miss storm. Avoid for elastic fleets.
- **Consistent hashing** moves only `~K/N` keys when a node joins/leaves. The
  standard choice. Use virtual nodes to even out load. Full mechanics in
  `consistency-coordination`.

## Redis vs Memcached (when it matters)

- **Memcached:** multithreaded, pure in-memory key/value, simple, great for
  straightforward string/object caching with high throughput. No persistence, no
  rich types.
- **Redis:** single-threaded core (per shard), rich data structures (sorted sets,
  hashes, streams), optional persistence (RDB/AOF), replication, pub/sub, Lua,
  cluster mode. Choose it when you need more than get/set (rate-limit counters,
  leaderboards via sorted sets, locks, queues).

Rule of thumb: Memcached for a plain LRU object cache at scale; Redis when the
cache also does data-structure work or needs persistence/replication.

## Write-back durability

Write-back buffers writes in the cache and flushes asynchronously. The risk is the
**loss window**: a crash before flush loses recent writes. Bound it with a short
flush interval, a replicated/persistent cache (Redis AOF), or by only using
write-back for data that can be regenerated. Never write-back the system of record
for money or anything requiring durability — that's `consistency-coordination`
and `data-storage` territory.

## Common mistakes

- Caching without measuring the hit rate (a sub-50% hit rate cache is often net
  negative).
- One giant TTL for everything → synchronized mass expiry.
- Deleting on write without ordering → repopulating stale values.
- Treating the cache as durable storage.
- Ignoring the cold-start problem on deploy/restart (warm critical keys).
