# Requirements — <system name>

Fill this before drawing anything. Vague prompts become concrete constraints
here. Keep it to what changes the design (YAGNI).

## Functional requirements (core)
What the system does, from the user's view. Pick 2–4 core features; defer the rest.
- [ ] …
- [ ] …

## Non-functional requirements
The numbers and qualities that shape the design.
- **Scale:** DAU/MAU, growth in 3/6/12 months.
- **Read vs write:** ratio; which dominates.
- **Latency target:** e.g. p99 < 200 ms for reads.
- **Availability:** target (e.g. 99.9%); tolerance for downtime.
- **Consistency:** strong vs eventual; read-your-writes needed?
- **Durability:** can data ever be lost? RPO/RTO if relevant.
- **Security / regulatory:** PII, encryption, data residency.

## Out of scope (explicit)
What is deliberately not designed, to keep the core in scope.
- …

## Assumptions
Anything answered with "assume X" — these are load-bearing; revisit if challenged.
- …

## Key numbers (→ back-of-the-envelope)
- Peak read QPS · Peak write QPS · Storage/day · Storage/year · Bandwidth · Working set.

---
### Validation (fill-in gate)
- [ ] **At least one item is in Out of scope** — if nothing is excluded, the scope is too broad.
- [ ] Every non-functional requirement has a **number or an explicit "n/a"** (no "high"/"fast").
- [ ] Assumptions are written down (they're load-bearing and will be referenced).
- [ ] Core features are **2–4**, not the whole product.
