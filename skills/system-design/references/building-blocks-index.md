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
L2 Contract   api-design                                                  (the interface boundary)
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

## Common compositions

- **Read-heavy feed/timeline:** `back-of-the-envelope` (95% reads) → `caching`
  (read-through) + `data-storage` (denormalized read model) + `messaging-streaming`
  (fan-out) + `consistency-coordination` (eventual is fine) + `content-delivery`
  (media).
- **Write-heavy ingestion (metrics, logs, chat):** `messaging-streaming` (buffer
  spikes) → `data-storage` (partitioned/time-series) + `resilience-failure`
  (backpressure, DLQ) + `scaling-evolution` (shard as volume grows).
- **Low-latency lookups (URL shortener, KV):** `data-storage` (KV + hashing) +
  `caching` (hot keys) + `consistency-coordination` (consistent hashing) +
  `load-balancing`.
- **Transactional core (payments, reservations):** `consistency-coordination`
  (strong consistency, distributed transactions/saga) + `data-storage`
  (relational) + `resilience-failure` (idempotency, retries) + `api-design`
  (idempotency keys).

## Provider modularity

Every block defaults to a **generic, vendor-neutral recipe**. When the user names
a cloud, the block reads `references/providers/<provider>.md` for the
managed-service mapping, quotas, and provider-specific trade-offs. If no provider
file exists, the generic recipe is the answer — say so rather than inventing a
service. The provider set today is generic / AWS / Azure / GCP, plus Temporal for
durable execution in `messaging-streaming` and `resilience-failure`.
