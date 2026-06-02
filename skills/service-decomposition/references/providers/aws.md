# Service decomposition — AWS

## Service mapping
- **Compute for services** — ECS/Fargate or EKS (containers), or Lambda (functions)
  for event-driven/spiky services.
- **API gateway / front door** — API Gateway (REST/HTTP/WebSocket, auth, throttling)
  or ALB (path/host routing) for simpler container fronting.
- **Service discovery** — AWS Cloud Map (+ ECS Service Connect); EKS uses
  Kubernetes DNS.
- **Service mesh** — App Mesh (Envoy-based) or self-managed Istio on EKS.
- **Cross-service workflows / saga** — Step Functions (orchestration) or
  EventBridge (choreography); transactional outbox via DynamoDB Streams.

## When to pick which
ALB for plain container routing; API Gateway when you need managed auth/throttle/
usage plans; Lambda + EventBridge for event-driven services; Step Functions when a
multi-service write needs orchestrated compensation (saga).

## Limits / things that bite (verify against current docs)
- API Gateway adds latency + per-request cost and has payload/timeout limits
  (e.g. ~29s integration timeout) — not for long-running calls.
- App Mesh/Envoy sidecars add latency and operational surface.
- Cloud Map / Service Connect health-check + DNS TTL lag affects failover speed.

## Pitfalls
- API Gateway accreting business logic (mappings/transforms) into a hidden monolith.
- Lambda for chatty synchronous chains → cold starts + fan-out latency.
- Cross-service ACID expectations — use Step Functions/saga, not 2PC.
