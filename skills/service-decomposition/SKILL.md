---
name: service-decomposition
description: This skill should be used when the user asks "monolith vs microservices", how to "split into services", set "service boundaries", find the right "service granularity", design an "API gateway / BFF", do "service discovery" or add a "service mesh", or worries that services are "too chatty" / "too fine-grained". It gives the recipe for carving a system into services (or deciding not to) and wiring how they find and call each other. Use it whenever a design has more than one service — or someone is tempted to add more — even if the user doesn't say "microservices".
---

# Service Decomposition

Decide how to carve a system into deployable services — or whether to — and how
those services find and call each other. This is the "application layer" of a
design: it sits between the edge (`dns`/`load-balancing`/`content-delivery`) and
the data tier. Getting the *granularity* wrong is one of the most expensive
mistakes in distributed systems, in both directions.

> The trap cuts both ways. One giant service can't scale teams or components
> independently; a swarm of tiny ones drowns you in network hops, partial
> failures, and undebuggable cross-service traces. The skill is finding the
> sweet spot for *this* system at *this* size — not maximizing service count.

## When to reach for this
A second service is on the table; teams need to deploy independently; one part has
a wildly different scaling profile than the rest; or an existing system is "too
chatty" / hard to change. Also when someone proposes "microservices" by default.

## When NOT to
A new product / small team / unproven domain — start with a **monolith** (or a
modular monolith) and split later when a real seam and a real reason appear.
Splitting prematurely buys distributed-systems cost (network failure, eventual
consistency, ops) to solve a problem you don't have yet (YAGNI, GUIDE #7). Don't
add a gateway/mesh/discovery layer before you have services that need them.

## Clarify first
- **Team & deploy independence** — must parts ship on separate cadences/owners?
- **Differential scale** — does one component need 100× the others' resources?
- **Coupling** — which parts change together (belong together) vs evolve apart?
- **Latency budget** — how many in-process calls would become network hops?
- **Consistency across the seam** — can the split tolerate eventual consistency
  between services? (→ `consistency-coordination`)

## The options
- **Monolith** — one deployable. Use when: new/small, fast iteration, strong
  cross-module transactions, one team.
- **Modular monolith** — one deployable, enforced internal module boundaries.
  Use when: you want clean seams *without* network cost yet — the best default
  for "we might split later."
- **Microservices** — many small deployables split by business capability /
  bounded context. Use when: independent deploy/scale/ownership genuinely pays
  for the distributed-systems tax.
- **Comms style** — decide only whether a given seam is **synchronous** (REST/gRPC,
  request/response, simple but couples availability) or **asynchronous** (decoupled
  but eventually consistent). This block decides *sync-or-async per seam*; it does
  **not** own the async mechanics — once a seam is async, **invoke
  `messaging-streaming`** for the delivery guarantees, ordering, backpressure, and
  DLQ semantics that make it safe. Don't pick async from the one-line "no immediate
  answer needed" rule without opening those failure modes. Most systems are a mix.
- **Edge of the service tier** — an **API gateway / BFF** (one front door:
  auth, routing, rate limiting, aggregation) vs direct exposure.
- **Finding each other** — **service discovery** (registry: DNS-based, or
  etcd/Consul/ZooKeeper) and optionally a **service mesh** (sidecars for mTLS,
  retries, traffic shaping) vs library-level clients.

## Trade-offs

| Option | What it solves | What it worsens | Change it when |
|---|---|---|---|
| Monolith | Simplicity; in-process calls; easy transactions/debugging | Couples deploy/scale; one team bottleneck; blast radius | Teams/scale profiles diverge → modular monolith → split a seam |
| Modular monolith | Clean boundaries, no network cost, split-later optionality | Still one deploy; discipline required to keep modules clean | A module needs independent deploy/scale → extract it to a service |
| Microservices | Independent deploy/scale/ownership per capability | Network failure, eventual consistency, distributed debugging, ops | Coordination/latency cost exceeds the independence benefit → merge |
| Sync comms | Simple mental model, immediate result | Availability couples (caller fails if callee does); latency stacks | A call doesn't need an immediate answer → async (`messaging-streaming`) |
| API gateway / BFF | One front door for auth/routing/rate-limit/aggregation | A new tier + potential SPOF/bottleneck; can become a mini-monolith | It accretes business logic → push logic back into services |
| Service mesh | Uniform mTLS/retries/observability without app changes | Real operational + latency overhead (sidecars) | A handful of services → a library/gateway is enough |

## Behavior under stress
- **Chatty services / fan-out:** one user request becomes N synchronous internal
  calls; tail latency compounds and a single slow dependency stalls the chain.
  *Mitigate:* coarser boundaries, batching, async where an answer isn't needed
  now, and circuit breakers (→ `resilience-failure`).
- **Distributed-transaction pain:** a write spanning services can't be one ACID
  transaction. *Mitigate:* saga / outbox, or **keep the data in one service** so
  the transaction stays local (→ `consistency-coordination`).
- **Retry storms across the mesh:** naive retries amplify an overload into a
  cascade. *Mitigate:* backoff+jitter, budgets, circuit breakers (→ `resilience-failure`).
- **Debuggability collapse:** with no correlation IDs/tracing, a failure that
  crosses 6 services is invisible. *Mitigate:* distributed tracing + correlation
  IDs from day one (→ `observability`, `distributed-logging`).
- **Gateway/discovery as SPOF:** if the front door or registry dies, everything
  does. *Mitigate:* redundancy, client-side caching of discovery, health checks.

## How to apply
1. **Clarify the drivers** — independent deploy? differential scale? team
   ownership? If none are real yet, stop: a (modular) monolith wins.
2. **Default to the simplest that fits** — monolith → modular monolith →
   extract the one seam that has a real reason — not "everything is a service".
3. **Cut boundaries by business capability / bounded context**, so data and the
   logic that owns it stay together (minimizes cross-service transactions).
4. **Choose comms per call** — sync only when the caller needs an immediate
   answer; async otherwise (→ `messaging-streaming`).
5. **Add the front door + discovery only when warranted** — gateway/BFF for
   auth/routing/aggregation; discovery/mesh when service count makes static
   wiring painful.
6. **Stress-test the seams** — walk chattiness, cross-service transactions, retry
   cascades, and tracing before committing.

## Dos and don'ts
**Do**
- Start with a monolith / modular monolith; split a seam only when a real driver appears.
- Split by business capability so a service owns its data (keeps transactions local).
- Give every cross-service call a correlation ID + tracing from the start.
- Right-size: fewer, well-bounded services beat many tiny chatty ones.

**Don't**
- Don't choose microservices by default or for résumé reasons (GUIDE #7).
- Don't create a service whose write needs another service's data in the same transaction.
- Don't let the API gateway accrete business logic into a hidden monolith.
- Don't add a service mesh for a handful of services — the overhead outweighs it.

## Numbers that matter
Each sync hop adds a same-datacenter round trip (~0.5 ms) **plus the callee's own
work**. 10 serial hops is only ~5 ms of *network* — the real cost is the compounded
**p99/serialization/queueing/retry tail**: each hop multiplies the chance of
hitting a slow dependency, so end-to-end p99 degrades far faster than the mean.
Size the call-graph depth and the per-hop p99 (not just the network) before
splitting, with explicit p99 budgets. → `back-of-the-envelope`.

## Interface sketch
A service boundary is a contract: the **owned data** (which service is the source
of truth for each entity), the **API** it exposes (→ `api-design`), and the
**events** it emits (→ `messaging-streaming`). Write down "who owns user records,
who owns orders" before drawing service boxes — shared mutable data across a
boundary is the #1 decomposition smell.

## Choosing a provider
Default to the generic recipe above. If the user names a cloud, read
`references/providers/<provider>.md` for the managed gateway / discovery / mesh
mapping, limits, and trade-offs. If no file exists for that provider, the generic
recipe is the answer.

## Diagram
To visualize the service tier (gateway → services → their data, with sync vs async
edges and trust boundaries), use the in-plugin `architecture-diagram` skill.

## Related building blocks
- `api-design` — *pairs with* this: decomposition sets the boundaries, `api-design` defines each service's contract.
- `messaging-streaming` — *pairs with* this for async/event-driven comms between services (the alternative to sync coupling).
- `consistency-coordination` — *owns* the cross-service consistency story (saga/2PC) and the coordination theory behind **service discovery** (leader election, etcd/Consul/ZooKeeper); link there, don't re-teach.
- `resilience-failure` — *depends on* this: circuit breakers, timeouts, bulkheads keep a chatty mesh from cascading.
- `observability` + `distributed-logging` — *feed into* this: tracing + correlation IDs are what make a multi-service request debuggable.
- `scaling-evolution` — *feeds into* this: extracting a service is a scaling move on the "split a seam" rung.
- `system-design` — the orchestrator.

## References
- **`references/deep-dive.md`** — bounded contexts & how to find seams, the strangler-fig migration from monolith, gateway vs BFF vs mesh, sync-vs-async decision detail, saga/outbox for cross-service writes, and the granularity anti-patterns (nano-services, distributed monolith, shared database).
- **`references/providers/{generic,aws,azure,gcp}.md`** — gateway / service-discovery / mesh service mappings, limits, and pitfalls per environment.
