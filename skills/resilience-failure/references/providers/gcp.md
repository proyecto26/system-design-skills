# Resilience & failure — GCP

## Service mapping
- **Redundancy / failover** — **regional** (multi-zone) Managed Instance Groups
  are the default fault isolation; **multi-region** for region loss. MIG
  autohealing replaces failed instances; the global external HTTP(S) Load
  Balancer routes around unhealthy backends (health checks → `load-balancing`).
- **Global failover routing** — the global LB + Cloud DNS route to the nearest
  healthy backend and fail over across regions automatically.
- **Rate limiting / load shedding** — **Cloud Armor** rate-based ban rules and
  WAF at the edge; **Apigee** / API Gateway for per-key quota and spike-arrest
  (token-bucket-style) throttling.
- **Retries / circuit breaking** — Cloud client libraries retry with backoff +
  jitter; **Traffic Director / Anthos Service Mesh** (Envoy) adds proxy-level
  timeouts, retries, circuit breaking, and outlier ejection.
- **Queue containment** — **Pub/Sub** (with dead-letter topics) → `messaging-streaming`.
- **Shared limiter store** — **Memorystore (Redis)** for counters.

## Limits / things that bite (verify against current docs)
- Regional MIGs survive a zone loss transparently; multi-region failover depends
  on async cross-region replication and can lose recent writes.
- Cloud Armor rate-based rules use a rolling window with coarse granularity and a
  configurable ban duration — not a precise per-request limiter.
- Apigee spike-arrest smooths bursts (per-second/minute) and is enforced per
  message processor, so effective limits can differ from the nominal rate.

## Provider-specific trade-offs
- GCP's **global** anycast LB makes multi-region front-ends simpler than
  elsewhere — but the data tier's replication/consistency is still the hard part
  (→ `consistency-coordination`).
- Regional redundancy is the cheap default; multi-region is the cost/complexity
  step-up to justify against the SLA.

## Pitfalls
- Deploying a **zonal** (not regional) MIG and losing everything when that zone
  fails.
- Stacking client-library retries with mesh retries (load multiplier).
- Relying on Cloud Armor for fine-grained per-user limits — use Apigee/app-level.
