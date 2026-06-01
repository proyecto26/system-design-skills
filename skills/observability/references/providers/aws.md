# Observability — AWS

## Service mapping
- **CloudWatch Metrics** — managed metrics + dashboards + **CloudWatch Alarms** for
  alerting. The default; integrates with most AWS services out of the box.
- **CloudWatch Logs** — managed log ingestion/query (Logs Insights). The pipeline
  concern is `distributed-logging`; here it's the metrics/alarm + log-metric-filter
  side.
- **X-Ray** — managed distributed tracing; OTLP via the ADOT (AWS Distro for
  OpenTelemetry) Collector.
- **Amazon Managed Service for Prometheus (AMP)** + **Managed Grafana** — run the
  generic Prometheus/Grafana stack without self-hosting; pick this to stay
  PromQL-portable instead of CloudWatch-native.
- **CloudWatch Synthetics / Route 53 health checks** — synthetic + external
  liveness probing (health-check *gating* is `load-balancing`).

## When to pick which
- CloudWatch for native, low-setup metrics+alarms across AWS services.
- AMP + Managed Grafana when you want the generic recipe managed (portability,
  PromQL, existing dashboards).
- X-Ray for tracing if you're CloudWatch-native; ADOT keeps you OTel-portable.

## Limits / things that bite (verify against current docs)
- **CloudWatch custom-metric and high-cardinality dimension costs add up fast** —
  each unique dimension combination is a billable custom metric.
- **Standard CloudWatch metric granularity is 1-minute** (high-resolution down to
  1s costs more) — alerting reaction time is bounded by this.
- **PutMetricData / API throttling** under bursty custom-metric publishing.
- X-Ray sampling is configured separately; default rules may under-sample errors.

## Pitfalls
- Emitting high-cardinality CloudWatch dimensions (user/request IDs) — cost
  explosion; keep those in logs/traces.
- Assuming 1-minute metrics are fast enough for tight SLO burn alerts.
- CloudWatch-native lock-in: dashboards/alarms don't port; AMP+Grafana avoids this.
- Forgetting cross-account/cross-region aggregation cost when centralizing telemetry.
