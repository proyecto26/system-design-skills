---
name: caching
description: This skill should be used when the user asks about a "caching strategy", "cache invalidation", "what to cache", "read-through vs write-through vs write-back", "cache eviction" (LRU/LFU/TTL), "Redis vs Memcached", "stale reads", or hits "thundering herd", "cache stampede", "cache penetration", or "hot key" problems. Use it whenever a design is read-heavy or a datastore is overloaded by reads, even if the user doesn't say "cache".
---

# Caching

Put a copy of hot data closer to the reader so most requests skip the slow path.
Caching is the highest-leverage move for read-heavy systems — and the easiest to
get subtly wrong, because a cache adds a second source of truth that can serve
stale or wrong data, and can *amplify* an outage when it misbehaves.

## When to reach for this
Reads dominate (a high read:write ratio from `back-of-the-envelope`); the same
data is read repeatedly; the datastore is the read bottleneck; or recomputation
is expensive. A cache buys read latency and offloads the origin.

## When NOT to
Write-heavy or read-once data (low hit rate — pure overhead). Data that must be
exactly current with zero staleness (a cache is a stale copy by nature; when
strict freshness is required, go to the source or use `consistency-coordination`). Don't
add a cache before a number shows reads are the problem (YAGNI) — it's a new
failure mode and a second thing to operate.

## Clarify first
- **Read:write ratio and hit rate** — is the working set cacheable? (→ `back-of-the-envelope`, 80/20.)
- **Staleness tolerance** — seconds? minutes? must reads see their own writes?
- **Working-set size** — does the hot set fit in RAM across cache nodes?
- **Consistency on write** — can the cache briefly disagree with the store?
- **Eviction trigger** — what's the access pattern (recency? frequency? time-bound?).

## The options

**Where to cache** (often layered): client/browser → CDN edge (→ `content-delivery`)
→ application/in-process → distributed cache (Redis/Memcached) → database buffer
pool. This skill focuses on the application and distributed layers.

**Read strategy**
- **Cache-aside (lazy):** app checks cache, on miss reads the store and populates.
  Use when reads are unpredictable; the default for most systems.
- **Read-through:** the cache library fetches from the store on miss. Use to keep
  app code simple and caching policy centralized.

**Write strategy**
- **Write-through:** write cache and store synchronously. Use when reads right
  after writes must be fresh and slower writes are acceptable.
- **Write-back (write-behind):** write cache now, flush to store async. Use for
  write-heavy/bursty paths that tolerate a small loss window.
- **Write-around:** write only the store; let the cache fill on read. Use when
  written data is rarely re-read soon (avoids cache churn).

**Eviction policy**
- **LRU** for recency-skewed access (most common); **LFU** for stable popularity;
  **TTL** to bound staleness; **FIFO** rarely. Match the policy to the pattern.

## Trade-offs

| Option | What it solves | What it worsens | Change it when |
|---|---|---|---|
| Cache-aside | Simple, resilient (cache down ⇒ just slower) | First read per key is a miss; risk of stale after writes | Misses are too costly → read-through + warming |
| Read-through | Centralized, clean app code | Couples app to cache lib; cold-start misses | Custom per-key load logic is needed |
| Write-through | Fresh reads after write | Slower writes; writes cached data that may never be read | Writes dominate and aren't re-read → write-around/back |
| Write-back | Fast, absorbs write bursts | Data loss window on crash; complex | Durability of recent writes is required |
| Write-around | No churn from write-only data | Recently written keys miss on first read | That data IS read right after write → write-through |
| TTL eviction | Bounds staleness automatically | Mass expiry can stampede the origin | Add jitter / soft-TTL refresh |

## Behavior under stress
A cache that misbehaves doesn't just stop helping — it can take down the origin.

- **Thundering herd / stampede:** a hot key expires (or the cache restarts) and
  thousands of concurrent misses hit the store at once. *Mitigate:* per-key locks
  / request coalescing (single-flight), early/probabilistic refresh, TTL jitter.
- **Cache penetration:** requests for keys that don't exist bypass the cache every
  time (often malicious). *Mitigate:* cache the negative result (short TTL), or a
  Bloom filter in front.
- **Hot key:** one key (a celebrity, a viral item) exceeds a single node's
  throughput. *Mitigate:* replicate the key across nodes, add a local/L1 tier, or
  shard the value.
- **Eviction storm / cold cache:** after a flush or deploy, hit rate craters and
  the origin sees full load. *Mitigate:* warm critical keys; ramp traffic.
- **Stale-after-write:** the store changed but the cache didn't. *Mitigate:*
  invalidate on write, or write-through, or short TTL — pick per staleness budget.

**Monitor:** hit rate, p99 latency, eviction rate, key distribution (hot spots),
and origin QPS during cache restarts.

## How to apply
1. **Clarify the inputs** — confirm the read:write ratio, staleness budget, and
   hot-set size (see *Clarify first*). If no number yet shows reads are the
   bottleneck, stop — a cache is not needed yet (→ `back-of-the-envelope`).
2. **Pick the strategies from the trade-off table** — choose a read strategy
   (cache-aside is the default), a write strategy keyed to the staleness budget,
   and an eviction policy matched to the access pattern.
3. **Set the key knobs** — define the key naming scheme, TTL (with jitter), and the
   per-key-family invalidation event. Decide negative-caching and single-flight up
   front, not after the first incident.
4. **Stress-test the choice** — walk each failure in *Behavior under stress*
   (stampede, penetration, hot key, cold cache, stale-after-write) and confirm a
   mitigation is in place for the ones the traffic profile can trigger.
5. **Size it with numbers** — fit the hot set in RAM across nodes, sanity-check the
   target hit rate (90%+), and confirm the node count covers peak QPS (→ *Numbers
   that matter*).
6. **Pick a provider** — default to the generic recipe; only open a provider file
   if the user named a cloud (see *Choosing a provider*).

## Dos and don'ts
**Do**
- Default to cache-aside; it stays correct (just slower) when the cache is down.
- Set a TTL on every entry and add jitter so keys don't expire in lockstep.
- Add single-flight / request coalescing for hot keys *before* launch.
- Invalidate on write (or write-through, or short TTL) to a stated staleness budget.
- Size the cache to the hot set and alert on hit rate, evictions, and origin QPS.

**Don't**
- Don't add a cache before a number proves reads are the bottleneck (YAGNI).
- Don't cache data that must be exactly current — go to the source instead.
- Don't let a mass-expiry or cold start dump full load on the origin (warm, ramp).
- Don't ignore non-existent-key floods — cache negatives or front with a Bloom filter.
- Don't reuse a key across schema versions — bump the version (`...:v2`) instead.

## Numbers that matter
A cache node serves ~**100k–1M QPS**, far above an RDBMS (~1k). Memory access is
~100 ns vs ms-scale disk — the reason caching wins. Size the cache to the hot set
(~20% of data ≈ 80% of reads). Target hit rates are usually 90%+; below that,
question whether the data is cacheable. → `back-of-the-envelope`.

## Interface sketch
A cache entry is a contract: a **key** (stable, namespaced, e.g.
`user:123:profile`), a **value** (serialized; watch size), and a **TTL**. Decide
the **invalidation event** per key family (on write? on TTL? on version bump?).
Versioned keys (`...:v2`) make invalidation a write of a new key instead of a
delete race.

## Choosing a provider
Default to the generic recipe above (Redis or Memcached, self-hosted or managed).
If the user names a cloud, read `references/providers/<provider>.md` for the
managed-service mapping, limits, and provider-specific trade-offs. If no file
exists for that provider, the generic recipe is the answer.

## Diagram
To visualize the cache-aside read path (app → cache → miss → origin → populate)
or the stampede/fallback flow, use the in-plugin `architecture-diagram` skill —
cache nodes use the cache color, the origin its store color, and the miss path a
dashed arrow.

## Related building blocks
- `content-delivery` — *pairs with* this as the edge layer above it; CDN/edge caching for static and media (that concept lives there).
- `data-storage` — *depends on* this as the origin a cache protects; its read replicas are an *alternative to* caching reads, and cache-node sharding mirrors its partitioning. (Consistent-hashing theory is *owned by* `consistency-coordination`.)
- `consistency-coordination` — *pairs with* this when staleness is unacceptable and read-your-writes or stronger guarantees are required.
- `back-of-the-envelope` — *feeds into* this skill: it supplies the read ratio and hot-set size that justify a cache.
- `resilience-failure` — *pairs with* this; rate limiting and circuit breakers (*owned* there) help contain the retry storms a misbehaving cache can trigger.
- `system-design` — *owned-concept lives in* the orchestrator: the reasoning loop, the trade-off method, and the ten failure modes.

## References
- **`references/deep-dive.md`** — invalidation patterns, single-flight/coalescing, consistent hashing for cache sharding, Redis vs Memcached internals, local (L1) + distributed (L2) tiers. Read when designing the cache layer in detail.
- **`references/providers/{generic,aws,azure,gcp}.md`** — service mappings, limits, and pitfalls per environment.
