# DNS — AWS

## Service mapping
- **Route 53** — managed authoritative DNS on a global anycast network; the default.
  Hosted zones (public/private), health checks, and routing policies cover every
  generic option:
  - **Simple / Weighted / Latency / Geolocation / Geoproximity / Failover /
    Multivalue-answer** routing policies map 1:1 to the generic policies (geoproximity
    adds a bias knob to shift traffic between regions).
  - **Alias records** — Route 53's apex-alias (the generic `ALIAS`); point the zone
    apex at an ELB/CloudFront/S3/API Gateway target with no charge for alias queries.
  - **Health checks** — endpoint, calculated (combine checks), or CloudWatch-alarm
    based; gate any policy so unhealthy targets drop out.
- **Route 53 Resolver** — for hybrid/VPC DNS (inbound/outbound endpoints); not traffic steering.
- **Global Accelerator** — anycast IP + health-based failover that reacts *faster
  than DNS* (no TTL wait) by steering at the network layer; reach for it when DNS
  TTL-bound failover is too slow.

## When to pick which
Route 53 alias at the apex onto an ELB/CloudFront is the standard front door.
Latency routing for speed, geolocation for residency, failover for active-passive
DR, weighted for canary. Use Global Accelerator instead when you need sub-TTL
failover or a fixed entry IP.

## Limits / things that bite (verify against current docs)
- Health-check failover is still **TTL + propagation** bound — Global Accelerator
  exists precisely to beat that.
- Latency records route by the *resolver's* AWS-measured latency, not the user's.
- Alias targets are limited to specific AWS resource types.
- Per-hosted-zone record counts and health-check counts have soft quotas.

## Pitfalls
- Putting a `CNAME` at the apex instead of an alias record.
- Expecting Route 53 failover to be instant (it is not — consider Global Accelerator).
- Geoproximity bias misconfigured, silently overloading one region.
- Single hosted zone with no secondary-provider plan for a critical property.
