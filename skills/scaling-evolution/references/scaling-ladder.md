# Scaling ladder (rung-by-rung)

The detail that would bloat SKILL.md: concrete trigger thresholds per rung, the
bottleneck-diagnosis checklist, the vertical-vs-horizontal decision, and the
multi-region sync gotchas. Read when sequencing the next moves or arguing about
what breaks first.

> Climb to the **next** rung the numbers force — never the whole ladder. Each
> rung removes one ceiling and adds one failure mode. State the breaking point
> before you move; that is what separates reasoning from a memorized diagram.

## The rungs and their triggers

| # | Move | Climb when (trigger) | New failure mode it adds |
|---|---|---|---|
| 1 | Single server (all-in-one) | — (starting point) | Total SPOF; loses everything on one crash |
| 2 | Split web tier from data tier | One box can't hold both load and data; you want to scale them independently | Network hop between tiers; DB is now a separate SPOF |
| 3 | Vertical scale + read replicas | DB CPU/IO climbing; reads dominate; need read redundancy | Replica lag → stale reads; promotion logic on primary failure |
| 4 | Cache hot reads | A number shows reads dominate and the DB is the read bottleneck | Stampede, stale-after-write, hot key, cold cache (→ `caching`) |
| 5 | CDN for static/edge | Static assets (img/JS/CSS/video) or geo-distance dominate latency/egress | CDN outage path; cache-expiry/invalidation drift (→ `content-delivery`) |
| 6 | Stateless web tier + LB + autoscale | Single web box saturates; you need elastic horizontal scale | Health-check stampede; scale-down drops in-flight state if not stateless |
| 7 | Async / queue for slow work | Bursty or slow tasks (encode, fan-out) block the sync path | Backpressure, duplicate delivery, DLQ growth (→ `messaging-streaming`) |
| 8 | Multi-DC / multi-region | Latency for distant users, or need to survive a region loss | Cross-region replication lag, conflict resolution, failover complexity |
| 9 | Shard the data tier | One primary can't hold the writes or the dataset | Resharding, hotspot/celebrity shard, cross-shard joins (→ `data-storage`) |

Most production systems settle somewhere around rungs 4–6 and never need 8–9.
Rungs are not strictly ordered — a write-heavy system may reach sharding (9)
before it ever needs a CDN (5). The order above is the *typical* read-heavy path;
let the numbers reorder it.

## Diagnose the bottleneck first (compute vs storage vs network)

Adding capacity without a diagnosis is the GUIDE's "add more servers" reflex.
Classify the pressure, then act on *that* resource.

| Symptom | Likely bound | Right move | Wrong move that amplifies it |
|---|---|---|---|
| CPU pegged, latency rises with request rate, threads queued | **Compute** | Profile the hot path; add app servers / autoscale | Sharding the DB (DB wasn't the problem) |
| DB CPU/IO pegged, slow queries, replica lag growing, connection pool exhausted | **Storage** | Add read replicas → cache → shard; add indexes; pool connections | Adding web servers → more connections onto a saturated DB |
| Bandwidth saturated, connection caps hit, high cross-region RTT | **Network** | CDN/edge, compress payloads, pool/multiplex connections, keep chatty calls in one DC | Bigger DB or more app servers (neither is the limit) |

Diagnostic questions to ask before touching anything (the "production incident"
conversation, GUIDE #3): Did user count actually increase, or did per-user work?
Are DB latencies rising? Is the cache hit rate dropping? Is one shard/key hot?
Is a downstream dependency slow and causing retries upstream? The answer points
at one resource — fix that one.

## Vertical vs horizontal (the recurring fork)

| | Vertical (scale up) | Horizontal (scale out) |
|---|---|---|
| What | Bigger box: more CPU/RAM/disk | More boxes behind a balancer |
| Pro | Zero app changes; simplest; instant | Near-unlimited headroom; redundancy/failover |
| Con | Hard hardware ceiling; no failover; price climbs steeply near the top; reboot = full downtime | Requires statelessness; coordination, data distribution, more ops |
| Use first when | Traffic is low/moderate; quick relief; buying time | Large scale; high-availability requirement; elastic/bursty load |

Practical rule: scale **up** until the cost-per-unit knee or the hardware limit,
then scale **out**. Going horizontal requires removing state from the tier first
(see below) — do that before, not during, a scaling emergency. A DB can scale up
a long way (single powerful nodes hold many TB of RAM), which is why sharding is
often deferred far past the web tier going horizontal.

## Making a tier stateless (the unlock for rung 6)

Horizontal scale of the web/app tier only works if any request can hit any
server. Move state out:
- **Sessions / auth tokens** → shared store (Redis/Memcached or a DB), or
  stateless signed tokens (JWT) so no server-side lookup is needed.
- **Uploaded files / user media** → object storage or CDN, never local disk.
- **In-memory work state** → externalize or make the request self-contained.

Sticky sessions (pin a user to one server) are a stopgap, not a fix: they make
add/remove of servers and failure handling harder and unbalance load
(→ `load-balancing`). Prefer true statelessness. Once stateless, autoscaling
(add/remove servers on load) is safe — scale-down won't strand a user's data.

## Multi-region / multi-DC gotchas (rung 8)

Going multi-region buys latency (geo-route users to the nearest DC) and disaster
survival (lose a region, route 100% to the survivor). The hard parts are data,
not traffic:
- **Traffic redirection** — GeoDNS routes users to the nearest healthy DC; failover
  re-points all traffic to the survivor. Test the failover path; an untested
  failover is a hope, not a plan.
- **Data synchronization** — replicate datasets across regions so a failover DC
  actually has the data. Async cross-region replication means a lag window where
  the far region is behind; a failover can lose the un-replicated tail.
- **Conflict resolution** — active-active (writes in both regions) needs conflict
  handling or single-writer-per-key guarantees; the consistency/availability fork
  under partition lives in `consistency-coordination` (CAP/PACELC). Active-passive
  (one region writes, others read/standby) is simpler and often enough.
- **Test & deploy** — keep config and code consistent across DCs; deploy and load-
  test in each region. Drift between regions surfaces only during a failover, the
  worst possible time.

## Sharding triggers and traps (rung 9)

Shard only when one primary genuinely can't hold the writes or the data — it is
the most complex rung. Mechanics (partition keys, consistent hashing,
rebalancing) are owned by `data-storage` and `consistency-coordination`; here are
the scaling-decision points:
- **Pick a shard key that spreads load evenly.** A poor key creates a
  hotspot/celebrity shard that re-centralizes the bottleneck you sharded to remove.
- **Resharding is expensive.** When a shard fills or load skews, the key/function
  changes and data moves; consistent hashing limits how much moves. Plan headroom.
- **Cross-shard joins/transactions get hard.** Denormalize or fan out queries;
  spanning a transaction across shards is a distributed-transaction problem
  (→ `consistency-coordination`).
- **Cheaper alternatives first.** Functional partitioning (split DBs by feature —
  users / posts / billing) and read replicas + cache often defer sharding for a
  long time. Try those before key-based sharding.

## Operational maturity that grows with the rungs

As the system climbs, the ability to *see* the next bottleneck matters as much as
the architecture. Centralized logging, host- and tier-level metrics (CPU, IO,
replica lag, cache hit rate, queue depth), and automated deploy/rollback are what
let you diagnose "what's breaking now" instead of guessing. Without them, every
scaling decision regresses to the "add more servers" reflex. These are not a rung
themselves — they are the instrument panel for climbing the ladder safely.
