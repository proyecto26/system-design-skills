# API design — generic / self-hosted

The vendor-neutral default. When no cloud is named, this is the answer.

## What to run
- **REST/JSON** over an HTTP framework + a reverse proxy / API gateway you run
  (NGINX, Envoy, Kong, Traefik) for routing, TLS termination, auth, and rate
  limiting at the edge.
- **gRPC** with protobuf for internal service-to-service calls; add Envoy or
  grpc-web as a gateway when browsers must reach it.
- **GraphQL** via a server library (Apollo, graphql-js, gqlgen) — put depth/cost
  limits and persisted-query allowlists in front of it.
- **WebSocket/SSE** terminated at the app or a connection-aware proxy; SSE rides
  plain HTTP, WebSocket needs proxy support for the `Upgrade` handshake.
- **OpenAPI** (REST) / **protobuf** (gRPC) as the schema source of truth —
  generate clients, server stubs, and docs from it so the contract can't drift.

## Topology
- Edge gateway/proxy → service. The gateway owns cross-cutting concerns (auth, rate
  limiting, TLS, request size caps) so each service doesn't re-implement them.
- Idempotency-key store: a fast, durable KV (e.g. Redis with persistence, or a DB
  table) holding `key → response` with a TTL; co-locate with or transact alongside
  the write it protects.

## Limits / things that bite
- A stateless HTTP gateway scales horizontally; a **WebSocket/SSE** tier does not —
  it holds a connection (and memory) per client, so sizing is connections, not QPS,
  and load balancing must be connection-aware (sticky or a shared session store).
- Default request body and header size caps in the proxy will silently reject large
  payloads — set them deliberately.
- Self-managed rate limiting and idempotency dedupe need a shared store to work
  across instances (an in-process counter doesn't; → `resilience-failure`).

## Pitfalls
- No managed quota/throttle layer — you build and operate it (the gateway helps but
  you configure the limits and the storage behind them).
- Forgetting connection draining on deploy → WebSocket clients all reconnect at
  once (reconnect storm; add jitter).
- Hand-written clients drift from the server shape — generate from OpenAPI/protobuf
  instead.

Operationally heavier than a managed gateway, but zero lock-in and full control of
versioning, auth, and limits. Use when running your own infra or for portability
across clouds.
