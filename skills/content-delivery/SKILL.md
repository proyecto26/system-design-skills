---
name: content-delivery
description: This skill should be used when the user asks about a "CDN", "edge caching", "static asset delivery", "media / video delivery", "geo distribution" or "geo-routing", "push vs pull CDN", "cache-control headers" / "TTL for static assets", "origin offload", or "origin shield". It gives the recipe for serving bytes from the edge close to users. Use it whenever a design serves images, video, JS/CSS, or downloads to a wide geography, or the origin is saturated by repeat reads of the same files, even if the user doesn't say "CDN".
---

# Content Delivery

Push bytes to the network edge so requests terminate close to the user and never
reach the origin. A CDN is the outermost cache layer of a system: get it right and
most static/media traffic and a chunk of latency vanish before they hit your
servers; get it wrong and you serve stale assets, leak origin load, or pay egress
twice.

## When to reach for this
The same files (images, video, JS/CSS bundles, downloads, fonts) are read
repeatedly by a geographically spread audience; the origin or its bandwidth is the
bottleneck for static reads; or cross-region latency on first byte hurts (a
cross-continent round trip is ~100 ms — see `back-of-the-envelope`). A CDN buys
latency *and* origin offload at once.

## When NOT to
Highly personalized, per-request dynamic responses with no cacheable shape (a CDN
adds a hop and caches nothing). Tiny single-region audiences where the origin
already serves reads comfortably (YAGNI — a CDN is another vendor, another bill,
another invalidation problem). Strictly fresh data that cannot tolerate any
staleness window — that belongs at the origin or behind `consistency-coordination`,
not a TTL-based edge. Naming a CDN before a number shows static reads or geography
is the problem is a red flag.

## Clarify first
- **Content mix** — what fraction is cacheable static/media vs uncacheable
  dynamic/personalized? (Only the cacheable part benefits.)
- **Update cadence & staleness budget** — how often do assets change, and how
  stale may an edge copy be? (Drives TTL and invalidation strategy.)
- **Geography** — where are users, and how concentrated? (Decides whether edge PoPs
  and geo-routing matter at all.)
- **Object size & egress volume** — average asset size × requests = egress; this
  sizes the bill and the offload (→ `back-of-the-envelope`).
- **Origin shape** — object store (S3/GCS/blob) or dynamic app server? Can it
  survive a cold-cache stampede if the edge flushes?

## The options

**Distribution model — how content reaches the edge**
- **Pull (origin-pull):** the edge fetches on first miss, caches per TTL, serves
  the rest. *Use when* traffic is high and content is large or churny — the edge
  holds only what's actually requested. The default for most systems.
- **Push:** you upload assets to the CDN ahead of demand and rewrite URLs.
  *Use when* the catalog is small/static or launch spikes can't tolerate a cold
  first-miss (you pre-warm); you accept managing storage and uploads yourself.

**Caching key & TTL — what the edge keys on and for how long**
- **Long TTL + fingerprinted URLs** (`app.4f9a.js`, `image.png?v=2`): immutable
  assets cached for months; a content change is a *new URL*, not an invalidation.
  *Use when* you control asset URLs — the cleanest model.
- **Short TTL / `stale-while-revalidate`:** bound staleness for content that
  changes on a schedule. *Use when* URLs are stable but content updates.

**Edge proximity & routing — how a user reaches the nearest PoP**
- **Anycast / DNS geo-routing:** route each user to the closest healthy edge.
  *Use when* the audience is multi-region (almost always, for a CDN). Shared with
  `load-balancing` — see there for the routing mechanics.

**Origin protection — shrinking the origin's exposed surface**
- **Origin shield / mid-tier cache:** a single regional cache layer in front of the
  origin that all edges pull through, collapsing N edge misses into one origin
  fetch. *Use when* origin offload or stampede protection matters more than a
  little extra latency on cold misses.

## Trade-offs

| Option | What it solves | What it worsens | Change it when |
|---|---|---|---|
| Pull CDN | Edge holds only requested content; no upload pipeline | First request per object is a slow miss; redundant re-pulls when TTL expires before content changes | Cold-miss latency or launch spikes hurt → push / pre-warm |
| Push CDN | No cold miss; full control of what's cached and when | You own upload + storage + URL rewriting; pay to store rarely-read assets | Catalog grows or churns → pull |
| Long TTL + fingerprinted URLs | Near-permanent caching; updates are new URLs (no invalidation race) | Requires build/URL control; old versions linger at edge until aged out | URLs are not under your control → short TTL |
| Short TTL / stale-while-revalidate | Bounded staleness on stable URLs | More origin revalidation traffic; synchronized expiry can stampede | Content is truly immutable → fingerprint + long TTL |
| Geo-routing / anycast | Users hit the nearest edge; lower latency | More PoPs to reason about; routing can send users to a degraded PoP | Single-region audience → skip it |
| Origin shield | Collapses edge misses into one origin fetch; protects origin | Extra hop on cold path; the shield is a new chokepoint/SPOF if single-region | Origin is robust and offload is already enough → drop it |

## Behavior under stress
A CDN usually *absorbs* load spikes — that's its job — but it has its own failure
shapes, and they tend to dump straight onto the origin.

- **Cold cache / mass eviction:** after a purge, config push, or TTL synchronized
  expiry, edge hit rate craters and every PoP pulls from the origin at once. This
  is a `caching` thundering herd at global scale. *Mitigate:* origin shield to
  collapse misses, TTL jitter, `stale-while-revalidate` so the edge serves stale
  while it refetches, staged purges.
- **Cache busting / low hit rate:** unbounded query-string variation or cookies in
  the cache key explode the keyspace so nothing stays cached — the origin sees full
  traffic while you still pay the CDN. *Mitigate:* normalize/whitelist cache-key
  params; strip cookies on static paths.
- **Hot object:** one viral file can exceed a single PoP's capacity, but CDNs scale
  this far better than an origin — the real risk is a hot *uncacheable* path
  punching through to the origin.
- **CDN outage / partial PoP failure:** the edge is now a dependency in front of
  everything. Plan origin fallback (clients or DNS failover to origin) and accept
  the origin must briefly take full load, or use a second CDN (multi-CDN).
- **Egress surprise:** a misconfigured `no-cache` or a hot uncacheable asset can
  10× the origin egress bill silently.

**Monitor:** edge hit ratio (cache hit rate), origin offload %, origin request rate
(the number that spikes when the edge fails), p95 edge latency by region, egress
bytes, and 4xx/5xx at the edge vs origin.

## How to apply
1. **Clarify the inputs** — content mix (cacheable fraction), staleness budget,
   geography, object size × volume, and origin shape (see `Clarify first`). If the
   cacheable fraction is near zero or the audience is single-region, stop here.
2. **Pick the distribution model and cache key** from the trade-off table: default
   to **pull**; switch to **push/pre-warm** only when cold-miss latency or launch
   spikes hurt. Prefer **long TTL + fingerprinted URLs** when you control URLs,
   else **short TTL / `stale-while-revalidate`**.
3. **Set the knobs** — `Cache-Control` (max-age, immutable, stale-while-revalidate),
   the cache key (URL path + whitelisted params; strip cookies on static paths),
   `Vary` only where you truly differ, and add an **origin shield** if offload or
   stampede protection matters.
4. **Stress-test the design** — walk a global purge, a config push, and a CDN/PoP
   outage. Confirm TTL jitter + `stale-while-revalidate` + shield keep the origin
   survivable, and that a client/DNS fallback to origin exists.
5. **Size it with numbers** — estimate hit ratio (target 90%+), origin offload %,
   and egress (`requests × avg object size`) via `back-of-the-envelope`. If egress
   or origin request rate is alarming, revisit the cache key and TTL.
6. **Pick a provider** — default to the generic recipe; if a cloud is named, read
   its provider file for the service mapping and limits (see `Choosing a provider`).

## Dos and don'ts
**Do**
- Fingerprint immutable assets and cache them for months — turn updates into new
  URLs, not invalidations.
- Whitelist cache-key params and strip cookies on static paths to keep hit ratio high.
- Add `stale-while-revalidate` and TTL jitter so synchronized expiry can't stampede
  the origin.
- Add an origin shield when many edges would otherwise miss to the origin at once.
- Plan an origin/DNS fallback (or multi-CDN) for a CDN or PoP outage.
- Monitor edge hit ratio and origin request rate — the number that spikes when the
  edge fails.

**Don't**
- Reach for a CDN before a number shows static reads or geography is the bottleneck.
- Let unbounded query strings or `Vary: Cookie` explode the keyspace and gut caching.
- Treat a single-region origin shield as free — it is a new chokepoint/SPOF.
- Cache strictly-fresh data on a TTL when zero staleness is required.
- Ship a careless `no-cache` on a hot asset — it can silently 10× origin egress.

## Numbers that matter
The decisive quantities are **hit ratio** (90%+ is the goal; below ~80% question
whether content is cacheable), **origin offload %** (1 − origin-requests/total),
and **egress** (`requests × avg object size`). Edge-vs-origin latency is the
payoff: an edge hit is a same-region round trip (~ms to tens of ms) instead of a
cross-continent one (~100 ms). Do the egress and offload math with
`back-of-the-envelope` — don't restate its tables here; egress is the line item
that usually dominates a CDN bill.

## Interface sketch
The contract is mostly **HTTP cache headers** the origin sets and the edge obeys:
- `Cache-Control: public, max-age=31536000, immutable` for fingerprinted static.
- `Cache-Control: public, max-age=60, stale-while-revalidate=600` for stable URLs
  with periodic updates.
- `ETag` / `Last-Modified` to enable cheap revalidation (304 Not Modified).
- `Vary` only on headers you truly serve differently on (a careless `Vary: Cookie`
  destroys hit rate).
- The **cache key**: URL path + an explicit whitelist of query params; decide which
  cookies/headers (if any) are part of it.
Invalidation is a `PURGE`/invalidation API call *or* (preferably) a URL version
bump. Versioned URLs sidestep the purge-propagation race entirely.

## Choosing a provider
Default to the generic recipe above. If the user names a cloud, read
`references/providers/<provider>.md` for the managed-service mapping,
quotas/limits, and provider-specific trade-offs. If no file exists for that
provider, the generic recipe is the answer.

## Diagram
To visualize the edge → shield → origin pull path (and the dashed cold-miss arrow,
plus geo-routing from clients to the nearest PoP), use the in-plugin
`architecture-diagram` skill. Sketch the edge nodes in the cache color and the
origin in its store color; do not embed Mermaid here.

## Related building blocks
- `caching` — *owned-concept lives in*: invalidation, eviction, TTL, and
  thundering-herd theory live there; the CDN is the edge tier *above* the
  app/distributed cache and *alternative to* origin reads for static/media.
- `load-balancing` — *owned-concept lives in*: the geo/anycast routing and origin
  health checks that send users to the nearest edge.
- `back-of-the-envelope` — *feeds into* this: supplies the egress, offload %, and
  latency-payoff numbers that justify a CDN.
- `data-storage` — *depends on*: the object store that is usually the CDN's origin.
- `consistency-coordination` — *alternative to* this for data that cannot tolerate
  any staleness window (serve from origin, not a TTL-based edge).
- `system-design` — *pairs with* (back-link): the orchestrator that routes here when
  a design serves static/media at geographic scale.

## References
- **`references/deep-dive.md`** — cache-key normalization, `Cache-Control` directive
  semantics, push vs pull mechanics, origin shield / tiered topology, invalidation
  vs versioning races, multi-CDN, and media-specific delivery (segmented HLS/DASH,
  range requests, signed URLs). Read when designing the edge layer in detail.
- **`references/providers/{generic,aws,azure,gcp}.md`** — service mappings, limits, and pitfalls per environment.
