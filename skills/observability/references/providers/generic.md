# Observability — generic (vendor-neutral / self-hosted)

The default answer. Instrument with **OpenTelemetry**, then route to open-source
backends. This stack is portable and the baseline every provider file maps against.

## Service mapping (recipe → open source)
- **Instrumentation seam** — **OpenTelemetry** SDK + Collector. One instrumentation,
  any backend; the thing that keeps you off lock-in.
- **Metrics + alerting** — **Prometheus** (pull/scrape, PromQL) with
  **Alertmanager** for grouping/inhibition/routing. Long-term storage via Thanos or
  Mimir when a single Prometheus won't hold retention.
- **Dashboards** — **Grafana** (queries Prometheus, Loki, and Jaeger in one pane).
- **Logs** — **Loki** for log aggregation/query (label-indexed, cheap), or the
  Elasticsearch/ELK route. The full high-volume pipeline is `distributed-logging`.
- **Traces** — **Jaeger** (or Tempo / Zipkin); receives OTLP spans, supports tail
  sampling via the Collector.

## When to pick which
- Prometheus + Grafana + Alertmanager is the near-universal metrics/alerting core.
- Add Jaeger/Tempo only once requests cross services and you need per-hop timing.
- Loki when you want logs in Grafana cheaply by labels; ELK when you need full-text
  search and rich indexing (heavier to run).

## Limits / things that bite (verify against current docs)
- **Prometheus is single-node and not long-term storage by default** — retention
  and HA need Thanos/Mimir/Cortex; plan this before cardinality grows.
- **Cardinality is the hard ceiling** — series ≈ product of label values; one
  unbounded label OOMs the server. Govern labels, not just scrape rate.
- **Pull model** needs network reachability to every `/metrics` target; short-lived
  jobs need the push-gateway.
- Self-hosting means *you* run the HA, retention, and upgrades — real operational
  cost.

## Pitfalls
- Treating Prometheus as durable/long-term storage without Thanos/Mimir.
- High-cardinality labels (user/request IDs) in metrics — push those to traces/logs.
- Synchronous OTLP export blocking the app; use the Collector with a queue + drop.
- Running ELK "because it's standard" when Loki + metrics would cover the need at a
  fraction of the operational load (borrowed context, not reasoning).
