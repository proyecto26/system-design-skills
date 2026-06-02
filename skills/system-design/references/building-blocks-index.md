# Building-blocks index (the wiki)

This plugin is a wiki of composable parts. This index says which block answers
which question, and how the blocks combine into a whole design. Trigger a block
directly when the user asks about that part — the orchestrator is not required
for every question.

## The blocks

| Skill | Answers | Defends GUIDE failure mode |
|---|---|---|
| `requirements-scoping` | What are we building? Functional vs non-functional? What's out of scope? What to clarify? | #3 rushing without clarifying |
| `back-of-the-envelope` | How many QPS? How much storage/bandwidth? How many servers? What numbers should I just know? | #5 no sense of scale |
| `api-design` | What are the endpoints? Request/response shape? Pagination, idempotency, versioning, error contracts? | #8 weak API thinking |
| `service-decomposition` | Monolith or microservices? Where are the service boundaries / how fine-grained? API gateway? Service discovery / mesh? | #7 over-indexing, #2 opaque primitives |
| `data-storage` | SQL or NoSQL? Data model and keys? Indexing? How to shard/partition? Replication? | #1 fundamentals, #8 data model |
| `caching` | What to cache? Read/write strategy? Eviction and invalidation? Thundering herd, hot keys, stampede? | #2 opaque primitives |
| `load-balancing` | How to distribute traffic? L4 vs L7? Health checks? Algorithms? Sticky sessions? | #2 opaque primitives |
| `messaging-streaming` | Sync or async? Queue vs stream vs pub/sub? Delivery guarantees? Ordering, backpressure, DLQ? Durable workflows? | #2, #6 |
| `consistency-coordination` | CAP/PACELC? Which consistency model? Quorum? Consensus? Distributed transactions? Consistent hashing? | #1 fundamentals |
| `resilience-failure` | What breaks? Circuit breakers, retries/backoff, timeouts, bulkheads? Degradation? Rate limiting? Recovery? | #6 ignoring failure |
| `content-delivery` | How to serve static/media at the edge? CDN push vs pull? Geo-routing? Cache control? | #2 opaque primitives |
| `scaling-evolution` | How does this design change at 10×/100×? Where's the next bottleneck? Vertical vs horizontal? | #7 over-indexing on one diagram |
| `dns` | How do clients find the service? Record types? Geo/latency/weighted/failover routing? TTL? Anycast? | #2 opaque primitives |
| `sequencer` | How to generate unique IDs at scale? UUID vs Snowflake vs ticket? Time-sortable? Causality? | #1 fundamentals, #8 keys |
| `observability` | What to measure? Metrics/logs/traces? Health checks? SLO/SLI + error budgets? Alerting? | #6 ignoring failure |
| `blob-store` | Where do large/unstructured objects live? Durability? Chunking? Signed URLs? Tiering? | #2 opaque primitives |
| `distributed-search` | Full-text search? Inverted index? Crawl/index/search? Ranking? Autocomplete? | #2 opaque primitives |
| `distributed-logging` | How to collect/ship/store logs at high volume? Buffering? Correlation IDs? Retention? | #6 ignoring failure |
| `task-scheduling` | Background/scheduled/recurring jobs? Worker leasing? Priorities? Retries + dedup? | #2, #6 |
| `sharded-counters` | Count likes/views at huge write rates? Avoid hot-key contention? Approximate counts? | #1 fundamentals |

## Entry points

- **`/design <system>`** (slash command) — runs the whole workflow on a problem.
- **`system-design-orchestrator`** (agent) — the autonomous driver of the loop; the
  command dispatches to it. It loads this skill, then routes to the blocks below.
- **Any block directly** — for a single-part question, trigger that skill alone.

## Bottom-up layers (topological)

The blocks are arranged so a block depends only on layers beneath it — assemble a
design bottom-up. Foundations first, evolution last.

```
L0 Frame      requirements-scoping · back-of-the-envelope                 (decide WHAT and HOW BIG)
L1 Edge       dns · load-balancing · content-delivery                     (get traffic in, served close)
L2 Services   api-design · service-decomposition                         (the interface + how it's split)
L3 State      data-storage · caching · blob-store · sequencer ·
              sharded-counters · distributed-search                       (store it, read it fast)
L4 Async      messaging-streaming · task-scheduling                       (decouple, schedule, absorb spikes)
L5 Correctness consistency-coordination                                   (CAP, ordering, consensus)
L6 Ops        resilience-failure · observability · distributed-logging    (degrade, see, survive)
L7 Growth     scaling-evolution                                           (what changes at 10×/100×)
   Render     architecture-diagram                                        (draw any of the above)
```

Relations are stated explicitly in each block's "Related building blocks" section
(*depends on / feeds into / alternative to / pairs with*), so the graph is visible
from any node, not just here.

## How blocks combine (typical flow)

```
requirements-scoping ──► back-of-the-envelope ──► api-design
        │                        │                    │
        └──────────► (numbers force the choices) ◄─────┘
                                 │
        ┌────────────────────────┼─────────────────────────┐
        ▼                        ▼                          ▼
   data-storage             load-balancing           messaging-streaming
        │                        │                          │
        ▼                        ▼                          ▼
     caching            content-delivery          consistency-coordination
        └─────────────► resilience-failure ◄──────────────┘
                                 │
                                 ▼
                         scaling-evolution   (what changes at the next order of magnitude)
```

This is not a fixed pipeline — it's a dependency hint. Requirements and numbers
come first because they constrain everything downstream. Resilience and scaling
are cross-cutting: revisit them as the design firms up.

## Common compositions (starting hypotheses, not templates)

These are *falsifiable starting points*, not memorized mini-architectures — each
holds only under a stated assumption, and a constraint change breaks it (that's
the point; see failure mode #7). Use one as a hypothesis, then let the numbers and
the deep-dive confirm or replace it.

- **Read-heavy feed/timeline:** `back-of-the-envelope` (95% reads) → `caching`
  (read-through) + `data-storage` (denormalized read model) + `messaging-streaming`
  (fan-out) + `consistency-coordination` (eventual is fine) + `content-delivery`
  (media). *Breaks when:* a celebrity makes fan-out-on-write a storm → hybrid.
- **Write-heavy ingestion (metrics, logs, chat):** `messaging-streaming` (buffer
  spikes) → `data-storage` (partitioned/time-series) + `resilience-failure`
  (backpressure, DLQ) + `scaling-evolution` (shard as volume grows). *Breaks when:*
  exactly-once is required → idempotent consumers + dedup.
- **Low-latency lookups (URL shortener, KV):** `data-storage` (KV) + `sequencer`
  (short IDs) + `caching` (hot keys) + `consistency-coordination` (consistent
  hashing) + `load-balancing`. *Breaks when:* strong read-after-write is needed.
- **Transactional core (payments, reservations):** `consistency-coordination`
  (strong consistency, distributed transactions/saga) + `data-storage`
  (relational) + `resilience-failure` (idempotency, retries) + `api-design`
  (idempotency keys). *Breaks when:* throughput forces a split → `service-decomposition` + saga.

## Synthesis worksheet — derive the design from the constraint

The hard part of a real design isn't picking blocks from a category — it's that
blocks *interact*, so one load-bearing constraint forces choices across several at
once. Don't pattern-match a prompt to a composition above; instead, for the
load-bearing constraint, fill in:

1. **Assumption** it rests on (what must be true for the simple design to hold).
2. **Invalidating constraint** (what change falsifies it).
3. **Affected blocks** (which blocks must change together when it does).
4. **Now-incompatible options** (choices the constraint rules *out*).
5. **Numbers to recompute** (→ `back-of-the-envelope`).
6. **Failure/degradation impact** (→ `resilience-failure`).

Then re-walk API · data · failure · scale together — not one block in isolation.

**Worked cascade A — "balances must be exact" (strong consistency).**
Affected: `data-storage` (CP store), `caching` (write-behind now unsafe → write-
through or skip the hot path), `consistency-coordination` + `service-decomposition`
(cross-service writes → saga, keep the money in one service), `api-design`
(idempotency keys), `resilience-failure` (can't serve stale → fail-closed +
reconcile). Incompatible: eventual-consistency reads on balances, async
fire-and-forget debits. Flip to "eventual is fine" and *all* of these relax.

**Worked cascade B — "feed p99 < 50 ms globally".**
Affected: `content-delivery` (edge/PoP close to users — cross-region RTT alone is
~100 ms, so the origin can't be on the read path), `caching` (precompute/read-
through at the edge), `data-storage` (region-local replicas; denormalized read
model), `consistency-coordination` (accept eventual/causal — strong cross-region
reads can't meet 50 ms), `dns` (latency/geo routing). Incompatible: a single-region
DB on the read path, synchronous cross-region quorum reads. Numbers: per-region
working-set size, hit-rate target. Flip to "p99 < 500 ms" and the edge tier and
region-local replicas may disappear.

**Worked cascade C — "writes grow 10× (hot spot emerging)".**
Affected: `back-of-the-envelope` (re-derive peak write QPS vs per-node ceiling),
`data-storage` (shard; pick a key that spreads the hot entity — celebrity/hot-key),
`sharded-counters` (if the hotspot is a counter), `messaging-streaming` (absorb the
spike with an ingestion queue), `scaling-evolution` (which rung breaks next),
`resilience-failure` (backpressure so the surge doesn't cascade). Incompatible: a
single primary on the write path, a naive `hash(id) % N` shard map (resharding
storm → consistent hashing). Flip back to 1× and the shard/queue tier is premature.

Always name the load-bearing constraint and walk its ripple before committing — a
design that only changes locally when a constraint changes was reasoned; one that
collapses was memorized (failure mode #7).

## Provider modularity

Every block defaults to a **generic, vendor-neutral recipe**. When the user names
a cloud, the block reads `references/providers/<provider>.md` for the
managed-service mapping, quotas, and provider-specific trade-offs. If no provider
file exists, the generic recipe is the answer — say so rather than inventing a
service. The provider set today is generic / AWS / Azure / GCP, plus Temporal for
durable execution in `messaging-streaming` and `resilience-failure`.
