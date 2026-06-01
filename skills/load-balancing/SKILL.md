---
name: load-balancing
description: This skill should be used when the user adds a "load balancer", asks about "L4 vs L7" (transport vs application layer), picks a balancing algorithm ("round robin", "least connections", "weighted", "IP hash"), configures "health checks", needs "sticky sessions" / "session affinity", adds a "reverse proxy", does "SSL/TLS termination", spreads "traffic distribution" across an "autoscaling group", or wants a stateless web tier behind a single entry point. Use it whenever a design has more than one server behind one address, or a single box is the entry-point bottleneck or SPOF, even if the user doesn't say "load balancer".
---

# Load Balancing

Spread incoming requests across a pool of identical backends so no single server
is the bottleneck or the single point of failure. Get it wrong and the balancer
becomes the SPOF it was meant to remove, routes traffic to dead servers, or
*amplifies* an outage by hammering a backend that is already on its knees.

## When to reach for this
Reach for a balancer when more than one backend serves the same role and traffic
must be split across them; when a single entry point is a SPOF to eliminate; to
add or remove servers without clients noticing (the enabler for the stateless tier
and autoscaling); or to put one public address in front of a private fleet, with
TLS termination, health-gating, and routing in one place.

## When NOT to
One backend that comfortably handles peak load needs no balancer yet — adding one
is a new component, a new failure mode, and a new thing to operate (YAGNI). If the
real bottleneck is the database or a single hot shard, a balancer in front of the
web tier solves nothing; diagnose the actual constraint first (→ `back-of-the-envelope`).
Cross-region traffic steering is usually DNS/anycast at the edge, not an L4/L7
balancer (→ `content-delivery`). Per-client request limiting is a policy concern
owned by `resilience-failure`, not the balancing algorithm.

## Clarify first
- **Protocol & layer need** — raw TCP/UDP throughput (L4) or HTTP-aware routing by
  path/host/header/cookie (L7)? This picks the balancer type.
- **State** — is the backend stateless, or does a session live on one server
  (forcing affinity)? Moving state out is almost always the better answer.
- **Peak QPS & connection count** — one fat connection stream or many short
  requests? Drives algorithm and balancer sizing (→ `back-of-the-envelope`).
- **Health signal** — what does "healthy" mean (TCP accept? a `/healthz` 200? a
  deep dependency check?) and how fast must a dead node leave the pool?
- **TLS** — terminate at the balancer (offload backends, inspect L7) or pass
  through end-to-end (compliance/mTLS)?

## The options

**Layer of inspection**
- **L4 (transport):** route by IP/port; forward packets via NAT or DSR without
  reading payload. Use when you need raw throughput, non-HTTP protocols, or the
  lowest added latency.
- **L7 (application):** terminate the connection, read HTTP (host, path, headers,
  cookies), then route. Use when you need content-based routing, per-route pools,
  TLS termination, or request rewriting.

**Distribution algorithm**
- **Round robin / weighted round robin:** even rotation, weighted by capacity.
  Use for uniform, stateless backends.
- **Least connections / least response time:** send to the least-busy node. Use
  when request cost varies widely (long-lived connections, mixed workloads).
- **IP hash / consistent hash:** map a client (or key) to a stable backend. Use
  for affinity without server-side session storage, or to keep cache locality.
- **Random (two-choices):** pick two at random, take the lighter — cheap and
  surprisingly even at scale.

**Topology**
- **Active-passive:** one balancer serves, a standby takes the VIP on failure.
  Simple HA.
- **Active-active:** multiple balancers share load (via DNS or anycast). Removes
  the balancer's own SPOF and adds headroom.

**Reverse proxy role:** an L7 balancer is also a reverse proxy — one public face
that hides backends, terminates TLS, compresses, caches, and centralizes routing.
A reverse proxy is worth it even with a single backend for those benefits;
load balancing is the multi-backend case of the same component.

## Trade-offs

| Option | What it solves | What it worsens | Change it when |
|---|---|---|---|
| L4 balancing | Max throughput, low latency, any protocol | Blind to content; no path/header routing, no TLS inspection | You need content-based routing or TLS termination → L7 |
| L7 balancing | Content routing, TLS offload, rewrites, observability | Higher latency/CPU; terminates connections (more state) | Raw throughput dominates and routing is trivial → L4 |
| Round robin | Dead simple, even for uniform work | Ignores actual load; a slow node still gets its share | Request costs vary a lot → least-connections |
| Least connections | Adapts to uneven request cost | Needs live connection state; can herd onto a just-recovered node | Backends are uniform → round robin is enough |
| IP/consistent hash | Affinity & cache locality without session store | Uneven spread; rebalances on pool change | You can externalize state → round robin + shared store |
| Sticky sessions | Works with stateful backends today | Breaks even spread, complicates scale-in, loses session on node death | State can move to Redis/DB → drop affinity |
| Active-passive | Simple HA for the balancer | Idle standby; failover gap (seconds) | You need zero-gap headroom → active-active |

## Behavior under stress
The balancer sits in the request path of *everything*, so its failure modes are
the whole system's failure modes.

- **Health-check stampede (the classic foot-gun):** a backend recovers, the
  balancer marks it healthy, and the full firehose hits a single cold node — empty
  caches, cold JIT, full connection backlog — so it fails its next health check
  and drops out, oscillating (flapping). Aggressive checks can effectively *DDoS a
  recovering service*. Mitigate with **slow-start / connection ramping**, generous
  failure thresholds (N strikes before eviction, M before re-admission), check
  jitter, and a circuit breaker on the dependency path (→ `resilience-failure`).
- **Retry amplification:** the balancer (or clients) retries failed requests onto
  the *remaining* healthy nodes, so losing one node can cascade as the survivors
  absorb its load plus the retries. Cap retries; use backoff with jitter (owned by
  `resilience-failure`).
- **Uneven load / hot backend:** long-lived connections or sticky sessions pin
  load to a few nodes; round robin can't see it. Watch per-backend utilization,
  not just the aggregate.
- **Balancer as SPOF:** a single balancer failing takes everything down. Run it
  active-active or active-passive with a fast VIP/anycast failover.
- **Thundering reconnect:** if the balancer restarts, every client reconnects at
  once. Stagger draining and connection limits.

**Monitor:** per-backend request rate and latency (p99), healthy-host count,
health-check pass/fail and flap rate, connection counts, 5xx rate at the balancer
vs. at backends (divergence localizes the fault), and active connection
distribution.

## How to apply
1. **Clarify the inputs** — answer the *Clarify first* questions: protocol/layer,
   whether the backend is stateless, peak QPS and connection count, what "healthy"
   means, and the TLS posture. These pin every later choice.
2. **Pick the layer and algorithm from the trade-off table** — choose L4 for raw
   throughput/non-HTTP, L7 for content routing or TLS offload. Default to round
   robin for uniform stateless backends; reach for least-connections only when
   request cost varies, and hash-based affinity only when state can't move yet.
3. **Set the key knobs** — write the health check concretely (method, path,
   expected code, interval, fail/recover thresholds) and the pool's drain delay;
   enable slow-start so a recovering node ramps instead of taking the firehose.
4. **Stress-test the choice** — walk the failure modes: health-check stampede,
   retry amplification, hot backend, and the balancer as SPOF. Add active-active
   (or active-passive with fast VIP/anycast failover) so the balancer is not the
   new single point of failure.
5. **Size with numbers** — confirm the balancer handles peak QPS and concurrent
   connections, and verify the *backend* fleet (not the balancer) is the binding
   constraint. Pull per-server QPS and connection-memory figures from
   `back-of-the-envelope`.
6. **Pick a provider** — default to the generic recipe; if a cloud is named, read
   its provider file for the managed-service mapping and limits.

## Dos and don'ts
**Do**
- Push session state into a shared store so plain round robin and autoscaling work.
- Define health checks explicitly and choose shallow-vs-deep on purpose.
- Run the balancer active-active or active-passive so it is not a SPOF.
- Enable slow-start and generous fail/recover thresholds to stop flapping.
- Watch per-backend utilization, not just the aggregate, to catch hot nodes.

**Don't**
- Don't add a balancer for a single backend that handles peak (YAGNI) — a reverse
  proxy may still be worth it, but multi-backend balancing is not.
- Don't let a deep health check on a slow dependency evict the whole fleet at once.
- Don't reach for sticky sessions when the state can move out of the box.
- Don't retry blindly into the surviving nodes; cap retries and use backoff/jitter.
- Don't assume the balancer is the bottleneck before confirming the backend fleet is.

## Numbers that matter
A modern software balancer (HAProxy/Nginx/Envoy) handles tens of thousands of
requests/sec and many thousands of concurrent connections per instance — usually
well above a single web/app node, so it is rarely the first bottleneck. Size it
against peak QPS and concurrent connections, and confirm the *backend* fleet (not
the balancer) is the binding constraint. Per-server QPS rates, connection-memory
cost, and peak-factor math live in `back-of-the-envelope` — don't restate them
here; pull the figures from there to size the pool and the balancer.

## Interface sketch
Load balancing has no request/response contract of its own, but two configs are
load-bearing and worth writing down concretely:
- **Health check:** method + path + expected code + interval + thresholds, e.g.
  `GET /healthz → 200, every 5s, unhealthy after 3 fails, healthy after 2 passes`.
  Make `/healthz` shallow (process alive) vs. deep (checks DB) deliberately — a
  deep check that fails on a slow dependency can evict the whole fleet at once.
- **Backend pool / target group:** the set of `host:port` targets, weights, and
  the drain/deregistration delay used on scale-in so in-flight requests finish.

## How load balancing enables the stateless tier
Spreading requests freely across interchangeable servers only works if any server
can serve any request — i.e. no session state lives on the box. Push session/state
into a shared store (Redis/DB) so the balancer can use plain round robin, add or
remove nodes at will, and let an autoscaling group grow/shrink the pool. Sticky
sessions are the fallback when state *can't* move yet, at the cost of even spread
and easy scale-in. The horizontal-scale and stateless-tier story is owned by
`scaling-evolution`; this skill is the mechanism that makes it routable.

## Choosing a provider
Default to the generic recipe above. If the user names a cloud, read
`references/providers/<provider>.md` for the managed-service mapping,
quotas/limits, and provider-specific trade-offs. If no file exists for that
provider, the generic recipe is the answer.

## Diagram
To visualize the request path (client → balancer → backend pool) or the
health-check/failover flow, use the in-plugin `architecture-diagram` skill. A
quick inline sketch — `client → [LB] → {web1, web2, web3} → shared state` — is
fine for reasoning; do not embed Mermaid.

## Related building blocks
- `scaling-evolution` — *feeds into* this: it owns the stateless tier and
  horizontal vs. vertical scaling, and this skill is the routing mechanism that
  makes that fleet addressable.
- `resilience-failure` — *pairs with* this whenever the balancer can amplify an
  outage; *owned-concept lives in* it — retries/backoff/jitter, circuit breakers,
  failover, and rate limiting are the cure for health-check stampedes and retry storms.
- `content-delivery` — *alternative to* this for cross-region traffic: when
  "balancing" is really steering users to the nearest region, geo/DNS/anycast at
  the edge (owned there) is the right tool, not an L4/L7 balancer.
- `back-of-the-envelope` — *depends on* it for the QPS, connection, and
  peak-factor numbers that size the pool and the balancer.
- `system-design` — the orchestrator that routes here when a design grows past one
  server.

## References
- **`references/deep-dive.md`** — L4 NAT vs. DSR, how L7 termination works, the
  algorithm internals (incl. consistent hashing for affinity), health-check tuning
  and slow-start, connection draining, TLS termination vs. passthrough. Read when
  configuring a balancer in detail.
- **`references/providers/{generic,aws,azure,gcp}.md`** — service mappings, limits,
  and pitfalls per environment.
