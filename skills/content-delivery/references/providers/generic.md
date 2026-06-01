# Content delivery — generic / self-hosted

The vendor-neutral default. When no cloud is named, this is the answer.

## What to run
- **A commercial CDN** (Cloudflare, Akamai, Fastly) — the usual choice; a global
  PoP network you configure, not operate. Pull by default; most support push,
  shields, signed URLs, edge compute, and `stale-while-revalidate`.
- **Self-hosted edge cache** (Varnish, NGINX `proxy_cache`, Apache Traffic Server)
  — reverse-proxy caches you run in a few regions yourself. *Use when* you need
  full control, on-prem, or a private edge — but you own PoP placement, scaling,
  TLS, and routing. This is a regional reverse-proxy cache, not a global CDN.

## Topology
- **Pull:** edge ← (optional shield) ← origin (object store or app server). Set
  `Cache-Control`/`s-maxage` at the origin; edges obey it.
- **Push:** build pipeline uploads to CDN storage; URLs rewritten to the CDN domain.
- **Routing:** anycast or DNS geo-routing sends each user to the nearest healthy
  edge (mechanics in `load-balancing`).
- **Shield:** one regional mid-tier cache in front of the origin collapses edge
  misses into a single origin fetch.

## Limits / things that bite
- **Cache key** is the lever: unbounded query params or cookies in the key drop hit
  rate toward zero — whitelist params, strip cookies on static paths, mind `Vary`.
- **Purge propagation** is not instant across global PoPs (seconds to minutes);
  prefer versioned/fingerprinted URLs over purge for freshness.
- **Self-hosted Varnish/NGINX** caches in RAM/disk per node — sized per box, no
  global anycast unless you build it; an eviction loses that node's working set.
- **Egress** is the cost line that dominates; a hot uncacheable path bleeds it.

## Pitfalls
- Treating a single-region Varnish box as a CDN — it has no global proximity.
- No origin fallback when the edge/CDN is down (the edge is now a dependency).
- One giant TTL → synchronized expiry stampede; add jitter / `stale-while-revalidate`.
- Forgetting the origin must survive a global cold-cache pull (use a shield).

Operationally lightest with a commercial CDN (zero PoP ops, pay per egress);
self-hosted edge gives control and no per-egress vendor bill but you build the
global footprint, routing, and resilience yourself.
