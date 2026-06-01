# API design — GCP

## Service mapping
- **API Gateway** — managed gateway for REST/HTTP backends (Cloud Run, Functions,
  App Engine) configured from an OpenAPI spec; API keys, auth, basic quotas. The
  simple default for a public REST contract on serverless backends.
- **Apigee** — full enterprise API management: versioning, quotas/spike-arrest,
  transformation, monetization, analytics. Use when you need rich policy,
  developer portals, and product packaging.
- **Cloud Endpoints** — gateway/ESP proxy for REST *and gRPC* (OpenAPI or protobuf
  config), with auth and monitoring; sits in front of GKE/Compute/Cloud Run.
- **Global External HTTP(S) Load Balancer** — L7 routing with gRPC and WebSocket
  support for service traffic (pairs with `load-balancing`).

## When to pick which
API Gateway for a lightweight managed front on serverless; Endpoints when you need
gRPC or an ESP sidecar in front of GKE; Apigee for enterprise policy/quotas/portal;
the HTTP(S) LB for plain global routing of gRPC/WebSocket.

## Limits / things that bite (verify against current docs)
- API Gateway / serverless backends (Cloud Run, Functions) have **request timeout
  and payload caps** — long calls must go async; tune the backend timeout too.
- Quota/spike-arrest semantics differ: Apigee's spike-arrest smooths bursts,
  API Gateway's quotas are coarser — know which you're getting.
- Apigee is a heavyweight, higher-cost platform; API Gateway is far lighter —
  don't reach for Apigee unless its policy/portal features are needed.
- WebSocket via the HTTP(S) LB has connection-duration and timeout caps; long-lived
  clients reconnect.

## Pitfalls
- Reaching for Apigee (cost, complexity) when API Gateway or Endpoints suffices.
- Assuming the gateway provides idempotency — it doesn't; build the idempotency-key
  store (Firestore/Memorystore with TTL).
- Forgetting Cloud Run/Functions backend timeouts compound with the gateway's.
- Lock-in via Apigee policies and Endpoints ESP config that don't port out.
