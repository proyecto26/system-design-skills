---
name: system-design
description: This skill should be used when the user asks to "design a system", "design <a product>" (e.g. "design WhatsApp", "design a URL shortener", "design a news feed"), "high-level architecture for…", "how would you architect…", "system design interview", or wants to scope, diagram, and justify a backend/distributed-system design. It runs a reasoning loop — clarify, estimate, design, weigh trade-offs, stress-test, iterate — and routes to focused building-block skills. Use it whenever a request is an open-ended design problem, even if the user doesn't say "system design".
---

# System Design (orchestrator)

Drive an open-ended design problem from a vague prompt to a justified,
stress-tested architecture — **by reasoning, not by recalling a diagram.** This
skill owns the *method* and the *routing*; the actual component recipes live in
focused building-block skills it pulls in as needed.

The single most important idea, from which everything here follows:

> Do not memorize architectures; learn the forces that shape them. There is no
> single correct solution — success depends on the assumptions you make explicit.

A design that works for 1,000 users may fail at 1,000,000. Treat every
architecture as a **hypothesis** that holds until a constraint changes, and be
ready to redraw it calmly when one does.

## The reasoning loop

Work this loop out loud. It is a loop, not a checklist — late steps routinely
send you back to early ones, and that is the point.

1. **Clarify requirements** — turn the vague prompt into functional
   requirements, non-functional constraints, and an explicit *out of scope*.
   Scope to a few core features; say so. → skill `requirements-scoping`
2. **Estimate scale** — back-of-the-envelope QPS, storage, bandwidth, read/write
   ratio. Numbers decide the design; "high traffic" does not. → skill
   `back-of-the-envelope`
3. **Propose a high-level design** — sketch the boxes and arrows (clients, LB,
   services, stores, caches, queues, CDN) and the user-facing API. Get buy-in
   before going deep. → skill `api-design`, plus the building blocks below.
4. **Evaluate trade-offs** — for every major choice, state what it solves, what
   it worsens, and what would make you change it. Never name a tool without
   this. → reference `tradeoff-framework.md`
5. **Stress-test failure modes** — find single points of failure, decide the
   degradation story, plan recovery. Assume every component breaks. → skill
   `resilience-failure`
6. **Iterate / deep-dive** — pick the most interesting or fragile component and
   go deep; let new constraints ("what if writes 10×?", "lose a region?") drive
   a redesign of the affected part.

These six steps are the same four activities the GUIDE names —
**ask refining questions → handle the data → discuss components → discuss
trade-offs** — with estimation and failure-testing made explicit. See
`references/reasoning-loop.md` for the full walk-through and time budgeting.

## Routing to building blocks

This plugin is a wiki of composable parts. As each concern comes up in the loop,
**invoke the focused skill** (via the Skill tool) rather than reconstructing its
recipe from memory — load it so the options, trade-off table, behavior under
stress, and cloud-provider variants come from the skill itself. That invocation
is how composition works at runtime: a bare skill name below is a skill to
*trigger*, not a file to read. Invoke each as its concern becomes active:

| When the problem turns to… | Use skill |
|---|---|
| What features / constraints / scope? | `requirements-scoping` |
| How many QPS, how much storage, how many servers? | `back-of-the-envelope` |
| Endpoints, request/response, pagination, idempotency | `api-design` |
| SQL vs NoSQL, schema, indexing, sharding, replication | `data-storage` |
| What to cache, eviction, invalidation, hot keys | `caching` |
| Distributing traffic, L4/L7, health checks | `load-balancing` |
| Async work, queues vs streams, delivery guarantees | `messaging-streaming` |
| CAP, consistency models, quorum, consensus, hashing | `consistency-coordination` |
| Fault tolerance, circuit breakers, degradation, rate limiting | `resilience-failure` |
| Static/media delivery, edge, geo-routing | `content-delivery` |
| How the design evolves with 10×/100× growth | `scaling-evolution` |
| How clients resolve the service, geo/failover routing | `dns` |
| Unique IDs at scale (Snowflake/UUID/ticket) | `sequencer` |
| Storing large/unstructured objects (images, video, files) | `blob-store` |
| Metrics/logs/traces, health checks, SLOs, alerting | `observability` |
| High-volume log collection/shipping/retention | `distributed-logging` |
| Full-text search, inverted index, autocomplete | `distributed-search` |
| Background / scheduled / recurring jobs | `task-scheduling` |
| Counting likes/views at huge write rates | `sharded-counters` |
| Drawing/visualizing the architecture | `architecture-diagram` |

Full descriptions, the bottom-up layering, and "which block answers which
question" are in `references/building-blocks-index.md` (the canonical 21-block
catalog). Trigger a block directly when the user asks about just that part — the
orchestrator is not required for every question.

## Guardrails: the ways designs fail

The GUIDE catalogs ten failure modes. They are not about wrong answers; they are
about wrong *signals*. Keep these reflexes (full list and antidotes in
`references/failure-modes.md`):

- **Clarify before designing.** Rushing to a solution signals memorization.
- **Quantify before choosing.** Convert "heavy traffic" into numbers first.
- **Justify every component.** Three questions per choice: solves / worsens /
  when-to-change. "Industry standard" is not a justification.
- **Open building blocks, don't name them.** Know how a cache, queue, or DB
  behaves under stress — not just what it is called.
- **Design for failure.** "Add more retries" usually amplifies an outage.
- **Make interfaces concrete.** If you can't write the request, response, and
  primary key, the diagram is guesswork.
- **Treat the architecture as a hypothesis.** If a small constraint change
  collapses the whole design, it was memorized, not reasoned.

## Collaborate; do not present

A design discussion is a working session, not a lecture. Propose, invite the
critique, and adapt in real time. When a constraint changes, name which earlier
assumption it invalidates and redesign that part — defending a sunk design is a
worse signal than a flawed first idea. See `references/collaboration-playbook.md`
for how to narrate, handle curveballs, and pivot.

When requirements are genuinely ambiguous and the answer changes the design,
ask the user a clarifying question rather than guessing silently.

## Producing the design

- **Capture scope** in `assets/requirements-template.md` (functional /
  non-functional / out-of-scope / assumptions).
- **Write up the design** with `assets/design-doc-template.md` — it threads the
  reasoning loop, so the trade-offs and failure story are first-class, not
  footnotes.
- **Diagram** with the in-plugin `architecture-diagram` skill — a self-contained
  dark-theme HTML+SVG generator that ships in this plugin (no external
  dependency). A quick ASCII sketch is fine for early thinking; render properly
  once the design is clear. See `references/diagramming.md` for what to draw at
  each step and how to specify a diagram to that skill.
- **Persist it** so the work survives the conversation: write the requirements and
  design doc to a file (suggest `docs/design/<system>.md`; ask the user where if
  unsure). Keep trade-off exploration and constraint back-and-forth in the
  conversation; commit the settled artifacts (scope, design, key decisions, data
  model, diagram) to the file.
- **Score & diagnose** before wrapping: rate the design with the quality bar and
  run the Quick Diagnostic in `references/failure-modes.md`, and state the weakest
  dimension + what would raise it.

## Running it as a workflow

Two entry points drive this skill as a repeatable process:
- **`/design <system>`** — the slash command that runs the full loop on a problem.
- **`system-design-orchestrator`** — the agent the command dispatches to; it loads
  this skill, then invokes the building-block skills as each concern arises.

Both compose the same blocks listed above — invoke a block skill when its concern
is active rather than reconstructing its recipe from memory.

## References

- **`references/reasoning-loop.md`** — the six-step loop in depth, with the news-feed walk-through and 45-minute time budget. Read when running a full design.
- **`references/failure-modes.md`** — the ten failure modes and their antidotes. Read to self-check a design or diagnose why one isn't landing.
- **`references/tradeoff-framework.md`** — the solves/worsens/when-to-change method and common axis trade-offs (latency↔throughput, consistency↔availability, cost↔complexity). Read at step 4.
- **`references/building-blocks-index.md`** — the full wiki index: every block, what it answers, and how blocks combine. Read to route.
- **`references/collaboration-playbook.md`** — narrating, handling curveballs, pivoting on constraint changes. Read when the discussion gets adversarial.
- **`references/diagramming.md`** — what to draw at each loop step and how to specify a diagram to the `architecture-diagram` skill. Read when drawing.
- **`references/worked-example-news-feed.md`** — one end-to-end pass of the loop, shown as reasoning (not a template to memorize).

## Assets

- **`assets/requirements-template.md`** — functional / non-functional / scope / assumptions capture.
- **`assets/design-doc-template.md`** — a design write-up structured around the reasoning loop.
