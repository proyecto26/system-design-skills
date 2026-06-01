# The reasoning loop, in depth

The loop turns a vague prompt into a justified design. It is iterative: steps 4–6
routinely send you back to 1–3. Narrate each step out loud; the thinking *is* the
deliverable, not the final diagram.

The same process appears two ways in the source material. They are the same loop:

| GUIDE "divide and conquer" activities | The six steps here |
|---|---|
| Ask refining questions | 1. Clarify requirements |
| Handle the data | 2. Estimate scale (+ data characteristics) |
| Discuss the components | 3. High-level design · 6. Deep-dive |
| Discuss trade-offs | 4. Trade-offs · 5. Failure modes |

---

## 1. Clarify requirements

Do not jump to a solution — answering fast earns nothing and signals
memorization. Slow down and ask. Split needs into:

- **Functional** — what the system does, from the user's view ("send a message
  to a friend in near-real-time", "post and view a feed").
- **Non-functional** — the qualities that shape the design (scale, latency
  targets, availability, consistency, durability, security/regulatory).
- **Out of scope** — what you are deliberately *not* designing, so the core fits
  the time. Name 2–4 core features and say you'll focus there; adjust if the
  user objects.

Useful opening questions: who/how many users, growth in 3/6/12 months, read vs
write heavy, consistency tolerance, latency SLA, existing stack to reuse. Write
assumptions down — you'll need them later. → skill `requirements-scoping`.

## 2. Estimate scale

Convert words into numbers before choosing anything. A design for 1k QPS and one
for 1M QPS are different systems; 10 GB fits in RAM, 10 TB needs distribution.
Estimate peak QPS (read and write separately), storage/day and /year, bandwidth,
and working-set size. Directional correctness beats precision. The numbers tell
you when a single DB won't do, when caching is forced by a 95% read ratio, when
write spikes demand an ingestion queue. → skill `back-of-the-envelope`.

Also characterize the **data** here (the GUIDE's "handle the data"): size now and
growth rate, read- vs write-heavy, consistency vs eventual, durability target,
how downstream consumers read it, privacy/regulatory constraints. Data shape
drives the storage choice in step 3.

## 3. Propose a high-level design

Sketch boxes and arrows: clients (web/mobile), DNS, CDN, load balancer, stateless
service tier, datastores, caches, queues. Arrows are protocols and data flow.
Define the **user-facing API** early — concrete endpoints make the data and
interaction requirements real (→ skill `api-design`). Get buy-in on this blueprint
*before* diving deep; walk a concrete use case or two to surface edge cases.

Pull in building blocks as each part appears: `data-storage`, `caching`,
`load-balancing`, `messaging-streaming`, `content-delivery`. Pick the *cheapest*
design that meets the constraints from step 2 — add components only when a number
forces them.

## 4. Evaluate trade-offs

Every component is a trade. For each major choice, answer three questions:
**what does it solve, what does it make worse, and what would make me change it?**
If you can't answer all three, the decision isn't grounded — it's name-dropping.
Connect the choice to the workload from step 2. → reference `tradeoff-framework.md`.

## 5. Stress-test failure modes

Assume every component fails. Walk the design and ask:
- **SPOF** — if this box disappears, does everything stop?
- **Degradation** — if this dependency is slow/down, do we fall back to cache,
  serve partial results, or hide the feature? Stale data usually beats an error.
- **Recovery / amplification** — when it comes back, do retries/health-checks
  stampede it? "More retries" usually *amplifies* an outage. → skill
  `resilience-failure`.

## 6. Iterate / deep-dive

Pick the most interesting or most fragile component and go deep (the hash
function for a URL shortener; online/offline + ordering for a chat system). Then
invite curveballs and let them drive a redesign of the *affected part only*:
"what if writes go 10×?", "what if we lose a region?", "what if latency must be
< 50 ms?". A design that collapses entirely under a small change was memorized;
a reasoned one bends locally.

---

## Time budget (≈45 minutes)

A rough guide — adjust to the problem and the user's signals:

| Step | Minutes |
|---|---|
| 1 — Clarify scope | 3–10 |
| 2–3 — Estimate + high-level design | 10–15 |
| 6 — Deep-dive | 10–25 |
| Wrap (recap, bottlenecks, next scale curve) | 3–5 |

Trade-offs (4) and failure modes (5) are woven through 3 and 6, not a separate
block of time.

## Coverage sweep (before wrap-up)

The loop pulls blocks *reactively*, so a concern nobody raised can silently never
get designed. Before wrapping, scan the in-scope feature list against the
building-blocks index and, for each plausibly-relevant concern not yet addressed,
either invoke the block or explicitly defer it with a one-line reason. Easy ones
to miss: media/large objects (`blob-store`), unique IDs (`sequencer`), client
resolution (`dns`), monitoring/SLOs (`observability`), high-volume logs
(`distributed-logging`), search (`distributed-search`), background/scheduled work
(`task-scheduling`), high-write counts (`sharded-counters`). An unopened relevant
primitive is GUIDE failure mode #2 in miniature.

## Wrap-up

Recap the design (especially if you offered alternatives). Never claim it's
perfect — name the current bottleneck and what you'd do with more time or at the
next order of magnitude. Mention monitoring: how you'd watch growth and know when
to evolve (→ skill `scaling-evolution`).

See `worked-example-news-feed.md` for one full pass of this loop.
