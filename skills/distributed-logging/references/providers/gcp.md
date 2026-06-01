# Distributed logging — GCP

## Service mapping (generic stage → GCP)
- **Collect:** the **Ops Agent** on GCE; on GKE, logging is built in (a Fluent Bit
  DaemonSet ships container logs to Cloud Logging automatically). Apps can also write
  structured entries directly via the Cloud Logging API/SDK.
- **Buffer / transport:** **Pub/Sub** as the durable log bus — Cloud Logging **sinks**
  route matching entries to Pub/Sub for fan-out / stream processing.
- **Index / search:** **Cloud Logging** (Logs Explorer) is the managed hot search tier
  with its own query language; for analytics, route to **BigQuery** via a log sink.
- **Cold archive:** **Cloud Storage** bucket via a log sink, with lifecycle rules to
  Nearline/Coldline/Archive classes (→ `blob-store`).

Common recipe: agents/resources → Cloud Logging → **log sinks** fan out to: a logging
bucket (hot, searchable for N days), BigQuery (analytics), Cloud Storage (cold), and/or
Pub/Sub (stream to anywhere).

## Limits / things that bite (verify against current docs)
- **Log buckets** have a configurable retention period; the default is a fixed window —
  extend it (and pay) or sink to GCS for long retention.
- **Ingestion** is billed per GB after a free allotment; verbose unsampled logging gets
  expensive fast.
- **Exclusion filters** drop matching entries *before* ingest billing — the primary
  cost lever (e.g. drop health-check and 200-OK access logs).
- **Pub/Sub** ordering is only guaranteed with an ordering key within a region; without
  it, messages may arrive out of order.
- BigQuery sink streaming has its own quotas and per-GB cost.

## Provider trade-offs
- Cloud Logging is deeply integrated (auto-collection on GKE, one query surface) but
  long retention and high volume push you to GCS/BigQuery sinks for cost.
- BigQuery is excellent for SQL analytics over logs but is not a low-latency
  tail/search tool — use Logs Explorer for that.
- Exclusion filters + sinks are the cost/queryability control plane; design them up
  front. Lock-in: sink config, the query language, and BigQuery schemas don't port.

## Pitfalls
- Not setting **exclusion filters** → paying to ingest health checks and noise.
- Treating BigQuery as interactive log search (it's analytics, not tailing).
- Assuming Pub/Sub preserves order without an ordering key.
- Leaving default log-bucket retention and expecting cheap long-term storage there
  instead of GCS.
