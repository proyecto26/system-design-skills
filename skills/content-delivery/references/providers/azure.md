# Content delivery — Azure

## Service mapping
- **Azure Front Door** — the strategic choice: global anycast edge that combines
  CDN caching, TLS termination, path-based routing, and L7 load balancing /
  failover across origins in one product. Prefer it for new designs.
- **Azure CDN** — classic pull CDN (Microsoft/edge network); simpler, caching-only.
  Note the older third-party (Verizon/Akamai) tiers are being retired — **verify
  the current product against docs** before designing around them.
- **Blob Storage / Static Website hosting** — the usual static/media origin behind
  Front Door or CDN.
- **Traffic Manager** — DNS-based geo/priority routing when you need pure DNS
  steering rather than an anycast edge (→ `load-balancing`).

## When to pick which
Front Door when you want edge caching *and* global routing/failover/WAF together
(most cases); plain Azure CDN only for caching with no routing needs; Blob Static
Website + Front Door for a simple static site.

## Limits / things that bite (verify against current docs)
- Front Door **caching rules** decide query-string and header handling — default
  behavior may not cache as you expect; configure the cache key explicitly.
- Purge propagation is not instant; prefer versioned URLs.
- Front Door and classic CDN have different feature sets and pricing models — don't
  assume parity; rules engines differ.
- Egress / routing costs are the dominant line; tiers vary by region.

## Pitfalls
- Designing around a retiring CDN tier — confirm the SKU is current.
- Expecting Front Door's routing features from plain Azure CDN (it's caching-only).
- Misconfigured cache key (forwarding all query strings) → low hit rate.
- Lock-in via Front Door rules engine / WAF policies that don't port elsewhere.
