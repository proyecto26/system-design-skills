# API design — AWS

## Service mapping
- **API Gateway (REST API)** — full-featured managed REST front: per-method
  throttling, API keys + usage plans, request validation, WAF, caching. The
  default for a public REST contract.
- **API Gateway (HTTP API)** — leaner, cheaper, lower-latency HTTP front; fewer
  features (no built-in request validation/caching). Use when you don't need the
  REST API extras.
- **API Gateway (WebSocket API)** — managed WebSocket with `$connect`/`$disconnect`
  routes; AWS holds the connections so you don't size a stateful fleet.
- **AppSync** — managed GraphQL (resolvers, real-time subscriptions, auth). Use
  when the contract is GraphQL and you don't want to run your own server.
- **ALB** — L7 routing for gRPC/HTTP to containers/instances when you don't need
  gateway features; pairs with `load-balancing`.

## When to pick which
REST API for rich public APIs needing keys/throttling/validation; HTTP API for
simple low-latency proxies; WebSocket API for managed push; AppSync for GraphQL;
ALB for plain gRPC/HTTP service traffic.

## Limits / things that bite (verify against current docs)
- API Gateway has a **default ~29s integration timeout** — long requests must go
  async (return 202 + poll, or push). Payloads are capped (~10 MB REST).
- Account-level and per-method **throttle/burst quotas** apply; usage plans set
  per-key rate/burst — design your rate limits to these, not above them.
- WebSocket API bills per message + connection-minute and caps idle/total
  connection duration — long-lived clients reconnect.
- Pricing differs sharply: HTTP API is much cheaper per request than REST API at
  scale.

## Pitfalls
- Putting a slow synchronous call behind the 29s timeout instead of going async.
- Assuming API Gateway gives idempotency — it doesn't; you still build the
  idempotency-key store (DynamoDB with a TTL attribute is the common fit).
- Reaching for REST API features (and cost) when HTTP API would do.
- Lock-in: AppSync resolvers and API Gateway mapping templates don't port to other
  clouds.
