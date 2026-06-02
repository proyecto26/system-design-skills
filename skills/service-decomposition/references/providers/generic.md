# Service decomposition — generic / self-hosted

The vendor-neutral default. When no cloud is named, this is the answer.

## What to run
- **Monolith / modular monolith** — any framework; enforce module boundaries with
  package/build structure (e.g. separate modules, no cross-module DB access).
- **Comms** — REST/JSON for breadth; **gRPC** for internal high-throughput typed
  calls; events via Kafka/RabbitMQ for async (→ `messaging-streaming`).
- **API gateway** — Nginx, Kong, Envoy, or Traefik (auth, routing, rate limiting).
- **Service discovery** — Consul, etcd, or ZooKeeper as a registry; or DNS-based
  (e.g. Kubernetes Services).
- **Service mesh** — Istio or Linkerd (Envoy sidecars: mTLS, retries, traffic
  shaping, telemetry).

## Topology
Clients → gateway → services (each owning its data store) → async via a broker.
On Kubernetes, Services + DNS give discovery for free; add a mesh only when
uniform mTLS/retries/observability across many services justify the overhead.

## Limits / things that bite
- Each sync hop ≈ a same-DC round trip plus the callee's work; deep call graphs
  blow latency budgets.
- A registry or gateway is a SPOF unless replicated; cache discovery client-side.
- Mesh sidecars add per-call latency and a real ops burden — not free.

## Pitfalls
- Sharing one database across services (distributed monolith).
- Splitting before a real driver (deploy/scale/ownership) exists.
- No distributed tracing → undebuggable cross-service failures.
