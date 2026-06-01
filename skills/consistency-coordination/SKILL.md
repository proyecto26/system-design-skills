---
name: consistency-coordination
description: This skill should be used when the user asks about the "CAP theorem", "PACELC", a "consistency model", "eventual vs strong consistency", "read-your-writes", "causal consistency", "quorum" or "R+W>N", "consensus", "Raft / Paxos", "leader election", "consistent hashing", a "distributed transaction", "2PC", or "saga". Use it whenever a design has multiple copies of data or coordinating nodes and a decision hinges on what a reader is guaranteed to see during replication lag, a network partition, or a node failure — even if the user doesn't say "consistency".
---

# Consistency & Coordination

Decide what a reader is guaranteed to see when data lives on more than one node,
and how independent nodes agree on a single answer. Get this wrong and the system
either serves stale or conflicting data silently, or stalls the moment a network
link drops — the most common and most punishing distributed-systems failure.

## When to reach for this
Any time state is replicated, sharded, or coordinated across nodes: choosing a
replication or quorum scheme, picking a consistency level, electing a leader,
spreading keys across an elastic fleet (consistent hashing), or committing a
change that spans services. Reach here the instant someone asks "what does a read
see right after a write?" or "what happens during a partition?"

## When NOT to
A single node with no replicas has nothing to coordinate — don't invoke quorums or
consensus for it (YAGNI). Most apps tolerate seconds of staleness; reaching for
strong consistency or distributed transactions when eventual consistency would do
buys latency and operational pain for a guarantee no requirement asked for. The
cheapest model that satisfies the invariant wins. Naming Raft or 2PC before a
correctness requirement forces it is a red flag.

## Clarify first
- **What breaks if a read is stale?** A wrong balance vs a slightly old like count
  are different systems. (→ `requirements-scoping`.)
- **Must a user see their own writes immediately?** Read-your-writes is far cheaper
  than global strong consistency.
- **What is the blast radius of a partition or lost region?** Drives the CAP/PACELC
  choice. (GUIDE failure mode #1.)
- **Write contention and conflict shape** — single-writer per key, or concurrent
  writers needing conflict resolution?
- **Latency budget** — synchronous coordination adds a round trip (or a
  cross-region one); confirm the budget allows it. (→ `back-of-the-envelope`.)

## The options

**Pick a consistency model** (the guarantee a read gets):
- **Strong / linearizable** — every read sees the latest committed write. Use when
  an invariant must hold globally (balances, inventory, uniqueness).
- **Read-your-writes / monotonic** — a session sees its own writes and never goes
  backward. Use for profile edits, "post then see your post".
- **Causal** — reads respect cause→effect order (a reply never precedes its
  parent). Use for comments, chat, collaborative edits.
- **Eventual** — replicas converge "soon"; reads may lag. Use for like counts,
  feeds, caches — anything where staleness is cheap.

**Pick how copies agree:**
- **Single-leader (primary)** — one node orders all writes; followers replicate.
  Use when a clear write owner is acceptable; the common default.
- **Quorum (R + W > N)** — read/write to a majority; tune R and W per workload.
  Use for leaderless stores needing tunable consistency and availability.
- **Consensus (Raft / Paxos)** — a majority agrees on a replicated log, even across
  failures. Use for the control plane: leader election, config, metadata, locks.

**Coordinate a multi-key / multi-service change:**
- **Saga** — a sequence of local transactions with compensating undos. Use across
  services where a global lock is impossible; accepts eventual consistency.
- **2PC / distributed transaction** — atomic all-or-nothing across nodes via a
  coordinator. Use only when atomicity is mandatory and the cost is accepted.

**Spread keys across nodes — consistent hashing** (this skill owns it): map keys
and nodes onto a hash ring; a key belongs to the next node clockwise. Adding or
removing a node remaps only ~K/N keys instead of nearly all (as plain
`hash(key) % N` does), avoiding a remap storm. Virtual nodes even out load and tame
hotspots. It is the standard partitioning scheme for caches, leaderless stores, and
LB backends. Mechanics in `references/deep-dive.md`.

## Trade-offs

| Option | What it solves | What it worsens | Change it when |
|---|---|---|---|
| Strong/linearizable | Correctness; no stale reads | Latency (a round trip / quorum); unavailable under partition (CP) | Staleness becomes tolerable → relax to read-your-writes/eventual |
| Read-your-writes | "See my own change" without global cost | Other users still see stale; needs session/sticky routing | A global invariant appears → go strong |
| Eventual | Highest availability + lowest latency (AP) | Stale and conflicting reads; needs conflict resolution | An invariant can't tolerate divergence → stronger model |
| Single-leader | Simple ordering; no write conflicts | Leader is a write SPOF; failover gap; reads from followers lag | Write throughput exceeds one node, or leader region lost → multi-leader/quorum |
| Quorum (R+W>N) | Tunable consistency vs availability per call | Higher read+write cost; still needs conflict handling on concurrent writes | Even one quorum slow path is too costly → leader or local reads |
| Consensus (Raft/Paxos) | Agreement that survives node loss | Majority required (loses availability below quorum); write latency; complex | The data plane needs it at scale → push coordination to a service |
| Saga | Cross-service change without a global lock | No isolation; partial states visible; must design compensations | True atomicity is required → 2PC (and accept its cost) |
| 2PC | Atomic multi-node commit | Coordinator is a SPOF; locks held across the vote; blocks on failure | Availability/throughput matter more than strict atomicity → saga |

## Behavior under stress
This block's whole purpose is the failure case — what happens when the network or a
node breaks (GUIDE #1, #6).

- **Network partition** is the forcing function (the C-vs-A choice in CAP). A
  CP/strong system *rejects writes* on the minority side to protect invariants — it
  trades availability for correctness. An AP/eventual system *accepts writes
  everywhere* and reconciles later — it trades correctness for availability. State
  which one you chose and why; there is no third option that keeps both.
- **Leader loss** triggers an election. During the gap, writes pause (single-leader)
  or proceed risky (if you let a stale leader keep writing → **split-brain** and
  divergent histories). Fencing tokens and a majority quorum prevent two leaders.
- **Quorum below majority** (too many nodes down) means a strict quorum store stops
  accepting writes — by design. More nodes down than `N − W` blocks writes; more
  than `N − R` blocks reads.
- **Coordination amplifies outages:** a 2PC coordinator crash leaves participants
  holding locks (blocking); a consensus cluster that loses quorum freezes the
  control plane and everything depending on it. Aggressive leader-election timeouts
  can cause election storms (repeated re-elections under load).
- **Monitor:** replication lag (the staleness window), leader-election rate and
  duration, quorum health (reachable nodes vs N), conflict/repair rate, and—for
  consistent hashing—per-node key distribution and rebalance volume.

Failover trade-offs (active-passive vs active-active, data-loss windows) are
covered by `resilience-failure`; this block supplies the consistency cost of each.

## How to apply
1. **Clarify the invariant.** Pin down what breaks on a stale or conflicting read,
   whether a user must see their own writes, and the partition blast radius (use the
   Clarify-first questions). No invariant → default to eventual and stop.
2. **Pick the model and the agreement scheme** from the Trade-offs table: match the
   guarantee to the weakest invariant the data can tolerate, then choose
   single-leader / quorum / consensus by who owns writes and what must survive node
   loss. Add a saga or 2PC only when a change spans services and atomicity is forced.
3. **Set the knobs.** Pin the consistency level per *operation* (not per datastore),
   set `N`, `R`, `W` so `R + W > N` where overlap is required, choose a conflict
   policy (LWW / version-vector / app resolver), and pick consistent hashing for key
   placement when the fleet is elastic.
4. **Stress-test the choice.** State the CAP stance explicitly: what happens on a
   partition, on leader loss, and below quorum. Confirm split-brain is fenced and
   coordination can't amplify an outage into a cluster-wide freeze.
5. **Size it with numbers.** Price the coordination round trips (same-DC vs
   cross-region) against the latency budget and size `N` for the failure target, via
   `back-of-the-envelope`. If strong consistency blows the budget, relax the model.
6. **Map to a provider.** Default to the generic recipe; if a cloud is named, read its
   provider file for the managed consistency knobs and quorum-store limits.

## Dos and don'ts
**Do**
- Pin the guarantee on the *operation* — most reads eventual, only invariant-bearing
  ones strong — so coordination cost is paid only where it earns correctness.
- State the CAP stance out loud: on a partition, name which side rejects writes (CP)
  or accepts and reconciles (AP). There is no option that keeps both.
- Size `R`, `W`, `N` for overlap and a failure target, and fence leaders with a
  majority quorum plus fencing tokens.
- Return a version (or vector clock) so callers can detect and resolve conflicts.

**Don't**
- Don't reach for strong consistency, consensus, or 2PC before an invariant forces
  it — staleness is usually cheap, and global coordination buys latency and pain.
- Don't run synchronous strong consistency or 2PC across regions on a tight write
  budget; a cross-region round trip can add 100 ms+.
- Don't let a stale leader keep writing during an election gap — that is split-brain.
- Don't shard keys with `hash(key) % N`; a membership change then remaps nearly all
  keys instead of ~`K/N`.

## Numbers that matter
Coordination cost is dominated by round trips, not CPU. A same-datacenter round
trip is sub-millisecond; a cross-region one is tens to ~100+ ms — so synchronous
strong consistency or 2PC across regions can add 100 ms+ per write. Quorum size is
`⌊N/2⌋ + 1`; with `N=3`, two nodes must agree, so the cluster survives one failure.
Consistent hashing remaps only ~`K/N` keys on a membership change (vs ~all for
modulo). Use the latency table and the availability-nines math in
`back-of-the-envelope` to price the round trips and to size N for a failure target.

## Interface sketch
The contract is the **guarantee**, stated explicitly per operation, plus the knobs
that produce it:

```
ConsistencyLevel: STRONG | READ_YOUR_WRITES | CAUSAL | EVENTUAL
Quorum:           N (replicas), W (write acks), R (read acks)  // R + W > N ⇒ overlap
Write API:        write(key, value, level=STRONG) -> {version|vector_clock}
Read API:         read(key, level=EVENTUAL)       -> {value, version, stale?: bool}
Conflict policy:  last-write-wins(ts) | version-vector-merge | app-resolver
```

Pin the level on the *operation*, not the datastore — most reads can be eventual
while a few (the invariant-bearing ones) demand strong. Return a version so callers
can detect and resolve conflicts.

## Choosing a provider
Default to the generic recipe above. If the user names a cloud, read
`references/providers/<provider>.md` for the managed-service mapping,
quotas/limits, and provider-specific trade-offs. If no file exists for that
provider, the generic recipe is the answer.

## Diagram
To visualize a leader-follower-under-partition scenario, a quorum read/write, or a
consistent-hashing ring, use the in-plugin `architecture-diagram` skill. An inline
sketch (`client → leader → [replication stream] → followers`, with the partition as
a dashed/broken arrow) is fine for quick reasoning; do not embed Mermaid.

## Related building blocks
- `data-storage` — *pairs with* this: it owns replication and sharding/partitioning (the mechanics), this block supplies the consistency guarantee they enforce.
- `messaging-streaming` — *alternative to* coordinating in the data plane: message ordering and exactly-once delivery are the same problem at the transport layer; pair when events must be ordered or deduplicated.
- `resilience-failure` — *feeds into* this: it owns failover, retries, and graceful degradation; this block prices the consistency cost of the availability mechanics it provides.
- `caching` — *depends on* consistent hashing (the owned-concept lives here) to shard a distributed cache, and trades freshness for speed.
- `back-of-the-envelope` — *owned-concept lives in* it: the latency table and availability-nines math used to price round trips and size `N`.
- `system-design` — the orchestrator that *routes here* when a design replicates or coordinates state.

## References
- **`references/deep-dive.md`** — CAP vs PACELC in full, consistency-model mechanics, the quorum math, Raft/Paxos at a high level, leader election & split-brain (fencing), consistent-hashing ring + virtual nodes, and 2PC vs saga internals. Read when designing the coordination layer in detail.
- **`references/providers/{generic,aws,gcp}.md`** — coordination services (ZooKeeper/etcd/Consul), quorum stores, and the managed consistency knobs (e.g. Spanner external consistency, DynamoDB consistent-read flag) per environment.
