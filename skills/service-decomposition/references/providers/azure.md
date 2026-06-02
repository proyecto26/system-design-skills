# Service decomposition — Azure

## Service mapping
- **Compute for services** — AKS (Kubernetes), Container Apps (managed
  containers + built-in Dapr/KEDA), or Functions for event-driven services.
- **API gateway / front door** — API Management (full gateway: auth, throttling,
  versioning) or Application Gateway / Front Door for routing.
- **Service discovery** — Kubernetes DNS on AKS; Container Apps service discovery;
  Dapr name resolution.
- **Service mesh** — Istio-based add-on for AKS, or Open Service Mesh; **Dapr**
  as a sidecar for service invocation, pub/sub, and state.
- **Cross-service workflows / saga** — Durable Functions or Logic Apps
  (orchestration); transactional outbox via Service Bus + change feed.

## When to pick which
Container Apps + Dapr for a fast managed microservices start; AKS when you need
full Kubernetes/mesh control; API Management when you need a policy-rich gateway;
Durable Functions for orchestrated sagas.

## Limits / things that bite (verify against current docs)
- API Management tiers differ sharply (no VNet/SLA on Consumption; cost on Premium).
- Dapr adds a sidecar (latency/ops) though it simplifies invocation/pub-sub.
- Front Door / App Gateway routing + WAF add hops and config surface.

## Pitfalls
- Treating Logic Apps/Durable as a place for core business logic.
- Mixing Dapr and a separate mesh without a clear division of responsibility.
- Cross-service ACID expectations — use saga/outbox, not distributed transactions.
