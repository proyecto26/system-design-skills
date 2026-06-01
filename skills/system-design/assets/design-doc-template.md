# Design: <system name>

A write-up structured around the reasoning loop, so trade-offs and failure
behavior are first-class — not footnotes. Keep each section tight.

## 1. Problem & scope
Core functional requirements, key non-functional constraints, and explicit
out-of-scope. (See the requirements template.)

## 2. Scale estimates
Peak read/write QPS, storage/day and /year, bandwidth, working set. State the
assumptions behind each number. What the numbers force (sharding? caching?
queues?).

## 3. API (entry points)
The core endpoints with concrete request/response shapes, pagination, and
idempotency where it matters. Vague boxes become real here.

## 4. High-level design
A diagram of components and data flow — render it with the `architecture-diagram`
skill (list the components with their types, the directed connections with
labels, and any region groupings). For each component, one line: *what
requirement or number it satisfies.* Add nothing that isn't earning its place.

## 5. Data model
Stores chosen (and why — SQL/NoSQL), primary/sort keys, indexes, and the
partition/shard key with its access patterns.

## 6. Key decisions & trade-offs
For each major choice, a row: **solves / worsens / when I'd change it.** Name the
breaking point of the design.

| Decision | Solves | Worsens | Change it when |
|---|---|---|---|
| | | | |

## 7. Failure modes & degradation
SPOFs, the degradation story per dependency (fall back to cache / partial / hide),
and recovery without stampede. What the user experiences during each failure.

## 8. Scale evolution
The current bottleneck, and what changes at the next order of magnitude (10×/100×).
What metric signals it's time to evolve.

## 9. Open questions
Assumptions to confirm; things deferred for time.

---
### Validation (fill-in gate — check before sharing)
- [ ] Every row in §6 Key decisions has a **non-empty "Worsens"** and a breaking point.
- [ ] §2 estimates carry **units** and state their assumptions.
- [ ] §7 names a **degradation path** for each critical dependency (not just "retry").
- [ ] Each component in §4 ties to a **requirement or number** in §1–§2 (nothing unjustified).
- [ ] The coverage sweep ran: media / IDs / search / logs / SLOs each addressed **or explicitly deferred**.
