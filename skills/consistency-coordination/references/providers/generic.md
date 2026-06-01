# Consistency & coordination — generic (vendor-neutral / self-hosted)

The default answer. These open-source/self-host tools implement the SKILL.md
options. If the user names a cloud with no provider file here, this is still the
answer — describe the generic tool and note the managed equivalent exists.

## Service mapping (option → tool)

- **Consensus / leader election / locks / config** → **etcd**, **ZooKeeper**, or
  **Consul**. All run a Raft (etcd, Consul) or ZAB (ZooKeeper) majority-quorum
  cluster and expose: strongly-consistent key/value, watches, ephemeral nodes /
  leases (the primitive for **leader election** and **distributed locks**), and
  membership/service discovery. Reach for these for the **control plane**, not the
  bulk data plane.
- **Single-leader replication** → **PostgreSQL / MySQL** with one primary + sync or
  async replicas. Synchronous replica = no data-loss window but higher write
  latency; async = a small loss window on failover. (Storage engine details →
  `data-storage`.)
- **Quorum / leaderless (R+W>N)** → **Apache Cassandra** or **Riak**: per-query
  tunable consistency (`ONE`, `QUORUM`, `ALL`), consistent-hashing partitioning,
  hinted handoff, read repair. The textbook tunable-consistency store.
- **Consistent-hashing partitioning** → built into Cassandra/Riak/Dynamo-style
  stores and into client libraries for **Redis**/**Memcached** sharding; or roll
  your own ring with virtual nodes.
- **Distributed transaction (2PC)** → an **XA**-capable transaction manager across
  XA resources; rarely worth it cross-service.
- **Saga** → orchestrate with a workflow engine (e.g. **Temporal**) or choreograph
  over a broker (see `messaging-streaming`); the engine handles retries,
  compensations, and idempotency.

## Key limits / things that bite (verify against current docs)

- **Quorum cluster sizing:** use an **odd** count (3 or 5). `2f+1` nodes tolerate `f`
  failures; below majority the cluster **stops accepting writes** by design. A 2- or
  4-node cluster buys no extra tolerance and worsens split-vote odds.
- **etcd/ZooKeeper are control-plane stores**, not databases: bounded total
  dataset, request-size caps, and watch/connection limits. Putting bulk data or
  high-write-rate state in them will tip them over.
- **Write latency is a round trip to a majority** — co-locate consensus members in
  one region (or accept tens-to-100+ ms per write across regions).
- **Synchronous replication** stalls writes if a required replica is slow/down;
  decide whether a slow replica should block or be dropped from the sync set.

## Provider-neutral trade-offs

- Strong consistency = a coordination round trip on the write path *and* a quorum
  that can refuse service under partition (CP). Price both before choosing it.
- Tunable stores (Cassandra) let you mix per query, but `QUORUM` reads+writes cost
  more nodes per op and still need conflict handling for concurrent writers.
- Leader-based systems are simplest but the leader is a write SPOF with a failover
  gap; quantify the gap against the availability target (→ `back-of-the-envelope`).

## Pitfalls

- Reaching for ZooKeeper/etcd as a general database (it's a coordination kernel).
- Running an even-sized quorum cluster.
- Cross-region synchronous consensus without budgeting the round-trip latency.
- Building leader election by hand (timeouts, fencing) instead of using a lease/
  ephemeral-node primitive — easy to create split-brain.
- Hand-rolling 2PC for cross-service workflows where a saga avoids the blocking
  coordinator.
