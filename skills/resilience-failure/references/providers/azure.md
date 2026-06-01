# Resilience & failure — Azure

## Service mapping
- **Redundancy / failover** — **Availability Zones** within a region (default
  fault isolation); **Availability Sets** for rack/update-domain spread;
  paired-region replication for region loss. VM Scale Sets replace failed
  instances; Load Balancer / Application Gateway stop routing to unhealthy
  backends (health probes → `load-balancing`).
- **Global failover routing** — **Azure Front Door** (and Traffic Manager) for
  health-probe-based failover and latency/priority routing across regions.
- **Rate limiting / load shedding** — **Front Door / Application Gateway WAF**
  rate-limit rules at the edge; **API Management** has throttling policies
  (`rate-limit` and `quota` by key/subscription).
- **Retries / circuit breaking** — Azure SDKs retry with backoff + jitter;
  app-level via Polly (the .NET standard); a mesh (Istio/Linkerd on AKS) adds
  proxy-level timeouts/retries/breaking.
- **Queue containment** — **Service Bus** (with dead-letter queues) → `messaging-streaming`.
- **Shared limiter store** — **Azure Cache for Redis** for counters.

## Limits / things that bite (verify against current docs)
- Zone-redundant managed services failover in seconds; async geo-replication
  (e.g. SQL geo-replicas) can lose recent writes on region failover.
- API Management rate-limit policies are scoped (by key/product/subscription) and
  per-unit/region — limits don't automatically aggregate across regions.
- Front Door WAF rate limiting uses a rolling window with coarse granularity; not
  a precise per-second limiter.

## Provider-specific trade-offs
- Zone redundancy is the cheap default; **paired-region / active-active is a
  major cost and complexity jump** — tie it to the SLA, not ambition.
- Front Door centralizes edge protection + global routing but becomes a critical
  path component to design redundantly around.

## Pitfalls
- Confusing **Availability Sets** (fault/update domains in one datacenter) with
  **Zones** (separate datacenters) — only zones survive a datacenter loss.
- Stacking SDK retries with Polly retries with mesh retries (load multiplier).
- Treating geo-replication failover as lossless.
