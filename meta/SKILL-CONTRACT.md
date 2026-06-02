# Building-Block Skill Contract

This is the shared shape that **every building-block skill** in this plugin
follows. It exists so the blocks compose cleanly, trigger predictably, and bake
the failure-mode defenses (the ten failure modes — see `docs/GUIDE.md`, with the
condensed runtime version in `skills/system-design/references/failure-modes.md`)
into the design conversation by construction.

The orchestrator skill (`system-design`) is exempt — it defines the method and
routes to blocks. Everything else follows this contract. Use `skills/caching/`
(component archetype) and `skills/back-of-the-envelope/` (method archetype) as the
reference implementations.

## Two archetypes

Not every block is a component with interchangeable options. Forcing the full
structure onto a method skill produces exactly the irrelevant filler this plugin
forbids (YAGNI). There are two archetypes:

- **Component blocks** — a part you pick an implementation for. Follow the full
  section list below, including **The options**, the **Trade-offs** table,
  **Behavior under stress**, and **provider files**.
  → `api-design`, `data-storage`, `caching`, `load-balancing`,
  `messaging-streaming`, `consistency-coordination`, `resilience-failure`,
  `content-delivery`.

- **Method blocks** — a technique or discipline, not a component. Replace
  **The options** with the **method steps / recipes**, replace the **Trade-offs**
  table with **Pitfalls / where it misleads**, and keep providers only if a cloud
  detail genuinely changes the technique (otherwise omit `providers/`).
  → `requirements-scoping`, `back-of-the-envelope`, `scaling-evolution`.

Both archetypes keep: purpose, when-to / when-not, clarify-first, numbers/why,
diagram (where useful), related blocks, references. Both obey DRY/KISS/YAGNI.

---

## Why a contract at all

The GUIDE identifies *how* strong engineers fail: they name tools without
trade-offs, skip the numbers, ignore failure modes, and defend memorized
diagrams. A consistent skill shape makes the *right* moves the path of least
resistance — every block forces a clarify step, a trade-off table, a
stress/failure section, and a "when would I change this" prompt. The structure
is the guardrail.

---

## Directory layout (mandatory)

```
skills/<block-name>/
├── SKILL.md
├── references/
│   ├── deep-dive.md                 # mechanics under the hood (the "why it behaves that way")
│   └── providers/
│       ├── generic.md               # vendor-neutral; ALWAYS present, is the default answer
│       ├── aws.md
│       ├── azure.md
│       ├── gcp.md
│       └── temporal.md              # ONLY where durable execution / workflows are relevant
└── assets/                              # optional; usually empty
```

- **`providers/` and `generic.md` apply to COMPONENT blocks only.** Method blocks
  (`requirements-scoping`, `back-of-the-envelope`, `scaling-evolution`) omit the
  `providers/` directory entirely and skip the "Choosing a provider" body section,
  unless a specific cloud detail genuinely changes the technique.
- For component blocks, `generic.md` is required. Other provider files are added
  where a managed service meaningfully changes the recipe. If a provider has no
  file, the generic recipe is the answer — say so rather than inventing a service.
- `deep-dive.md` holds the internals that would bloat SKILL.md (algorithms,
  protocols, edge cases, worked numbers). Keep SKILL.md lean.
- **No per-block diagram files.** Diagrams are produced by the in-plugin
  `architecture-diagram` skill (self-contained HTML+SVG). A block does not ship a
  Mermaid/`.mmd` template; its "Diagram" line points to that skill. `assets/` holds
  block-specific output only, and is usually empty.

---

## Frontmatter (mandatory)

```yaml
---
name: <block-name>
description: This skill should be used when the user <specific trigger phrases in
  third person>. <One line on what it gives them.> Use it whenever <broader
  contexts> even if they don't say "<block-name>".
---
```

Rules:
- **Third person**, starts with "This skill should be used when…".
- Include **concrete trigger phrases** a real user would type (component names,
  symptoms, vendor names): e.g. for caching — "caching strategy", "cache
  invalidation", "Redis vs Memcached", "thundering herd", "stale reads".
- Be **a little pushy** to combat undertriggering, but keep triggers *distinct*
  from sibling blocks so routing stays clean. Each block owns its vocabulary;
  do not claim another block's keywords.
- No `version` required (optional).

---

## SKILL.md body sections (in this order)

Write in **imperative/infinitive** form (verb-first), never second person.
Explain the *why*; avoid heavy-handed ALWAYS/NEVER. Target **1,500–2,000 words**;
push depth into `references/`.

1. **`# <Title>`** + a 1–2 sentence purpose: what part of a system this covers
   and why getting it wrong hurts.

2. **`## When to reach for this` / `## When NOT to`** — the problem this part
   solves, and the over-engineering guard (the cheapest design that meets the
   constraint usually wins). Naming a thing you don't need is a red flag.

3. **`## Clarify first`** — the 3–5 questions to answer *before* choosing an
   option here (data shape, read/write ratio, consistency need, scale, latency
   target, durability). Ties back to `requirements-scoping` and
   `back-of-the-envelope`. This enforces "no design before requirements."

4. **`## The options`** — the menu of approaches for this part. For each: a
   one-line "use when". This is the divide-and-conquer recipe — a few named
   choices, not one blessed answer.

5. **`## Trade-offs`** — a table with **one row per option** and these columns:

   | Option | What it solves | What it worsens | Change it when |
   |---|---|---|---|

   This is the heart of the contract (GUIDE failure mode #4). If a row cannot be
   filled honestly, the option is not understood well enough to recommend.

6. **`## Behavior under stress`** — how this part acts under load spikes and
   partial failure, and how it can *amplify* an outage (retry storms, eviction
   storms, health-check stampedes, hot shards). What to monitor. (GUIDE #2, #6.)

7. **`## Numbers that matter`** — the quantities to estimate or know for this
   part (rules of thumb, capacity ceilings, latency budgets). Ties to
   `back-of-the-envelope`. (GUIDE #5.)

8. **`## Interface sketch`** *(include where the part has a contract)* — concrete
   request/response, key/index, or message shape. Vague boxes are guesswork.
   (GUIDE #8.) Blocks with no natural interface (e.g. load-balancing) may omit.

9. **`## Choosing a provider`** *(component blocks only; method blocks omit this)*
   — exactly this guidance:
   > Default to the generic recipe above. If the user names a cloud, read
   > `references/providers/<provider>.md` for the managed-service mapping,
   > quotas/limits, and provider-specific trade-offs. If no file exists for that
   > provider, the generic recipe is the answer.

10. **`## Diagram`** — one line: to visualize this part or the whole design, use
    the in-plugin `architecture-diagram` skill. A tiny ASCII sketch inline is fine
    for quick reasoning; do not embed Mermaid. Method blocks may omit this section.

11. **`## Related building blocks`** — cross-link sibling skills by name (e.g.
    "pair with `consistency-coordination` when stale reads are unacceptable")
    and link back to the `system-design` orchestrator. Use bare skill names in
    backticks; they are not file paths.

12. **`## References`** — list the files under `references/` with a one-line
    "read this when…" for each.

---

## Required sections v2 — process, dos/don'ts, explicit relations

To match the reference skill shapes (a clear step-by-step process, dos & don'ts,
and visible structure between skills), every block adds these. Keep them tight —
they replace vague prose, they don't pad.

- **`## How to apply` (component blocks)** — a numbered 4–6 step process for using
  this part in a design: clarify the inputs → pick from the options using the
  trade-off table → set the key knobs → stress-test → size it → pick a provider.
  Concrete and skimmable. (Method blocks already express this as their method
  recipe, so they do not repeat it.)
- **`## Dos and don'ts`** — a compact two-list (Do… / Don't…) of the highest-value
  guidance for this part, distilled from the skill (not new content). 4–6 bullets
  each side. For method blocks this may merge with / replace "Pitfalls".
- **`## Related building blocks` must state the RELATION, not just link.** Use a
  relation verb so the structure is visible: *depends on* / *feeds into* /
  *alternative to* / *pairs with* / *owned-concept lives in*. Example:
  "`caching` — *pairs with* this for read offload; *alternative to* read replicas."

Placement: `How to apply` and `Dos and don'ts` go after `Behavior under stress`
and before `Numbers that matter`. The orchestrator agent owns the *system-level*
step-by-step (the reasoning loop); per-block steps are local to that component.

## Trade-off discipline (applies everywhere)

For every option a block recommends, the reader must be able to answer the
three GUIDE questions:

- **What problem does this solve?**
- **What does it make worse?**
- **What would make me change this decision?**

The Trade-offs table is where these live. Narration in prose is fine too, but
the table must exist.

---

## Provider file shape (`references/providers/<provider>.md`)

Each provider file maps the **generic recipe → concrete services**, and adds
what the generic recipe cannot know:

- **Service mapping** — which managed service(s) implement each option.
- **Key limits/quotas** — the numbers that bite (throughput ceilings, payload
  sizes, partition limits, connection caps). Note these change; mark as
  "verify against current docs."
- **Provider-specific trade-offs** — lock-in, pricing model gotchas, regional
  availability, consistency knobs that differ from the generic model.
- **Pitfalls** — the mistakes specific to this provider's implementation.

`generic.md` instead covers the vendor-neutral mechanics and the
self-host/open-source options (e.g. Redis, Kafka, HAProxy, Postgres).

**Freshness & scope (avoid stale catalogs):** a provider file is a
decision-changing map, not a service directory. Include only services/limits that
*change what a designer picks*. Mark any concrete quota/limit "verify against
current docs" since they drift. Keep each file short (roughly one screen); if it
reads like a marketing catalog, cut it. A provider file with no decision-relevant
difference from `generic.md` should not exist.

---

## Cross-linking rules

- Refer to sibling skills by **bare name in backticks**: `data-storage`,
  `caching`. These are skill names, not paths — the reader triggers them, not
  opens them.
- Every block links **back to `system-design`** in "Related building blocks".
- Prefer 2–4 high-value links over an exhaustive list.

## DRY / KISS / YAGNI (hard rules)

These keep the wiki maintainable and the skills lean. Violating them is the most
common way this plugin would rot.

- **DRY — one home per fact.** Cross-cutting material lives in exactly one skill;
  everyone else links to it. In particular:
  - Latency numbers, QPS rates, powers of two, server specs → `back-of-the-envelope`.
  - The solves/worsens/when-to-change method and axis trade-offs → the
    `system-design` orchestrator's `tradeoff-framework.md`.
  - The ten failure modes → the orchestrator's `failure-modes.md`.
  - CAP / consistency-model theory → `consistency-coordination`.
  A block restates a number or definition only if it is *load-bearing for that
  block's decision*, and even then keeps it to a sentence and links to the home.
- **KISS — lean bodies.** SKILL.md targets 1,500–2,000 words. If a section grows,
  move it to `references/`. No tangents, no history lessons, no restating general
  knowledge the model already has.
- **YAGNI — only what changes a decision.** Include an option, number, or provider
  detail only if it would change what a designer does. Do not list every managed
  service a cloud offers, every eviction policy in existence, or edge cases no one
  hits. If it doesn't alter a choice, leave it out.

## Cross-cutting concept ownership (authoritative map)

Many concepts span blocks. Each has **exactly one owning skill** that explains it
in depth; every other block references the owner with a one-sentence summary and a
link — it never re-teaches the concept. Authors (including parallel workflow
agents) must obey this map.

| Concept | Owner skill | Others may… |
|---|---|---|
| Latency/QPS numbers, powers of two, availability nines, server specs | `back-of-the-envelope` | cite a single figure + link |
| Reasoning loop, the 10 failure modes, the trade-off method | `system-design` | reference, don't restate |
| CAP/PACELC, consistency models, quorum, consensus, **consistent hashing**, leader election, distributed transactions/saga | `consistency-coordination` | name + link |
| SQL vs NoSQL, data modeling, indexing, **sharding/partitioning**, replication | `data-storage` | name + link |
| Eviction, cache invalidation, thundering herd, hot keys, stampede | `caching` | name + link |
| CDN, edge caching, geo-routing | `content-delivery` | name + link |
| Queues vs streams vs pub/sub, delivery guarantees, ordering, backpressure, DLQ, durable workflows | `messaging-streaming` | name + link |
| Circuit breakers, retries/backoff/jitter, timeouts, bulkheads, graceful degradation, SPOF, **rate limiting** | `resilience-failure` | name + link |
| L4/L7, health checks, LB algorithms, sticky sessions | `load-balancing` | name + link |
| API contracts, pagination, versioning, **idempotency keys** | `api-design` | name + link |
| Scale-from-zero-to-millions, bottleneck diagnosis, stateless tier, vertical vs horizontal | `scaling-evolution` | name + link |
| DNS resolution, record types, routing policies (geo/latency/weighted/failover), anycast, TTL/propagation | `dns` | name + link |
| Unique-ID generation (UUID/Snowflake/ticket), monotonicity, clock-skew | `sequencer` | name + link |
| Metrics/logs/traces pillars, health checks, alerting, **SLO/SLI/error budgets**, RED/USE | `observability` | name + link |
| Object/blob storage, chunking, durability (replication/erasure coding), tiering, signed URLs, multipart upload | `blob-store` | name + link |
| Inverted index, crawl/index/search pipeline, relevance ranking, autocomplete | `distributed-search` | name + link |
| High-volume **log pipeline** (collect→buffer→ship→index→retain), structured logs, correlation IDs | `distributed-logging` | name + link |
| Distributed task scheduling (cron/delayed/recurring), worker leasing, priorities/fairness, task dedup | `task-scheduling` | name + link |
| Sharded/striped counters, write-contention avoidance, approximate counting (HyperLogLog) | `sharded-counters` | name + link |
| Monolith vs microservices, service boundaries/granularity, API gateway/BFF, service discovery, service mesh, sync-vs-async between services | `service-decomposition` | name + link |
| Diagram generation (HTML+SVG) | `architecture-diagram` | point to it |

Two boundaries to respect among the new blocks: **`observability` owns *what* to
measure + alert + SLOs (the three pillars conceptually); `distributed-logging`
owns *how* to move/store logs at high volume (the pipeline).** And `task-scheduling`
adds scheduling/leasing *on top of* `messaging-streaming`'s queues (it depends on
them, doesn't reimplement delivery).

## Executable code (scripts/ + expected_outputs/)

A block ships a `scripts/` + `expected_outputs/` pair ONLY when its output is
**objective and repeatedly recomputed** — not for prose/reasoning surfaces
(skill-creator: subjective skills don't need test cases; a prose golden is brittle
and duplicates the SKILL.md). Today the only such surface is `back-of-the-envelope`
(the BOTEC calculator + a golden fixture). Rules when a script is justified:
- Stdlib only; deterministic; `--json` output.
- Do NOT hardcode a second copy of numbers owned elsewhere (e.g. per-server QPS
  lives in `numbers-to-remember.md`) — pass as args/defaults and cite in the
  docstring. Cross-point script ↔ the prose worked example to prevent drift.
- Ship one `expected_outputs/*.json` golden + a tiny diff-assertion test.

When a concept is load-bearing for a block but owned elsewhere (e.g. `caching`
needs consistent hashing to shard the cache), give a **two-to-three-sentence**
working summary and link to the owner for the full treatment — never a full
duplicate.

---

## Diagram rules

- **One diagram engine for the whole plugin:** the in-plugin `architecture-diagram`
  skill (self-contained dark-theme HTML+SVG). Blocks never ship their own diagram
  files and never embed Mermaid.
- A block's "Diagram" section is a single pointer to that skill. An inline ASCII
  sketch is allowed only when it genuinely aids reasoning about the part.
- Do not duplicate the diagram skill's styling, colors, or conventions in a block.

---

## Tone and stance (from the GUIDE)

- **Reasoning over recall.** Present options and the forces that pick between
  them, never a single "correct" architecture.
- **Treat the design as a hypothesis.** Encourage stating the breaking point of
  each choice ("this holds until writes exceed X / a region is lost").
- **Collaborate.** Frame guidance as something to narrate and adjust with the
  user, not a verdict to defend.
- **Quantify.** Replace "high scale" with concrete numbers before choosing.
