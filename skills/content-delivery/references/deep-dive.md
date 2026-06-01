# Content delivery deep-dive

Mechanics that don't belong in the lean SKILL.md. Read when designing the edge
layer in detail.

## The cache key (where hit rate is won or lost)

The edge caches one object per **cache key**. By default the key is the request
URL, but every extra dimension multiplies the keyspace and shreds hit rate:

- **Query strings:** an unbounded param (tracking IDs, cache-busters) means every
  request is a unique key — nothing caches. *Fix:* whitelist the params that truly
  change the response (`?w=400`), ignore the rest, and sort them so `?a=1&b=2` and
  `?b=2&a=1` collapse to one key.
- **Cookies:** including a session cookie in the key gives every user their own
  copy. Strip cookies on static paths; only key on a cookie when content genuinely
  varies by it.
- **`Vary` header:** the origin's `Vary` tells the edge which request headers fork
  the cache. `Vary: Accept-Encoding` (gzip/br) is fine and necessary;
  `Vary: User-Agent` forks the cache thousands of ways — avoid. `Vary: Cookie` is
  almost always a mistake on cacheable content.

## Cache-Control directives that matter

The origin controls edge behavior through response headers:

- `max-age=N` — fresh for N seconds (browser **and** edge unless overridden).
- `s-maxage=N` — edge-specific TTL; lets the edge cache longer than the browser.
- `public` / `private` — `private` forbids shared (edge) caching; use for
  per-user responses.
- `no-cache` — must revalidate before serving (still may store); `no-store` —
  never store. These two, set by accident on a hot asset, send full traffic to
  origin.
- `immutable` — the asset never changes for this URL; the browser won't even
  revalidate. Pair with fingerprinted filenames.
- `stale-while-revalidate=N` — serve the stale copy for up to N seconds while
  asynchronously refetching. Hides origin latency on refresh and blunts expiry
  stampedes.
- `stale-if-error=N` — serve stale on origin error. Cheap resilience.

## Push vs pull mechanics

- **Pull:** edge gets a miss → fetches from origin (or shield) → stores per
  `Cache-Control`/TTL → serves. Redundant re-pulls happen when a TTL expires but
  the object didn't change; conditional requests (`If-None-Match` with `ETag`)
  turn that into a cheap 304 instead of a full transfer.
- **Push:** you upload via the CDN's API/storage and rewrite asset URLs to the CDN
  domain. No cold miss, but you own the upload pipeline, storage cost for cold
  objects, and consistency between your build and what's on the edge.

## Origin shield / tiered caching

Without a shield, a cold object is fetched independently by every edge PoP — N
misses, N origin fetches. An **origin shield** is a designated regional cache that
all PoPs pull *through*: the origin sees one fetch per object, not N. It also
absorbs purge/expiry stampedes. Cost: an extra hop on the cold path and a regional
chokepoint — make the shield itself redundant if the origin can't take direct load.

## Invalidation vs versioning (the race)

- **Explicit purge:** call the CDN to evict a path/tag. Propagation across global
  PoPs is *not* instant (seconds to minutes); during that window different users
  see different versions. Tag-based purges (evict everything tagged `product:123`)
  scale better than path-by-path.
- **Versioned / fingerprinted URLs:** change the URL when content changes
  (`app.4f9a.js`, `?v=2`). The new URL is a guaranteed miss → always fresh; old
  URLs age out by TTL. No purge, no race. This is the preferred model and the same
  trick `caching` uses with versioned keys — see there for the eviction/invalidation
  theory shared with this layer.

## Media-specific delivery

Large media is delivered differently from small static files:

- **Segmented streaming (HLS/DASH):** video is chunked into short segments + a
  manifest. Each segment is a cacheable static object, so a CDN serves video
  without special support; only the manifest is small and short-lived.
- **Byte-range requests** (`Range:` / `206 Partial Content`): enable seeking and
  resumable downloads without refetching the whole file; the edge caches ranges.
- **Signed URLs / signed cookies:** time-limited, tamper-proof tokens authorize
  access to private media at the edge without a per-request origin auth call.
- **On-the-fly transforms** (image resize/format, e.g. AVIF/WebP via `Accept`):
  powerful but each variant is a distinct cache key — bound the variant set.

## Multi-CDN

Using two CDN providers behind smart DNS/steering removes the single-CDN SPOF and
lets you route by performance or cost per region. Cost: more operational surface,
split hit rates (each CDN warms independently), and config drift between vendors.
Reach for it only when CDN-level availability or per-region performance genuinely
justifies it.

## Common mistakes

- Cookies or unbounded query params in the cache key → ~0% hit rate, full origin
  load while still paying the CDN.
- One global TTL → synchronized mass expiry stampede (add jitter, use
  `stale-while-revalidate`).
- Relying on purge for freshness instead of versioned URLs (propagation race).
- No origin fallback plan — the CDN becomes a hard dependency in front of everything.
- `no-store`/`no-cache` left on a hot asset → silent egress and origin blowup.
- Treating the edge as durable storage; it is a cache and can evict anything anytime.
