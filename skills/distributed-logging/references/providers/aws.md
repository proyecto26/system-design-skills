# Distributed logging — AWS

## Service mapping (generic stage → AWS)
- **Collect:** CloudWatch agent / Fluent Bit (the `aws-for-fluent-bit` image is the
  standard ECS/EKS sidecar/daemon). Lambda and many services log to **CloudWatch Logs**
  natively.
- **Buffer / transport:** **Kinesis Data Streams** as the durable log bus, or
  **Kinesis Data Firehose** for buffered, no-ops delivery straight to a sink. (Kafka
  via **MSK** if you already run Kafka — owned by `messaging-streaming`.)
- **Index / search:** **OpenSearch Service** (managed Elasticsearch/OpenSearch) for
  full-text search; CloudWatch Logs Insights for query-in-place without a separate
  cluster.
- **Cold archive:** **S3** via Firehose, with lifecycle to Glacier classes; query in
  place with **Athena** (→ `blob-store`).

A very common AWS recipe: agents/services → CloudWatch Logs → **subscription filter** →
Firehose → S3 (cold) and/or OpenSearch (hot search). Firehose does the buffering,
batching, compression, and retry so you don't run agents for that hop.

## Limits / things that bite (verify against current docs)
- **CloudWatch Logs `PutLogEvents`** has per-request batch size and per-stream
  throughput limits; bursts get throttled — batch and back off.
- **Firehose** buffers by size *or* time interval, whichever first — there is an
  inherent delivery delay (seconds–minutes); not for interactive tailing.
- **Kinesis Data Streams** throughput is per-shard (fixed MB/s in, records/s); ordering
  is per-shard only; you must scale shards for peak ingest.
- **OpenSearch Service** is the same shard/heap pressure as self-hosted ES; instance
  type caps RAM and the index queue.
- CloudWatch Logs **retention is per-log-group**; default can be "never expire" →
  silent cost growth. Set it explicitly.

## Provider trade-offs
- CloudWatch Logs is the path of least resistance (most services emit there for free)
  but ingestion + storage + Insights scans are billed separately and add up fast.
- Firehose → S3 is the cheap durable archive; OpenSearch is the expensive hot search —
  send everything to S3, a sampled/filtered subset to OpenSearch.
- Lock-in: subscription filters, Firehose transforms, and Insights queries don't port
  to other clouds.

## Pitfalls
- Leaving log groups on infinite retention (cost) — or expecting Firehose to be
  real-time (it isn't).
- Sending full-volume logs to OpenSearch when most queries are label filters that S3 +
  Athena would answer for far less.
- Forgetting Kinesis shard limits during an incident spike → throttled, dropped logs
  exactly when you need them.
