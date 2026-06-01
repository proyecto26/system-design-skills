# Observability — GCP

## Service mapping
- **Cloud Monitoring** (formerly Stackdriver) — managed metrics, dashboards,
  **alerting policies**, and **SLO + error-budget objects as first-class features**
  (define an SLI/SLO and burn-rate alerts natively).
- **Cloud Trace** — managed distributed tracing; OTLP/OpenTelemetry export.
- **Cloud Logging** — managed log ingestion/query + **log-based metrics**; the
  high-volume pipeline concern is `distributed-logging`.
- **Managed Service for Prometheus + Managed Grafana** — run the generic PromQL
  stack managed (GMP auto-collects from GKE), for portability.
- **GKE/Cloud Run health checks** — liveness+readiness; gating is `load-balancing`.

## When to pick which
- Cloud Monitoring when you want native SLOs/error budgets and burn-rate alerts
  without building them — its standout feature.
- Managed Service for Prometheus on GKE for PromQL portability with managed scaling.
- Cloud Trace for low-effort tracing on GCP-hosted services via OTel.

## Limits / things that bite (verify against current docs)
- **Cardinality / active-time-series limits** per metric — unbounded labels hit
  ingestion limits and cost.
- **Cloud Logging ingestion + retention is the main cost driver**; log-based metrics
  add cost on top.
- **Alerting policy evaluation period** bounds detection latency for SLO burns.
- Trace sampling is configurable; defaults may under-sample errors.

## Pitfalls
- High-cardinality metric labels hitting per-metric time-series limits.
- Building custom SLO tooling when Cloud Monitoring's native SLOs already do it.
- Lock-in to Cloud Monitoring dashboards/alerting — OTel + managed Prometheus/Grafana
  keeps you portable.
- Forgetting log-based metric cost when deriving metrics from high-volume logs.
