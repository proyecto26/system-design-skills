# Messaging & streaming — AWS

## Service mapping → the generic options
- **SQS (Standard)** — managed work queue; at-least-once, best-effort ordering,
  near-infinite throughput. The default queue. Built-in DLQ via redrive policy.
- **SQS (FIFO)** — exactly-once *processing* (within a dedup window) and ordering
  per `MessageGroupId`; lower throughput than Standard. Use when order/dedup matter.
- **SNS** — pub/sub fan-out; push to SQS, Lambda, HTTP. SNS→SQS fan-out is the
  canonical AWS decouple-and-fan-out pattern.
- **EventBridge** — event bus with content-based routing/filtering and SaaS
  integrations; pub/sub with rules. Use for cross-service event routing.
- **Kinesis Data Streams** — partitioned, replayable log (the Kafka analog);
  ordering per shard, consumers track position. Use for streams/replay.
- **MSK** — managed Apache Kafka; use when you specifically need Kafka APIs/ecosystem.

## Decision-changing limits (verify against current docs)
- **SQS message size** ~256 KB (larger → S3 + claim-check pointer).
- **SQS visibility timeout** governs redelivery; shorter than job time → duplicate
  processing. Max in-flight messages is bounded.
- **SQS FIFO throughput** is far lower than Standard (raised by batching /
  high-throughput mode, still a ceiling); ordering is per `MessageGroupId`.
- **Kinesis** ~1 MB/s or 1000 records/s write **per shard**, ~2 MB/s read;
  parallelism = shard count; resharding is an operation. A hot partition key
  saturates one shard.
- **SNS/EventBridge** are at-least-once → subscribers must be idempotent.

## Provider-specific trade-offs
- SQS Standard can deliver duplicates and out of order — consumers must be
  idempotent (the AWS "delivered twice" gotcha). FIFO removes most of this at a
  throughput cost.
- Managed DLQ is first-class (redrive), but you must set max receives and *watch*
  the DLQ — it's silent by default.
- Kinesis vs. MSK: Kinesis is simpler/serverless-ish but AWS-specific (lock-in);
  MSK is portable Kafka but you manage more.
- For durable workflows AWS offers **Step Functions** (state-machine orchestration,
  AWS-native) — compare with Temporal in `temporal.md`.

## Pitfalls
- Using SQS Standard where order matters, then bolting on ordering logic — use FIFO.
- Forgetting SNS/SQS/Kinesis are at-least-once → no idempotency → double side effects.
- Under-sharding Kinesis (throttling) or ignoring a hot shard from a skewed key.
- No redrive/DLQ → poison messages redeliver until retention expires, then vanish.
