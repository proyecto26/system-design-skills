# Content delivery — AWS

## Service mapping
- **CloudFront** — the CDN; global PoPs, pull from origin (S3, ALB, or any HTTP
  origin), `Cache-Control`/policy-driven TTLs, signed URLs/cookies, and
  **CloudFront Functions / Lambda@Edge** for edge logic. The default.
- **Origin Shield** — an opt-in regional mid-tier cache for a CloudFront
  distribution; collapses PoP misses into one origin fetch (→ origin shield option).
- **S3** — the usual static/media origin behind CloudFront; pair via Origin Access
  Control so the bucket isn't publicly reachable.
- **Route 53** — DNS geo/latency routing to origins or for multi-region (→ `load-balancing`).
- No separate "push CDN" product — push is "upload to S3, serve via CloudFront."

## When to pick which
CloudFront + S3 for static/media; add Origin Shield when many PoPs hammer a single
origin or to blunt stampedes; Lambda@Edge only when you need real request/response
manipulation (CloudFront Functions for cheap lightweight header/URL rewrites).

## Limits / things that bite (verify against current docs)
- **Cache key** is set by *cache policies* — forwarding all query strings/cookies/
  headers tanks hit rate; forward only what varies the response.
- Invalidations are **eventually consistent** and the first chunk per month is free,
  then billed per path — prefer versioned URLs over mass invalidation.
- Egress (data transfer out) is the dominant cost; pricing tiers vary by region.
- Lambda@Edge has size/runtime limits and runs in the requesting region — adds
  latency and complexity vs CloudFront Functions.

## Pitfalls
- Public S3 bucket as origin (use Origin Access Control instead).
- Forwarding cookies/all query strings in the cache policy → near-zero hit rate.
- Relying on invalidation for freshness and being surprised by propagation lag.
- Lock-in: cache policies, Lambda@Edge, and signed-URL formats don't port to other clouds.
