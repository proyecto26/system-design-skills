# Service decomposition deep-dive

Mechanics that don't belong in the lean SKILL.md.

## Finding seams (bounded contexts)
Split by **business capability**, not technical layer. A good service owns one
bounded context end to end — its data, its rules, its API — so most changes and
transactions stay inside one service. Heuristics:
- **Data ownership:** if two "services" both write the same table, they're one
  service (shared mutable data across a boundary is the top decomposition smell).
- **Change coupling:** parts that always change together belong together.
- **Conway's law:** boundaries that don't match team ownership generate constant
  cross-team coordination — align services to teams.

## Strangler-fig migration (monolith → services)
Don't rewrite. Put a façade (gateway) in front of the monolith, then carve out
one capability at a time behind it, routing that path to the new service while
the rest stays in the monolith. Each extraction is independently shippable and
reversible. Stop when the remaining monolith is "good enough" — full
decomposition is rarely the goal.

## Gateway vs BFF vs mesh (don't conflate)
- **API gateway** — one north-south front door: auth, routing, rate limiting,
  request aggregation. Risk: it accretes business logic into a hidden monolith.
- **BFF (backend-for-frontend)** — a gateway per client type (web/mobile) so each
  gets a tailored API. Use when client needs diverge sharply.
- **Service mesh** — east-west sidecars (Envoy) giving uniform mTLS, retries,
  timeouts, and traffic shaping *without* app code. Real latency + ops overhead;
  only worth it past a dozen-ish services.

## Sync vs async between services
- **Sync (REST/gRPC):** simple, immediate result, but availability couples (a
  down callee fails the caller) and latency stacks across hops. gRPC for
  internal high-throughput typed calls; REST for broad compatibility.
- **Async (events):** the caller emits an event and moves on; consumers react.
  Decouples availability and absorbs spikes, at the cost of eventual consistency
  and harder end-to-end reasoning. Owned by `messaging-streaming`.
- Rule: use sync only when the caller genuinely needs the answer to proceed.

## Cross-service writes (no distributed ACID)
A write spanning services can't be one ACID transaction. Options (theory owned by
`consistency-coordination`):
- **Keep it local** — redesign so the write lives in one service (best).
- **Saga** — a sequence of local transactions with compensating actions on
  failure; choreographed (events) or orchestrated (a coordinator).
- **Transactional outbox** — write state + an outbox row in one local
  transaction, then relay the event reliably (avoids dual-write inconsistency).
- Avoid 2PC across services — it couples availability and scales poorly.

## Service discovery
Services need to find each other as instances come and go:
- **DNS-based** — simple, but TTL/caching lag.
- **Registry** (Consul/etcd/ZooKeeper) — services register; clients query;
  health-checked. The registry's consistency/leader-election is `consistency-coordination` territory.
- **Mesh/platform** — Kubernetes Services + a mesh handle discovery transparently.

## Granularity anti-patterns
- **Nano-services:** services so small the coordination cost dwarfs the logic.
- **Distributed monolith:** services that must all deploy together / share a
  database — all the cost of distribution, none of the independence.
- **Shared database:** multiple services on one schema — couples them invisibly;
  give each service its own store.
- **Chatty boundaries:** a single user action triggers a long synchronous chain —
  recut the boundary or batch/async it.

## Common mistakes
- Microservices on day one for a small team / unproven domain.
- Splitting by technical layer (a "database service", a "logic service") instead
  of by capability.
- A gateway that grows into the real application.
- No distributed tracing — making multi-service failures undebuggable.
