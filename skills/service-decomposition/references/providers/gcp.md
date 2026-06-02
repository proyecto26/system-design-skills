# Service decomposition — GCP

## Service mapping
- **Compute for services** — GKE (Kubernetes), Cloud Run (managed containers,
  scale-to-zero), or Cloud Functions for event-driven services.
- **API gateway / front door** — API Gateway (managed) or Apigee (full API
  management); Cloud Load Balancing for routing.
- **Service discovery** — Kubernetes DNS on GKE; Cloud Run service URLs; Traffic
  Director for mesh-managed discovery.
- **Service mesh** — Anthos Service Mesh / Traffic Director (Envoy-based) or
  self-managed Istio on GKE.
- **Cross-service workflows / saga** — Workflows (orchestration) or Pub/Sub
  (choreography); transactional outbox via Pub/Sub + a DB change stream.

## When to pick which
Cloud Run for stateless services you want managed + scale-to-zero; GKE when you
need full Kubernetes/mesh; API Gateway for lightweight fronting, Apigee for rich
API management; Workflows for orchestrated sagas.

## Limits / things that bite (verify against current docs)
- Cloud Run request timeout cap and cold starts affect chatty synchronous chains.
- Apigee is powerful but heavy/costly; API Gateway is lighter but less featured.
- Traffic Director / Anthos Service Mesh add Envoy overhead and config surface.

## Pitfalls
- Cloud Functions for deep synchronous fan-out (cold-start + latency stacking).
- One Cloud SQL instance shared across services (distributed monolith).
- Expecting cross-service ACID — use saga/outbox via Workflows/Pub-Sub.
