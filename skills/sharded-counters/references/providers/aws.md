# Sharded counters — AWS

Only the contention/atomicity differences that change the recipe. Default to the
generic recipe; this maps it to AWS services.

## Service mapping
- **DynamoDB atomic counter** — `UpdateItem` with an `ADD`/`SET c = c + :n`
  expression increments a number attribute atomically. The single-counter
  option.
- **DynamoDB + write sharding** — append a random suffix to the partition key
  (`pk = id#shard{rand(0..N-1)}`), increment the sharded item, and **sum the N
  items** (a `Query` or N `GetItem`s) on read. The striped-counter recipe — and
  the standard fix for a hot partition.
- **ElastiCache for Redis / Valkey** — managed Redis for the fast path: `INCR`,
  HyperLogLog (`PFADD`/`PFCOUNT`), key sharding. Use when you want
  microsecond increments and built-in HLL.
- **Amazon Keyspaces (Cassandra)** — managed counter columns for
  distributed-scale eventual counts (same non-idempotent caveat as generic).

## When to pick which
DynamoDB atomic counter when the item is durable system-of-record and write rate
fits one partition; DynamoDB write-sharding when a single partition key goes hot;
ElastiCache Redis when the count is a fast/ephemeral tally with HLL needs.

## Limits / things that bite (verify against current docs)
- A DynamoDB **partition** has a hard write ceiling (historically ~1,000 WCU/s);
  hammering one key is a **hot partition** that throttles regardless of table
  capacity — write-sharding the key is the fix.
- DynamoDB updates are atomic per item but the table is eventually consistent on
  reads unless you request a strongly-consistent read (which costs more and can't
  span the N sharded items as one transaction).
- Reading a write-sharded total is N reads + a client-side sum; size N against
  the per-partition ceiling, not the average.
- ElastiCache Multi-AZ failover takes seconds and can drop un-replicated
  increments.

## Pitfalls
- Leaving a viral counter on one partition key and blaming "DynamoDB throttling"
  — it's a hot partition; shard the key.
- Assuming a single `UpdateItem ADD` scales infinitely — it's capped by the
  partition.
- Forgetting the N-shard read can't be one strongly-consistent transaction — the
  summed total is eventually consistent.
- Lock-in: DynamoDB key-sharding layout and Keyspaces counters don't port
  directly to other clouds.
