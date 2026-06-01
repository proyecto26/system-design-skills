# Content delivery — GCP

## Service mapping
- **Cloud CDN** — the general CDN; caches at Google's edge in front of an external
  HTTPS load balancer (the LB *is* the front door), pulling from a backend bucket
  or backend service. Use for static/media and cacheable dynamic responses.
- **Media CDN** — a separate product tuned for **large-scale video/media** delivery
  (built on YouTube's edge); choose it over Cloud CDN when streaming volume,
  segmented HLS/DASH, or huge file egress dominates.
- **Cloud Storage (GCS)** — the usual static/media origin (backend bucket).
- **Cloud Load Balancing** — Cloud CDN is enabled *on* the external HTTPS LB; global
  anycast routing comes from the LB (→ `load-balancing`).

## When to pick which
Cloud CDN for web static assets and general caching tied to your HTTPS LB; Media CDN
when the workload is video/large-file streaming at scale; GCS backend bucket as the
simplest static origin.

## Limits / things that bite (verify against current docs)
- Cloud CDN requires (and is configured through) an **external HTTPS load
  balancer** — you don't point it at a raw origin; the LB defines backends.
- **Cache mode** matters: `CACHE_ALL_STATIC` vs `USE_ORIGIN_HEADERS` vs
  `FORCE_CACHE_ALL` change what gets cached — pick deliberately.
- Cache-key policy (include/exclude query strings, host, protocol) drives hit rate;
  default may over- or under-cache.
- Invalidation propagation is not instant; prefer versioned URLs. Egress is the
  dominant cost and varies by region/tier.

## Pitfalls
- Expecting Cloud CDN without setting up the HTTPS LB + backend bucket/service.
- Using Cloud CDN for heavy video when Media CDN is the fit (or vice versa).
- Wrong cache mode → caching nothing, or caching personalized responses.
- Lock-in via LB + CDN config and Media CDN-specific features.
