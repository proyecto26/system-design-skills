# Resilience & failure — AWS

## Service mapping
- **Redundancy / failover** — span **multiple Availability Zones** (the default
  unit of fault isolation); go **multi-Region** only for whole-Region survival.
  Auto Scaling groups replace failed instances; ALB/NLB stop routing to unhealthy
  targets (health checks → `load-balancing`).
- **DNS failover** — **Route 53 health checks** + failover/latency/weighted
  routing flip traffic to a healthy endpoint or Region.
- **Rate limiting / load shedding** — **API Gateway** usage plans + throttling
  (token-bucket: rate + burst); **AWS WAF rate-based rules** at CloudFront/ALB to
  shed abusive IPs before they reach the app.
- **Retries / timeouts / circuit breaking** — the **AWS SDK** retries with
  backoff + jitter and adaptive mode built in; **App Mesh** (Envoy) adds
  mesh-level timeouts/retries/circuit breaking.
- **Queue containment** — **SQS** (with a redrive policy → DLQ) absorbs spikes and
  isolates poison messages → `messaging-streaming`.
- **Shared limiter store** — **ElastiCache (Redis)** for counters.

## Limits / things that bite (verify against current docs)
- Multi-AZ failover for managed stores (RDS, ElastiCache) takes **seconds** and
  can drop un-replicated writes → `consistency-coordination`.
- API Gateway throttling is **token bucket** (steady rate + burst); account- and
  stage-level limits stack — a low account limit caps everything.
- WAF rate-based rules evaluate over a rolling window with a **minimum** window
  and coarse granularity; not a precise per-second limiter.
- Cross-AZ data transfer is billable; chatty cross-AZ retries cost money.

## Provider-specific trade-offs
- Multi-AZ is cheap insurance and usually enough; **multi-Region is a large
  step-up** in cost and complexity (data replication, failover orchestration) —
  justify it against the availability target, don't default to it.
- Route 53 failover depends on health-check sensitivity: too aggressive flaps,
  too lax delays cutover.

## Pitfalls
- Assuming Multi-AZ = zero data loss (it's seconds of async-replicated risk).
- Double retries: SDK adaptive retries **plus** app-level retries → load
  multiplier. Pick one layer.
- Relying on WAF rate rules for fine-grained per-user limits — use API Gateway /
  app-level for that.
- A single-AZ ElastiCache limiter store as an unnoticed SPOF.
