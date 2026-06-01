---
name: scaling-evolution
description: This skill should be used when the user asks "how does this scale", "scale to millions", "scaling roadmap", "where is the bottleneck", "what breaks first", "10x growth", "vertical vs horizontal scaling", "scale from zero", or "what's the next scale curve". It gives the order-of-magnitude evolution path (single server → tiers → replicas → cache → CDN → stateless tier → multi-region → sharding) and a way to diagnose the *next* bottleneck instead of memorizing one big diagram. Use it whenever a design must grow by orders of magnitude or a load increase is on the table, even if the user doesn't say "scaling".
---

# Scaling Evolution

Grow a design one bottleneck at a time. A system that serves 1k users and one
that serves 10M users are different architectures, but you do not jump between
them — you walk a path where each step removes the *current* ceiling and exposes
the next. Getting this wrong means either over-building day one (paying multi-
region complexity for 1k users) or freezing when load doubles because the design
was a memorized end-state, not a sequence of justified moves (GUIDE #7).

## When to reach for this
A load increase is on the table ("what if traffic 10×?", "scale to millions"),
the user asks where the bottleneck is or what breaks first, or a single-box
design has outgrown one machine. Reach here to sequence the next two or three
moves — never the whole roadmap at once.

## When NOT to
Do not pre-build steps the numbers do not yet demand (YAGNI). Sharding,
multi-region, and a message queue are *late* moves; proposing them for a system
that fits on two boxes is the over-indexing this skill defends against. If the
current load fits comfortably on a vertically-scaled box with a replica, stop —
that is the cheapest design that meets the constraint, and it wins. Naming the
next five tiers when only one is needed is a red flag, not foresight.

## Clarify first
The path is driven entirely by numbers and constraints, so pin these down before
moving (most come from `requirements-scoping` and `back-of-the-envelope`):
- **Current and target scale** — today's QPS/data and the multiple you must hit
  (2×? 100×?). The multiple decides how many steps you take now.
- **Read:write ratio** — read-heavy systems scale with replicas + cache; write-
  heavy systems hit the master/storage ceiling and need sharding far sooner.
- **Where it hurts now** — is the *symptom* compute (CPU saturated), storage
  (DB/disk saturated), or network (bandwidth/connections)? Diagnose before adding.
- **Consistency and staleness budget** — replicas and multi-region trade freshness
  for scale; if reads must be current, that constrains the path (→ `consistency-coordination`).
- **State** — is anything pinned to a server (sessions, local files)? Stateful
  tiers block horizontal scaling.

## The method: walk the bottleneck ladder
Each rung removes one ceiling. Apply the **next** rung the numbers justify, not
the whole ladder. Full triggers and worked thresholds are in
`references/scaling-ladder.md`.

1. **Single server.** Web, app, DB, cache on one box. Correct for low traffic and
   early validation. *Breaks when* one machine can't hold the load or the data.
2. **Split the tiers.** Move the database (and later cache) onto its own host so
   web and data scale independently. *Breaks when* the single web box or single DB
   saturates, or either becomes a single point of failure.
3. **Vertical scale + replicate for reads.** First scale *up* (bigger box — simple,
   no app changes) until the hard limit or cost knee. Add read replicas to spread
   reads off the primary (→ `data-storage` owns replication). *Breaks when* writes
   saturate the primary, or replica lag breaks freshness.
4. **Add a cache.** Put hot reads in front of the DB once a number shows reads
   dominate (→ `caching`). Highest-leverage move for read-heavy systems. *Breaks
   when* writes are the bottleneck, or the working set no longer fits.
5. **Push static/edge to a CDN.** Offload images/JS/CSS/video to edge servers
   close to users (→ `content-delivery`). *Breaks when* the bottleneck is dynamic
   requests, not static assets.
6. **Make the web tier stateless + load-balance.** Move session/state to a shared
   store so any request hits any server; put a load balancer in front and
   autoscale the fleet (→ `load-balancing`). This is the unlock for cheap
   horizontal scale. *Breaks when* the data tier (now the bottleneck) can't keep up.
7. **Decouple with async.** Move slow/bursty work (uploads, encoding, fan-out)
   behind a queue so producers and consumers scale independently and spikes are
   absorbed (→ `messaging-streaming`). *Breaks when* even the sync path or storage
   is the limit.
8. **Multi-DC / multi-region.** Geo-route users to the nearest healthy data center
   for latency and disaster survival; replicate across regions. *Breaks when*
   cross-region data sync, conflict resolution, or a single dataset too big for one
   region forces the last rung.
9. **Shard the data tier.** Partition data across nodes when one primary can no
   longer hold the writes/data (→ `data-storage` owns sharding/partitioning;
   `consistency-coordination` owns consistent hashing). The most complex move —
   last, not first.

Vertical scaling (scale *up*: more CPU/RAM) is the cheap early move with no app
changes but a hard ceiling and no redundancy. Horizontal scaling (scale *out*:
more boxes) is the durable answer — better availability, near-unlimited headroom —
but demands statelessness and adds coordination cost. Climb vertically until the
knee, then go horizontal.

## Diagnose the bottleneck before adding anything
"Add more servers" without a diagnosis is guessing (GUIDE #3, #7). Classify the
pressure first, then act on *that* resource:
- **Compute-bound** (CPU/threads pegged, latency rises with request rate): add app
  servers / autoscale; check for an O(n) hot path before buying hardware.
- **Storage-bound** (DB CPU/IO pegged, slow queries, replica lag growing): add
  read replicas, cache, then shard. Adding web servers here makes it *worse* —
  more connections onto an already-saturated DB.
- **Network-bound** (bandwidth saturated, connection limits, cross-region RTT):
  CDN for egress, compression, connection pooling, keep chatty traffic in one DC.
The classic failure is sharding the database when the bottleneck is compute — a
new failure mode added to fix the wrong layer. Read the symptom, name the
resource, then pick the rung.

Treat each rung as a *hypothesis*, not a destination: "this design holds until
writes exceed X / a region is lost / the working set outgrows RAM." Saying the
breaking point out loud is the move that distinguishes reasoning from defending a
diagram. When a constraint changes (load doubles, latency target tightens, a DC
is lost), revisit the assumption and climb — calmly, not by patching the old
shape onto a problem it no longer fits.

## Dos and don'ts
Distilled from the ladder, the diagnosis step, and where the technique misleads.

**Do**
- **Diagnose the resource before adding capacity** — name compute vs storage vs
  network, then act on *that* tier. "Add servers" without a symptom is guessing.
- **Apply only the next rung the numbers justify**, and state its breaking point
  out loud ("holds until writes exceed X / a region is lost").
- **Climb vertically until the knee, then go horizontal** — bigger box first
  (no app changes), scale-out once the ceiling or cost knee is hit.
- **Make the web tier stateless before scaling it out** — move sessions to a
  shared store so autoscaling can't drop them.
- **Pair every rung with the failure mode it adds** (cache stampede, replica
  promotion, region failover, hot shard) → `resilience-failure`.

**Don't**
- **Don't treat the ladder as a checklist** — it is a menu; most systems live
  happily at rung 4–6 forever and never shard.
- **Don't skip rungs to the "impressive" answer** — jumping to sharding or
  multi-region signals a memorized diagram, not a crossed ceiling.
- **Don't scale the layer that isn't the bottleneck** — more web servers onto a
  saturated DB just adds connections and amplifies the load downstream.
- **Don't route read-your-writes to a lagging replica** — replica lag reads like
  data loss; pin those reads to the primary (→ `consistency-coordination`).
- **Don't build the end-state on day one** — multi-region for 1k users is cost
  and complexity with no payoff. Match the rung to today's number.

## Numbers that matter
Numbers decide *which* rung is next; don't restate the tables — read
`back-of-the-envelope`. The ceilings that trigger a climb: a single RDBMS node
handles roughly **1k QPS**, a key-value node ~**10k**, a cache node
~**100k–1M**; one ~64-core box is ~**64k** req/s of pure compute before IO. When
an estimate crosses one of these, that crossing *is* the next bottleneck. Peak is
typically ~2× average, so size to peak. A useful framing: the rung you need is
roughly set by the *order of magnitude* of target QPS and dataset size — 1k QPS
fits one box, ~10k wants replicas and a cache, ~100k+ forces a stateless
horizontal tier, and a dataset past one node's RAM forces sharding. Each extra
"nine" of availability costs a disproportionate jump in redundancy (replicas →
multi-AZ → multi-region) — tie the target to the requirement, not ambition
(→ `back-of-the-envelope`, `resilience-failure`).

## Diagram
To visualize the current architecture and the one-rung-ahead version side by
side (so the breaking point and the next move are explicit), use the in-plugin
`architecture-diagram` skill. Sketch only the rung you're on plus the next one —
not the whole ladder.

## Related building blocks
- `back-of-the-envelope` — *depends on* it for the ceilings; a number crossing one names the next bottleneck.
- `data-storage` — *owned-concept lives there*: replication and sharding/partitioning, the heaviest rungs.
- `caching` — *pairs with* this as the cache rung; owns what to cache and how it fails under load.
- `load-balancing` — *feeds into* the stateless horizontal tier; sits at its front.
- `content-delivery` — *pairs with* this as the CDN/edge rung for static and geo-distributed content.
- `resilience-failure` — *pairs with* every rung; each one adds a failure mode to degrade gracefully.
- `consistency-coordination` — *owned-concept lives there*: the freshness/coordination cost of replicas, multi-region, and shards.
- `system-design` — *orchestrated by* it; this skill runs at its "scale the design" step.

## References
- **`references/scaling-ladder.md`** — the full rung-by-rung ladder with concrete
  trigger thresholds, the compute/storage/network diagnosis checklist, the
  vertical-vs-horizontal decision, and the multi-region sync gotchas. Read when
  sequencing the next moves or diagnosing what breaks first.
