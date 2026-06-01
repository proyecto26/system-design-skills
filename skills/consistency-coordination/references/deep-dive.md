# Consistency & coordination deep-dive

The mechanics that would bloat SKILL.md: the theorems in full, the model
definitions, the quorum math, the consensus and election protocols, the hash ring,
and the commit protocols. Read when designing the coordination layer in detail.

## CAP, then PACELC (the real rule)

**CAP:** when a network **P**artition splits the nodes, a distributed store can keep
either **C**onsistency (every read sees the latest write or errors) or
**A**vailability (every request gets a non-error response), not both. Partitions are
not optional — networks drop — so the genuine choice is **CP vs AP** *during a
partition*:

- **CP** (e.g. a quorum/consensus store, a single-leader DB): the minority side
  refuses writes (and possibly reads) rather than diverge. Correct, but unavailable
  for some clients until the partition heals.
- **AP** (e.g. Dynamo-style, multi-leader): every replica keeps serving and accepts
  writes locally; divergence is reconciled later via conflict resolution.

CAP only describes the partition case, which misleads people into thinking
consistency is free the rest of the time. **PACELC** fixes that: *if Partition, then
A or C; Else (normal operation), then Latency or Consistency.* The everyday cost of
strong consistency is **latency** — the coordination round trip on every write (and
strong read), even when nothing is broken. Most "is it CP or AP" debates are really
the **E**LC half: how much latency you'll pay for fresher reads.

## Consistency models, precisely

Ordered strongest → weakest:

- **Linearizable (strong):** operations appear to take effect instantly at a single
  global point in time, in real-time order. A read returns the most recent committed
  write, full stop. Requires coordination on every write (and often reads).
- **Sequential:** all nodes see operations in the *same* order, but not necessarily
  real-time order. Weaker than linearizable; rarely the explicit target in practice.
- **Causal:** operations with a cause→effect (happens-before) relationship are seen
  in that order by everyone; concurrent (unrelated) operations may be seen in
  different orders. Implemented with version/vector clocks. Good for chat, comments,
  collaborative editing — a reply never appears before the message it answers.
- **Read-your-writes (session):** within one client session, reads always reflect
  that session's prior writes. Cheap to provide — route the session to the primary
  (or to a replica known to be caught up) for a short window after a write, or carry
  the write's version and read against a replica that has it.
- **Monotonic reads:** a session never sees data move *backward* in time (no reading
  a newer value then an older one). Often bundled with read-your-writes as "session
  guarantees".
- **Eventual:** if writes stop, all replicas converge. Says nothing about *when* or
  about intermediate reads. Highest availability; needs conflict resolution.

A system rarely needs one global model. Pin the level per operation: most reads
eventual, the few invariant-bearing ones strong.

## Quorum math (R + W > N)

With `N` replicas, require `W` acks to commit a write and `R` acks to serve a read.
If `R + W > N`, the read set and write set must **overlap** by at least one replica,
so a read is guaranteed to touch a node holding the latest write — giving strong
consistency without a single leader.

- `W = N, R = 1`: fast reads, slow/fragile writes (every replica must ack).
- `R = N, W = 1`: fast writes, slow reads.
- `R = W = ⌊N/2⌋ + 1` (majority): balanced; tolerates `⌊(N−1)/2⌋` node failures.
  With `N=3`, `R=W=2` survives one node down.

Caveats: quorum overlap guarantees you *read* a current copy, but with concurrent
writers you can still get **conflicting versions** at the overlap node — resolve via
version vectors or last-write-wins. **Sloppy quorum + hinted handoff** (Dynamo)
keeps accepting writes on substitute nodes during failures, trading the strict
overlap guarantee for availability.

## Consensus: Raft / Paxos at altitude

Consensus protocols get a cluster to agree on an ordered **replicated log** of
operations even though nodes crash and messages are lost — the foundation under
strongly-consistent stores, leader election, locks, and config.

- **Raft** (the one to be able to explain): elects a single **leader** for a *term*.
  Clients send writes to the leader; it appends to its log and replicates to
  followers; once a **majority** persist an entry it is *committed* and applied.
  Followers that miss the leader's heartbeat start an election by incrementing the
  term and requesting votes; a candidate wins with a majority. A randomized election
  timeout makes split votes rare.
- **Paxos** solves the same agreement problem (prepare/promise → accept/accepted
  phases) and is famously harder to reason about; Multi-Paxos amortizes it for a log.
  Raft was designed to be the understandable equivalent.

The universal constraint: progress needs a **majority**. A cluster of `2f+1` nodes
tolerates `f` failures; below quorum it **stops** (CP) rather than risk divergence.
This is why control-plane clusters are sized 3 or 5, not 2 or 4 (an even number buys
no extra fault tolerance and worsens split-vote odds).

## Leader election & split-brain

A leader (primary) gives a clean single writer, so failover correctness is the whole
game. The danger is **split-brain**: a partition (or a paused-then-resumed old
leader) leaves *two* nodes each believing they lead, accepting divergent writes.

Defenses:
- **Majority-based election** (Raft/ZooKeeper/etcd): a node can lead only with votes
  from a majority, so two leaders in the same term are impossible.
- **Fencing tokens:** the election hands the new leader a monotonically increasing
  token; downstream stores reject any write carrying a stale token, so a zombie old
  leader cannot commit even if it still thinks it's in charge.
- **Lease/TTL:** a leader holds a time-bounded lease it must renew; if it can't reach
  the coordinator to renew, it must step down before the lease expires.

Tune election timeouts carefully — too aggressive and transient latency triggers
**election storms** (constant re-elections that stall the cluster).

## Consistent hashing (owned here)

Plain `serverIndex = hash(key) % N` remaps *nearly every* key when `N` changes (a
node joins/leaves), causing a mass cache-miss / data-shuffle storm. Consistent
hashing fixes this:

1. Hash the output space into a **ring** (e.g. 0 … 2^160−1, ends joined).
2. Hash each **node** (by IP/name) onto a point on the ring.
3. Hash each **key** onto the ring; it belongs to the **first node clockwise**.
4. Adding a node steals only the keys between it and its anticlockwise neighbor;
   removing a node hands its keys to the next node clockwise. Only ~`K/N` keys move.

**Virtual nodes (replicas):** one physical node is placed at *many* ring points
(e.g. 100–200). This fixes the two weaknesses of the naive ring — uneven partition
sizes and lumpy key distribution — by smoothing the load (standard deviation drops as
virtual-node count rises). More virtual nodes ⇒ more even distribution but more
metadata; tune to taste. Virtual nodes also **mitigate hotspots**: a celebrity key's
neighbors are spread across different physical nodes instead of piling onto one.

Used in: Dynamo/Cassandra partitioning, Discord, Akamai's CDN, and Maglev network
load balancers. It is why `caching`, `data-storage`, and `load-balancing` can scale
their fleets elastically — they all link here for the mechanism.

## 2PC vs saga (multi-node atomicity)

When one logical change spans nodes/services, two shapes exist:

- **Two-phase commit (2PC):** a **coordinator** runs *prepare* (each participant
  locks and votes yes/no), then *commit* or *abort* based on the votes — atomic
  all-or-nothing. Cost: participants **hold locks** between phases (reduced
  concurrency), and a coordinator crash after prepare leaves them **blocked**
  (in-doubt) until it recovers — a liveness and SPOF hazard. 3PC reduces blocking at
  more message cost but is rarely used. Use 2PC only when atomicity is mandatory and
  the coordination cost is acceptable; it does not scale across regions or services
  well.
- **Saga:** model the change as a sequence of **local** transactions, each with a
  **compensating** transaction that semantically undoes it (refund, cancel, release).
  On failure partway, run the compensations for the steps already done. No global
  lock, no coordinator SPOF — but **no isolation**: intermediate states are visible
  (an order can briefly exist "paid but not shipped"), and compensations must be
  idempotent and always eventually succeed. Orchestrated (central coordinator) or
  choreographed (events) — see `messaging-streaming` for the event plumbing and
  exactly-once/idempotency that make sagas safe.

Rule of thumb: prefer a saga across service boundaries; reach for 2PC only inside a
tight, low-latency boundary where true atomicity is non-negotiable.

## Common mistakes

- Claiming "CA" — there is no CA system once you admit partitions happen.
- Treating CAP as the whole story and ignoring the latency cost of consistency in
  normal operation (PACELC's ELC half).
- Running an even-sized consensus/quorum cluster (no extra fault tolerance).
- Letting an old leader keep writing after a partition (no fencing) → split-brain.
- Using `hash % N` for an elastic fleet → remap storm on every scale event.
- Choosing 2PC for cross-service workflows where a saga would avoid the blocking SPOF.
- Picking strong consistency globally when only a handful of operations need it.
