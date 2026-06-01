# Distributed logging — generic (self-host / open source)

The default answer when no cloud is named. Vendor-neutral mechanics and the
open-source building blocks for each pipeline stage.

## Stage → tool mapping
- **Collect:** Fluent Bit or Vector (lightweight node agents), Fluentd (heavier,
  plugin-rich), Filebeat (Elastic's shipper). Read files/stdout, parse, enrich, route.
- **Transport / buffer:** the agent's own disk buffer for simple cases; **Kafka** (or
  Redpanda/Pulsar) as a durable, partitioned **log bus** for high volume / fan-out.
  Treat delivery, ordering, and backpressure as owned by `messaging-streaming`.
- **Index / search:** **Elasticsearch / OpenSearch** for full-text field search (the
  "E" in ELK/EFK); **Loki** for cheap label-indexed storage with grep-style queries.
- **Visualize / query:** Kibana (ES/OpenSearch) or Grafana (Loki).
- **Cold archive:** object storage (MinIO self-host, or any S3-compatible bucket) via
  `blob-store`; query cold data with an in-place engine if needed.

Common assemblies: **ELK** = Elasticsearch + Logstash + Kibana; **EFK** swaps
Logstash for Fluentd/Fluent Bit; **PLG** = Promtail/Loki/Grafana.

## When to pick which
- Need rich, ad-hoc full-text search across fields → Elasticsearch/OpenSearch.
- Volume is large and you mostly filter by label then scan → Loki (far cheaper).
- One sink, moderate volume → agent disk buffer straight to the indexer (skip Kafka).
- Spiky volume or multiple sinks (search + archive + analytics) → put Kafka in front.

## Limits / things that bite (verify against current docs)
- **Elasticsearch shard pressure:** too many shards exhausts heap; keep shards moderate
  and even, use rollover. High-cardinality index fields cause mapping explosions.
- **Heap/JVM:** ES nodes are RAM-bound; under-provisioned heap → GC pauses → ingest
  rejection (HTTP 429). Watch the bulk/index queue.
- **Kafka:** ordering is per-partition only; partition count caps consumer parallelism;
  retention is bytes/time per topic — size it for the longest sink outage.
- **Loki:** weak at high-cardinality and arbitrary full-text; label cardinality is the
  cost driver.

## Pitfalls
- Synchronous ship from the app/agent that blocks the request path on a slow indexer.
- Unbounded buffers (memory or disk) that OOM/fill during the spike they should absorb.
- One ever-growing index with no time-based rollover → retention becomes a crisis.
- Regex-parsing free text at the agent at high volume (CPU sink) instead of emitting
  structured logs at the source.
- Running ES "because it's standard" when label-indexed Loki would cost a fraction.
