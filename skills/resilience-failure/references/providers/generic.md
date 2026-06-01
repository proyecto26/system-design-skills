# Resilience & failure — generic (vendor-neutral / self-host)

The default answer when no cloud is named. Maps the SKILL.md options to
open-source / library implementations you run yourself.

## Service mapping
- **Timeouts, retries, circuit breakers, bulkheads** — a resilience library in
  the app: Resilience4j (JVM), Polly (.NET), Hystrix-style wrappers, `tenacity`
  (Python), `failsafe`. Or a service mesh (Envoy/Istio, Linkerd) that applies
  timeouts, retries-with-budget, circuit breaking, and outlier ejection at the
  proxy — no app code, language-agnostic.
- **Rate limiting** — counters in **Redis** (`INCR`/`EXPIRE`, or a Lua script /
  sorted set for atomic sliding windows). At the edge: Nginx `limit_req` (leaky
  bucket), HAProxy stick-tables, Envoy global rate limiting, or an API gateway
  (Kong, APISIX) with a token-bucket plugin.
- **Health checks & failover routing** — owned by `load-balancing` (HAProxy/Nginx
  health checks, Keepalived/VRRP for a floating IP). Pair with N+1 redundancy here.
- **Redundancy** — run ≥2 of every stateless instance behind the LB; for stateful
  tiers use replication + a promotion mechanism (→ `data-storage`,
  `consistency-coordination`).
- **Queue-based containment** — a broker (Kafka/RabbitMQ) to absorb spikes and a
  DLQ for poison messages → `messaging-streaming`.

## Limits / things that bite (verify against current docs)
- A **single Redis** holding rate-limit counters is itself a SPOF and a hot key;
  replicate it, and decide fail-open vs fail-closed if it's unreachable.
- Nginx `limit_req` is per-worker/per-instance unless backed by shared state —
  N instances multiply the effective limit by N.
- Service-mesh retries can **stack** with app-level retries (retries-of-retries);
  enable retries in exactly one layer, with a budget.
- Library defaults are often "infinite timeout / unlimited retries" — the unsafe
  default; set them explicitly.

## Provider-specific trade-offs
- A **service mesh** centralizes resilience config (one policy, all services) at
  the cost of sidecar latency/ops overhead; a **library** is leaner but
  per-language and per-service to wire up.
- Self-hosting means you own failover testing, counter-store HA, and capacity —
  no managed safety net.

## Pitfalls
- Configuring retries in both the mesh and the app (multiplicative load).
- Per-instance rate limits that don't add up to the intended global limit.
- A breaker with no fallback wired in — fail-fast into an error, not a degraded
  answer.
- One shared connection/thread pool across dependencies (no bulkhead).
