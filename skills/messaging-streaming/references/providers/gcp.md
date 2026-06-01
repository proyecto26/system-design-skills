# Messaging & streaming — GCP

## Service mapping → the generic options
- **Pub/Sub** — managed pub/sub *and* work queue in one; at-least-once by default,
  push or pull subscriptions, built-in dead-lettering and retry policy,
  auto-scaling throughput. The default for both fan-out and async jobs on GCP.
- **Pub/Sub (ordering keys)** — opt-in per-key ordering when you set an ordering
  key; off by default.
- **Pub/Sub Lite** — cheaper, lower-cost-per-message variant where you provision
  capacity (zonal); use for high-volume, cost-sensitive streaming where you accept
  managing capacity.
- **Dataflow** — managed stream/batch processing (Apache Beam) that *consumes*
  Pub/Sub for windowing, aggregation, exactly-once processing within the pipeline.
  Use when you need stream *processing*, not just transport.

## Decision-changing limits (verify against current docs)
- **At-least-once by default** → duplicates happen; consumers must be idempotent.
  Pub/Sub offers an **exactly-once delivery** mode within a subscription (narrower
  scope; verify constraints).
- **Ordering** requires an ordering key and same-region publish; it caps
  per-key parallelism (the usual ordering cost).
- **Ack deadline** is the visibility-timeout analog; extend it for long jobs or
  get redelivery. Message **retention** window bounds replay/seek-to-timestamp.
- **Message size** limit (~10 MB) larger than SQS, but large payloads still favor
  a claim-check via Cloud Storage.

## Provider-specific trade-offs
- One service (Pub/Sub) covers queue + pub/sub, which simplifies the decision but
  means you tune subscriptions (push vs. pull, ack deadline, ordering) rather than
  pick a different product.
- Pub/Sub is not a long-retention replayable log like Kafka by default — for
  Kafka semantics use self-managed Kafka on GKE or a partner offering; for stream
  *processing* reach for Dataflow.
- For durable workflows GCP offers **Workflows** (YAML orchestration) and
  **Cloud Tasks** (HTTP task queue with scheduling) — compare with Temporal in
  `temporal.md`.

## Pitfalls
- Assuming exactly-once because GCP offers the mode — it's per-subscription and
  bounded; keep consumers idempotent.
- Forgetting ordering is off until you set an ordering key.
- Ack-deadline shorter than processing time → silent duplicate processing.
- No dead-letter topic configured → failed messages redeliver until retention ends.
