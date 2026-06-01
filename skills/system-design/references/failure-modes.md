# The ten failure modes (and their antidotes)

These are the reasons strong engineers get rejected in design discussions. None
of them is "the design was wrong." They are *signal* failures — the design may be
fine, but the reasoning behind it isn't visible or isn't sound. Use this list two
ways: as a pre-flight check on your own design, and as a diagnosis when a design
"isn't landing."

---

### 1. Inadequate distributed-systems fundamentals
The hidden risk surfaces on a small change: "you chose leader-follower
replication — what happens to consistency during a network partition?" The strong
move is to name the trade immediately: reject writes to preserve invariants
(consistency-first) **or** accept local writes and reconcile later
(availability-first). **Antidote:** build intuition for CAP, replication/quorum,
strong vs eventual consistency, SQL vs NoSQL. → skills `consistency-coordination`,
`data-storage`.

### 2. Treating building blocks as opaque primitives
Naming a cache/queue/DB to "solve" a bottleneck collapses under "why that one,
and how does it behave under a spike?" **Antidote:** know each block's mechanics
under stress — eviction policies, delivery guarantees, health-check behavior,
connection pooling. Every block skill has a "Behavior under stress" section for
exactly this. → `caching`, `messaging-streaming`, `load-balancing`, `data-storage`.

### 3. Rushing to design without clarifying
Applying a familiar solution to an unread problem. The tell: when load doubles,
the answer is "add more servers" instead of *diagnosing the bottleneck*.
**Antidote:** always state functional requirements, non-functional constraints,
and out-of-scope before drawing. → skill `requirements-scoping`.

### 4. Weak trade-off articulation
"Design by name-dropping" — listing Kafka, DynamoDB without context. **Antidote:**
for every choice, answer *what it solves / what it worsens / when I'd change it.*
→ reference `tradeoff-framework.md`.

### 5. No sense of scale or numbers
"High traffic" is meaningless. 1k vs 1M QPS are different systems. **Antidote:**
back-of-the-envelope before committing — peak QPS, storage/day and /year, working
set. Let the numbers force the architecture (sharding, replicas, queues). → skill
`back-of-the-envelope`.

### 6. Ignoring failure modes and degradation
Designs that assume infinite uptime are incomplete. "More retries" amplifies
outages. **Antidote:** SPOF check, explicit degradation story (fall back to a
cached/trending list rather than error), recovery without stampede. Availability
often beats correctness — serve stale over failing. → skill `resilience-failure`.

### 7. Over-indexing on the "correct" architecture
Hunting for the canonical diagram; treating Kafka/sharding as defaults regardless
of prompt. If a small constraint change collapses the whole design, it was
memorized. **Antidote:** treat the architecture as a *hypothesis*; each component
exists to satisfy a *current* constraint. Narrate the loop, don't optimize for a
diagram. → skill `scaling-evolution`.

### 8. Weak API and data-model thinking
A "NoSQL" box solves nothing without a primary key and access patterns. Vague
"fetch the feed" / "store posts" fail under concrete questions. **Antidote:**
write the request, response, primary/sort key, pagination, and idempotency.
Constraints become real at the interface. → skills `api-design`, `data-storage`.

### 9. Treating it as a presentation, not a collaboration
Monologuing and defending every challenge as an attack. **Antidote:** propose,
invite the hint, adapt. The discussion should feel like a design review between
teammates. → reference `collaboration-playbook.md`.

### 10. Inability to course-correct when constraints change
Sunk-cost defense of outdated assumptions. A constraint change is an invitation,
not a trick. **Antidote:** name which assumption the new constraint invalidates,
then redesign the affected part (e.g. long-polling → push). Senior engineers
discard solutions when the problem changes. → reference `collaboration-playbook.md`.

---

## Self-assessment checklist

Run this over any design:

- [ ] **Fundamentals** — can I explain the consistency/replication/sharding
      trade-offs without buzzwords?
- [ ] **Building blocks** — do I know how each chosen component behaves under load
      and failure?
- [ ] **Requirements** — did I state functional, non-functional, and out-of-scope
      before designing?
- [ ] **Trade-offs** — for each major decision: solves / worsens / when-to-change?
- [ ] **Numbers** — did I anchor with rough QPS, storage, and growth estimates?
- [ ] **Failure** — did I cover what breaks, how it degrades, and the user's
      experience during failure?
- [ ] **Collaboration** — did I adapt to feedback instead of defending?

## Score & diagnose the design

Use the checklist above as a **self-applying quality bar** — the same dimensions,
scored. Rate the current design **0–5 on each** (these align with the eval's
behaviors and 0–5 scale, so a live self-score and the grader agree), report the
total and, for any dimension below 5, the *specific* thing to add to reach it.
Never declare a design "done" without stating its weakest dimension.

When a design "isn't landing," run this **Quick Diagnostic** — each gap names the
skill to invoke next:

| Ask | If weak / no | Invoke |
|---|---|---|
| Functional + non-functional + out-of-scope stated? | designing on assumptions | `requirements-scoping` |
| Peak QPS, storage, growth estimated? | capacity is a guess | `back-of-the-envelope` |
| Request/response, keys, pagination concrete? | boxes are guesswork | `api-design`, `data-storage` |
| Each major choice has solves / worsens / when-to-change? | name-dropping | `tradeoff-framework.md` |
| Reads vs writes handled deliberately? | one-size design | `caching`, `data-storage`, `messaging-streaming` |
| SPOFs, degradation, recovery covered? | assumes infinite uptime | `resilience-failure` |
| Behavior at 10×/100× known? | brittle to growth | `scaling-evolution` |
| Media / IDs / search / logs / SLOs addressed or deferred? | silent gap | run the coverage sweep |

## What success looks like

Not rushing, not buzzword-dropping, not hunting for a perfect diagram. Instead:
start from the problem, think in trade-offs, use blocks intentionally, anchor with
numbers, design for failure, and collaborate. The discussion feels like two
engineers working a messy problem together — not one person defending a slide.
