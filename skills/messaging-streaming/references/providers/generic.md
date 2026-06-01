# Messaging & streaming — generic (self-host / open source)

The vendor-neutral default. If no cloud is named, this is the answer.

## Service mapping → the generic options
- **Queue (work queue):** **RabbitMQ** (AMQP, rich routing, acks, per-message TTL,
  built-in DLX/dead-lettering) or **Redis Streams / Lists** (simple, fast, fewer
  guarantees). RabbitMQ for real delivery guarantees and routing; Redis for a
  light, fast broker when occasional loss is tolerable.
- **Pub/sub (fan-out):** **NATS** (lightweight, low-latency; core NATS is
  at-most-once, **JetStream** adds persistence + at-least-once) or RabbitMQ
  fanout/topic exchanges. NATS when you want simple, fast fan-out at the edge.
- **Stream (durable log):** **Apache Kafka** (partitioned, retained, replayable,
  consumer groups, transactions for effective-once *within* Kafka) — the default
  log. **Redis Streams** for a smaller-scale replayable log. **Pulsar** as a
  Kafka alternative with built-in tiered storage and multi-tenancy.
- **Durable workflow:** **Temporal** (open-source, self-hostable) — see
  `temporal.md` for when to choose it over hand-rolled orchestration.

## Decision-changing limits (verify against current docs)
- **Kafka:** ordering is per-partition only; consumer parallelism is capped at
  partition count per group; increasing partitions rehashes keys and breaks
  in-flight per-key order. Replication factor + `min.insync.replicas` set the
  durability/availability trade-off. Throughput is high (sequential disk writes).
- **RabbitMQ:** strong routing and per-message acks, but throughput is lower than
  a log and a deep queue in memory pressures the node. Quorum queues for
  durability; classic mirrored queues are deprecated.
- **Redis Streams:** in-memory first — durability depends on AOF/RDB; sizing must
  fit the retained stream in RAM or it evicts.
- **NATS core:** at-most-once (no persistence); use JetStream for retention/acks.

## Provider-specific trade-offs
- Self-hosting means *you* run replication, failover, upgrades, partition
  rebalancing, and capacity — real operational load. The payoff is no lock-in and
  full control of guarantees.
- Kafka's strength (a retained, replayable log) is also its cost: cluster +
  ZooKeeper/KRaft, partition planning, and consumer-offset management.

## Pitfalls
- Picking Kafka for a simple background-job queue — partitions, offsets, and
  cluster ops are overkill when RabbitMQ/SQS-style work queues fit.
- Using Redis as a broker and assuming durability — un-persisted messages vanish
  on restart (the classic "Redis loses messages" trap).
- Forgetting RabbitMQ needs explicit DLX config and publisher confirms; without
  them you get neither dead-lettering nor at-least-once publication.
- Setting Kafka partitions too low (caps consumer scaling) or too high (rebalance
  and metadata overhead).
