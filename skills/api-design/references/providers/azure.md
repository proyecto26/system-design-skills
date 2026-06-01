# API design — Azure

## Service mapping
- **API Management (APIM)** — managed API gateway: versioning/revisions, products
  + subscription keys, rate-limit/quota policies, request/response transformation,
  validation. The default front for public REST/gRPC/GraphQL contracts.
- **Application Gateway** — L7 load balancer with WAF and path/host routing;
  supports WebSocket and gRPC pass-through. Use for service traffic when you don't
  need APIM's full policy layer (pairs with `load-balancing`).
- **Web PubSub / SignalR Service** — managed WebSocket/real-time push; Azure holds
  the connections so you don't run a stateful fleet.
- **APIM** also fronts GraphQL (pass-through or synthetic) with the same policy
  engine.

## When to pick which
APIM when you need versioning, keys/quotas, and policy transforms on a public API;
Application Gateway for WAF + L7 routing of plain HTTP/gRPC/WebSocket; Web
PubSub/SignalR for managed push without operating connection servers.

## Limits / things that bite (verify against current docs)
- APIM throughput, policy complexity, and features are **tier-bound** (Consumption
  vs Developer vs Standard/Premium); Consumption is serverless but has cold-start
  and feature gaps, Premium adds VNet + multi-region.
- Rate-limit/quota policies are enforced **per APIM instance/scope** — multi-region
  or scaled-out APIM needs care to enforce a single global limit.
- APIM request timeout and body-size caps apply; long calls must go async.
- Web PubSub/SignalR bill per connection + message and cap concurrent connections
  per tier.

## Pitfalls
- Choosing a low APIM tier then needing VNet/multi-region (a tier migration).
- Assuming APIM provides idempotency — it doesn't; build the idempotency-key store
  yourself (Cosmos DB / Redis with TTL).
- Treating per-instance rate limits as global across a scaled-out deployment.
- Lock-in via APIM policy expressions and named-value config that don't port out.
