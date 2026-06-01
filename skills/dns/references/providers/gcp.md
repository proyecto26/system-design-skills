# DNS — GCP

## Service mapping
GCP also splits zone hosting from global steering — most traffic steering happens
in the load balancer, not in Cloud DNS.

- **Cloud DNS** — managed authoritative hosting on Google's anycast network. Public
  and private zones, standard record types, DNSSEC, and **routing policies**:
  **Weighted round-robin** and **Geolocation** (answer by client region), plus
  health-checked **failover** for internal/private routing. Apex support is via the
  policy/record set rather than a separate alias type — point records at a global
  LB IP.
- **Cloud Load Balancing (global external)** — the primary "latency/geo" steerer.
  A single **anycast global IP** front-ends all regions; Google's edge routes users
  to the nearest healthy backend and fails over **without DNS TTL waits**. Prefer
  this over DNS-level geo for speed and fast failover. Edge caching (Cloud CDN) is
  `content-delivery`.
- **Cloud DNS routing policies** cover DNS-level weighted/geo when you specifically
  need answers to differ per client rather than a single anycast IP.

## When to pick which
Default: one global external Application LB on an anycast IP, with Cloud DNS holding
a simple record pointing at it — proximity and failover handled at the LB, no TTL
dependency. Reach for Cloud DNS geolocation/weighted policies when you need the
*answer itself* to differ (data residency, canary across distinct IPs).

## Limits / things that bite (verify against current docs)
- DNS-level geo/weighted policies are TTL-bound; the global LB's anycast steering is not.
- Cloud DNS geolocation maps by client region (resolver-influenced), not exact user.
- Per-zone record-set and per-policy item quotas apply.
- Health-checked DNS failover applies mainly to private/internal zones — public
  fast failover is the LB's job.

## Pitfalls
- Building DNS-level geo routing when a single global anycast LB IP would be simpler and faster.
- Forgetting DNSSEC key management once enabled (validation breaks = outage).
- Assuming Cloud DNS does latency routing like a managed competitor — favor the LB instead.
