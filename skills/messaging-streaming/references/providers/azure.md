# Messaging & streaming — Azure

## Service mapping → the generic options
- **Service Bus (Queues)** — managed work queue; at-least-once, sessions for
  per-key ordering, built-in dead-lettering, scheduled/deferred messages,
  duplicate detection within a window. The default enterprise queue.
- **Service Bus (Topics/Subscriptions)** — pub/sub fan-out with per-subscription
  filters. Use when multiple consumers need filtered copies of events.
- **Event Grid** — lightweight event routing/pub-sub for reactive,
  event-driven integration (resource events, custom topics). Push-based, at-least-once.
- **Event Hubs** — partitioned, replayable log (the Kafka/Kinesis analog); ordering
  per partition, consumers track offsets; exposes a **Kafka-compatible endpoint**.
  Use for high-throughput streaming/telemetry and replay.

## Decision-changing limits (verify against current docs)
- **Service Bus message size** depends on tier (Standard ~256 KB; Premium larger);
  big payloads → blob + claim-check.
- **Sessions** are how you get FIFO/per-key ordering on Service Bus — without a
  session the queue is competing-consumer (no order). One session = one consumer.
- **Service Bus duplicate detection** works within a configured time window only;
  beyond it, consumers must still be idempotent.
- **Event Hubs** throughput is bought in **throughput units / processing units**;
  parallelism = partition count, fixed at creation (plan ahead). Ordering per
  partition only; a hot partition key throttles one partition.

## Provider-specific trade-offs
- Service Bus (queues/topics) vs. Event Hubs/Event Grid is the queue-vs-stream-vs-
  event-routing split: Service Bus for command/job processing with rich delivery
  semantics; Event Hubs for high-volume replayable streams; Event Grid for
  reactive routing.
- Premium tier buys predictable performance and larger messages at higher cost.
- For durable workflows Azure offers **Durable Functions** (orchestration as code
  on Functions) — compare with Temporal in `temporal.md`.

## Pitfalls
- Expecting FIFO from a plain Service Bus queue — you must use **sessions**.
- Treating duplicate detection as exactly-once beyond its window → double effects.
- Fixing Event Hubs partition count too low and discovering it can't be raised
  without recreating — over-provision early.
- Ignoring the dead-letter sub-queue Service Bus auto-populates (max-delivery,
  expiry, filter failures) — monitor and drain it.
