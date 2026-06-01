# Consistency & coordination — AWS

Only the managed pieces that change the generic recipe. For anything not listed,
the generic recipe (self-hosted etcd/ZooKeeper, Cassandra, etc.) is the answer.

## Service mapping
- **DynamoDB** — leaderless, quorum-replicated store with a **per-read consistency
  knob**: default **eventually consistent** reads (cheaper, may lag); pass
  `ConsistentRead=true` for a **strongly consistent** read (latest committed, ~2× the
  read cost, single-region only). This is the decision-changing detail: consistency
  is chosen *per request*, not per table.
- **DynamoDB global tables** — multi-region, **multi-leader / last-write-wins**
  (AP across regions): every region is writable and converges; cross-region reads
  are eventually consistent. Strong reads do **not** span regions.
- **DynamoDB transactions** (`TransactWriteItems`) — ACID across items in one region
  via an internal 2PC-like protocol; single-region, item-count and size limited.
- **Aurora / RDS** — single-leader (writer) + replicas; reads from replicas lag.
  Multi-AZ failover takes seconds (a write-availability gap).
- **No managed ZooKeeper/etcd as a primitive** — run them yourself, or use
  application-level coordination; **MSK** ships ZooKeeper/KRaft for Kafka's own use.

## Limits / things that bite (verify against current docs)
- Strong reads in DynamoDB are single-region and don't work on global secondary
  indexes; global tables are LWW, so concurrent cross-region writes silently lose.
- DynamoDB partition throughput is per-partition-key — a hot key throttles one
  partition regardless of table capacity (consistent hashing spreads keys, not a
  single hot key).
- Multi-AZ RDS/Aurora failover is seconds, and async replicas can lose the last
  un-replicated writes.

## Pitfalls
- Assuming DynamoDB reads are strong by default — they are eventual unless you ask.
- Expecting global-table strong consistency across regions (it's LWW eventual).
- Treating LWW conflict resolution as safe for counters/accumulators (it isn't —
  use atomic counters or a CRDT-style model).
