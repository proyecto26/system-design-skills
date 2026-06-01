# Observability — Azure

## Service mapping
- **Azure Monitor** — the umbrella: metrics, **Metric Alerts**, dashboards, and
  autoscale signals.
- **Application Insights** — APM: request RED metrics, **distributed tracing**,
  dependency maps, and live metrics. Native OpenTelemetry export is supported.
- **Log Analytics (Kusto/KQL)** — the log + query store behind Azure Monitor; the
  high-volume pipeline concern is `distributed-logging`.
- **Azure Managed Grafana** + **Azure Monitor managed service for Prometheus** —
  run the generic PromQL/Grafana stack managed, for portability.
- **Health probes** — App Service / AKS liveness+readiness; gating is `load-balancing`.

## When to pick which
- Application Insights when the app is .NET/Azure-centric — richest auto-instrumentation
  and dependency tracing with least effort.
- Azure Monitor managed Prometheus + Managed Grafana to keep the generic recipe and
  PromQL portability.
- Log Analytics/KQL when you need powerful ad-hoc log querying.

## Limits / things that bite (verify against current docs)
- **Application Insights samples telemetry by default** (adaptive sampling) — great
  for cost, but verify errors/slow requests aren't being dropped.
- **Log Analytics ingestion + retention is the main cost driver**; data-cap and
  retention tiers change the bill sharply.
- **Metric Alerts evaluation frequency and granularity** bound how fast an SLO burn
  is detected.
- KQL has query limits/timeouts on large windows.

## Pitfalls
- Trusting default adaptive sampling for SLO-critical signals without checking it.
- High-cardinality custom dimensions inflating Log Analytics cost.
- Lock-in to App Insights SDKs/KQL dashboards — use the OpenTelemetry exporter and
  managed Prometheus/Grafana to stay portable.
- Conflating Log Analytics retention with metrics retention (different knobs/costs).
