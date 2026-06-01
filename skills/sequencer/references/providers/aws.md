# Sequencer — AWS

## Service mapping
There is **no dedicated AWS ID-generation service** — the generic recipe (a
Snowflake library, ULID/UUIDv7, or a ticket row) is the answer. What AWS changes
is *where you store and shard* the ID and how you run the allocator:

- **DynamoDB** — IDs are your **partition key**. A monotonic/sequential key
  concentrates writes on one partition (hot partition); use a high-cardinality key
  (UUIDv7/ULID/Snowflake) or add a write-sharding prefix. DynamoDB has **no
  auto-increment**; an atomic-counter item (`UpdateItem ADD`) can act as a small
  ticket server but serializes on that one item.
- **Aurora / RDS (MySQL, Postgres)** — native `AUTO_INCREMENT`/`SEQUENCE` and the
  ticket-server pattern work as in generic. Aurora's single writer means a single
  sequence still serializes through it.
- **Lambda / ECS / EC2** — host the Snowflake/ULID library here. For Snowflake,
  the challenge is node-ID assignment under autoscaling (see below).
- **ElastiCache (Redis)** — `INCR`/`INCRBY` gives an atomic counter or a fast
  range allocator (claim a block with `INCRBY`), backed by Redis durability
  settings.

## Limits / things that bite (verify against current docs)
- **DynamoDB partition throughput** is capped per partition (order of a few
  thousand WCU); a sequential partition key funnels all new writes there. This is
  the most common ID-related AWS failure — partitioning fix lives in `data-storage`.
- **Lambda has no stable node identity** — concurrent executions scale elastically
  and reuse nothing, so a static Snowflake node id is unsafe. Lease a node id (e.g.
  from a DynamoDB item with a TTL) or prefer ULID/UUIDv7 which need no node id.
- **Clock:** EC2/Lambda clocks are NTP-synced but can still step; keep the
  rewind guard. (Verify current quotas against AWS docs — they drift.)

## Provider-specific trade-offs
- Choosing DynamoDB strongly nudges you toward UUIDv7/ULID/Snowflake (high
  cardinality) and away from sequential keys — a real design constraint, not a
  preference.
- An atomic-counter item or Redis `INCR` ties your ID rate to one item/key's
  throughput; range-allocate to relieve it.

## Pitfalls
- Sequential ID as a DynamoDB partition key → hot partition and throttling.
- Static Snowflake node ids on Lambda/Fargate → duplicates under scale-out.
- Assuming DynamoDB can auto-increment — it can't; you build the allocator.
