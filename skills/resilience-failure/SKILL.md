---
name: resilience-failure
description: This skill should be used when the user asks about "fault tolerance", "resilience", a "circuit breaker", "graceful degradation", "retry storm" or "thundering herd on recovery", "exponential backoff with jitter", "timeout", "bulkhead", a "single point of failure" (SPOF), "failover", or "rate limiting" (token bucket / leaky bucket / sliding window). Use it whenever a design must keep working through node crashes, slow dependencies, traffic spikes, or partial outages — i.e. any time the answer to "what happens when this breaks?" is missing, even if the user doesn't say "resilience".
---

# Resilience & Failure

Design the system so that when a part breaks — and it will — the failure is
contained and the user still gets a useful (if degraded) answer instead of an
error page or a cascading outage. Getting this wrong is the difference between a
slow dependency and a total meltdown: the most common amplifier of an outage is
the system's own reaction to it (retry storms, health-check stampedes).

## When to reach for this
Any design with a remote dependency, a shared resource, or an SLA. Reach here to
find single points of failure, decide what each call does when its dependency is
slow or down, protect a service from being overwhelmed (rate limiting), and plan
how a recovered service comes back without being crushed by the backlog.

## When NOT to
Don't wrap a single in-process function or a best-effort batch job in circuit
breakers and bulkheads — that's machinery for cross-process/cross-network calls
(YAGNI). Don't add retries to a non-idempotent write without an idempotency key
first (→ `api-design`) — you'll duplicate side effects. The cheapest design that
meets the availability target wins; chasing an extra nine you don't need costs
real complexity (→ `back-of-the-envelope` for what a nine actually buys).

## Clarify first
- **Availability target** — how many nines, and is it per-request or per-feature? (→ `back-of-the-envelope`.)
- **Blast radius** — if this dependency dies, must the whole request fail, or can the feature degrade or hide?
- **Idempotency** — is the operation safe to retry? If not, what makes it safe (key, dedup)? (→ `api-design`.)
- **Latency budget** — how long may a call wait before a timeout is better than waiting? (→ `back-of-the-envelope`.)
- **Limit dimension & policy** — rate-limit per user / IP / API key / tenant? Hard (reject) or soft (queue/shape)? Burst tolerated?

## The options
Layered defenses; most real designs combine several.

- **Timeout** — bound every remote call. Use *everywhere*; an unbounded wait is
  the root of most cascades.
- **Retry with backoff + jitter** — re-attempt transient failures with growing,
  randomized delays. Use for idempotent calls against blips; never naked retries.
- **Circuit breaker** — stop calling a dependency that's failing; fail fast and
  probe to recover. Use when a downstream is down or slow and retries would pile on.
- **Bulkhead** — isolate resources (thread pools, connection pools, queues) per
  dependency. Use so one slow dependency can't exhaust capacity shared by others.
- **Graceful degradation** — fall back to a cached/stale value, partial result,
  default, or hidden feature. Use when a usable-but-worse answer beats an error.
- **Rate limiting / load shedding** — cap inbound work; reject or shape excess.
  Use to protect a service from overload, abuse, or a stampeding caller.
- **Redundancy / failover** — run N>1 of every component; promote a standby on
  failure. Use to remove SPOFs. (Health checks/LB failover live in `load-balancing`.)

Rate-limiting algorithms (token bucket, leaky bucket, fixed/sliding window) and
the circuit-breaker state machine are detailed in `references/deep-dive.md`.

## Trade-offs

| Option | What it solves | What it worsens | Change it when |
|---|---|---|---|
| Timeout | Bounds blocked threads; stops one slow call hanging the caller | Too tight → false failures; too loose → cascades | Tune to the dependency's p99, not a guess |
| Retry + backoff + jitter | Rides out transient blips | Multiplies load; duplicates non-idempotent writes | Add jitter + cap attempts + budget; require idempotency |
| Circuit breaker | Fails fast, gives a sick dependency room to recover | Adds state/tuning; can trip on a blip and over-shed | Flapping → tune thresholds / half-open probe rate |
| Bulkhead | Contains one failure to its own pool | Lower peak utilization; more pools to size | One noisy dependency starves others |
| Graceful degradation | Keeps the user served when a dependency dies | Serves stale/partial; more code paths to test | Correctness must be exact → fail closed instead |
| Rate limiting | Protects the service; bounds cost/abuse | Rejects legitimate bursts; needs shared state at scale | Limits too strict (valid drops) or too loose (overload) |
| Redundancy / failover | Removes SPOFs; survives node/region loss | Cost, replication lag, failover consistency risk | Failover drops un-replicated writes → `consistency-coordination` |

## Behavior under stress
This block exists to stop the system from amplifying its own outage.

- **Retry storm:** a dependency slows, every caller retries, retries pile on the
  retries of callers upstream, and load multiplies geometrically. *Mitigate:*
  exponential backoff with **jitter**, a per-request **retry budget** (cap total
  attempts), and a circuit breaker so a dead dependency isn't retried at all.
- **Thundering herd on recovery:** a service comes back and every queued client
  and expired cache entry hits it at once, knocking it over again. *Mitigate:*
  half-open circuit breakers that admit a trickle, jittered client reconnect,
  request coalescing, and slow-start ramp. (Cache-expiry stampede is `caching`.)
- **Health-check stampede / accidental DDoS:** aggressive health checks or
  load-balancer probes hammer a recovering instance. *Mitigate:* gentle probe
  intervals, fail-fast readiness, and draining. (Probe mechanics → `load-balancing`.)
- **Timeout-less cascade:** one slow dependency holds threads until the pool is
  exhausted, and the caller now looks "down" to *its* callers. *Mitigate:*
  timeouts + bulkheads everywhere.
- **Rate-limiter as SPOF:** a shared counter store (e.g. Redis) for limits goes
  down. *Mitigate:* fail-open (allow on limiter error) for availability, or
  fail-closed for protection — decide deliberately.

**Monitor:** error rate and p99 per dependency, retry counts, circuit-breaker
state transitions, pool saturation/queue depth, rate-limit rejection rate, and
"time to first success" after a recovery.

## How to apply
1. **Clarify the inputs** — pin the availability target, blast radius per
   dependency, idempotency, latency budget, and the rate-limit dimension/policy
   (the "Clarify first" list). No defense is chosen before these are answers.
2. **Pick the defenses** — walk the trade-off table per dependency, not globally.
   Every remote call gets a *timeout*; add retry+jitter only where idempotent; add
   a *circuit breaker* where a sick downstream would pile on; *bulkhead* shared
   pools; choose *degrade* vs *fail closed* by whether a stale answer is acceptable.
3. **Set the key knobs** — timeout = the dependency's measured p99; retry cap
   (often 2–3) plus a per-request budget and jitter; breaker open/half-open
   thresholds; bulkhead pool sizes; limiter rate/burst and fail-open-vs-closed.
4. **Stress-test the design** — replay each amplifier from "Behavior under stress"
   (retry storm, recovery herd, health-check stampede, timeout-less cascade,
   limiter-as-SPOF) and confirm a mitigation is in place for each.
5. **Size with numbers** — compute composed availability along the request path
   (series multiplies, parallel adds nines) and confirm the target is met without
   over-provisioning. (→ `back-of-the-envelope`.)
6. **Pick a provider** — default to the generic recipe; only read a provider file
   if the user named a cloud (see "Choosing a provider").

## Dos and don'ts
**Do**
- Bound every remote call with a timeout tuned to the dependency's p99.
- Add jitter and a retry budget so re-attempts can't multiply into a storm.
- Make a degraded response explicit (`stale: true`) instead of a silent lie.
- Decide fail-open vs fail-closed deliberately for limiters and breakers.
- Stress-test against the amplifiers before calling the design resilient.

**Don't**
- Retry a non-idempotent write without an idempotency key (→ `api-design`).
- Wrap in-process calls in breakers/bulkheads — that's cross-network machinery.
- Chase an extra nine the SLA doesn't require; redundancy cost is non-linear.
- Let a shared limiter or counter store become an unguarded single point of failure.
- Hammer a recovering instance with aggressive health checks or full reconnects.

## Numbers that matter
Tie timeouts to the dependency's measured **p99**, not a round guess. Cap retries
(often 2–3) and apply a budget so total attempts can't explode. Each extra
"nine" of availability costs disproportionately more redundancy — know what a
nine actually buys before targeting it. Composed availability matters: components
in series multiply (two 99.9% deps in a request path ≈ 99.8%), redundant
components in parallel add nines. For all of these — latency tables, the nines
table, series/parallel availability math — see `back-of-the-envelope`.

## Interface sketch
Two contracts are load-bearing here.

- **Degraded response:** make "I'm degraded" explicit, not a silent lie. Return
  the fallback plus a signal, e.g. `{ "data": [...], "stale": true, "source":
  "cache", "as_of": "2026-05-29T10:00Z" }` so callers and clients can react.
- **Rate-limit response:** reject with HTTP `429 Too Many Requests` and standard
  headers — `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `Retry-After`
  (seconds) so a well-behaved client backs off instead of retrying into the wall.

## Choosing a provider
Default to the generic recipe above (resilience libraries, a token-bucket/leaky-
bucket limiter, health checks, N+1 redundancy). If the user names a cloud, read
`references/providers/<provider>.md` for the managed-service mapping, quotas/limits,
and provider-specific trade-offs. If no file exists for that provider, the generic
recipe is the answer.

## Diagram
To visualize a fallback path (gateway → timeout on primary → dashed arrow to
cache/default) or a circuit-breaker state machine, use the in-plugin
`architecture-diagram` skill; draw the degraded path as a dashed arrow and the
failed dependency in the error color.

## Related building blocks
- `messaging-streaming` — *pairs with* this: a queue absorbs a write spike and a dead-letter queue contains poison messages; *owned-concept lives in* it for delivery guarantees and DLQ mechanics.
- `load-balancing` — *depends on* it for health checks and LB-level failover routing; pair its probes with the redundancy here to remove SPOFs.
- `consistency-coordination` — *owned-concept lives in* it: the consistency consequences of failover (un-replicated writes lost, quorum under partition) are decided there.
- `api-design` — *depends on* its idempotency-key contract before any retry of a write is safe.
- `caching` — *pairs with* graceful degradation as a fallback source; *owned-concept lives in* it for the cache-expiry stampede (vs. the recovery herd here).
- `system-design` — *feeds into* the orchestrator; this block is its step-5 failure-mode check.

## References
- **`references/deep-dive.md`** — circuit-breaker state machine, backoff/jitter formulas, retry budgets, the five rate-limiting algorithms (token bucket, leaky bucket, fixed/sliding window) with distributed-counter and race-condition handling, bulkhead sizing, SPOF analysis and failover modes. Read when designing the resilience layer in detail.
- **`references/providers/{generic,aws,azure,gcp,temporal}.md`** — service mappings, limits, and pitfalls per environment; `temporal.md` covers durable retries/timeouts and saga compensation as workflow primitives.
