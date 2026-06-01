# Observability deep-dive

Mechanics that don't belong in the lean SKILL.md. Read when designing the
observability layer in detail.

## The three pillars, mechanically

- **Metrics** are aggregated numeric time series, cheap to store and query.
  - **Counter** — monotonically increasing (requests, errors); you graph its
    *rate* (`rate(http_requests_total[5m])`).
  - **Gauge** — a value that goes up and down (queue depth, memory, in-flight
    requests).
  - **Histogram** — bucketed observations (request duration) so you can compute
    **percentiles** (p95/p99) server-side. Averages lie about tails; histograms are
    why you can alert on p99. Cost is the bucket count × label cardinality.
- **Logs** are discrete, high-context events. They are the *most expensive pillar
  per unit of insight* at volume — which is exactly why the collect → buffer → ship
  → index → retain pipeline is its own concern (`distributed-logging`). Decide
  *what* and *at what level* to log here; push the moving/storing there.
- **Traces** capture one request as a tree of **spans** (one span per operation,
  with start/end + attributes), tied together by a propagated `trace_id`. They
  answer "where did the 800 ms go?" across service hops.

### Pull vs push collection
- **Pull** (Prometheus scrapes `/metrics`): the collector controls load and
  discovers targets; great for dynamic fleets, awkward for short-lived jobs and
  across NAT.
- **Push** (StatsD, OTLP push, push-gateway): the source sends; good for batch jobs
  and serverless, but the source must not block on a slow collector. Always buffer
  and drop rather than block the request path.

### OpenTelemetry as the seam
Instrument once with the OpenTelemetry SDK (vendor-neutral metrics, logs, traces)
and export via the **Collector** to whatever backend(s) you choose. This keeps the
app code portable across the generic stack and any cloud provider — the seam that
avoids lock-in at the instrumentation layer.

## Sampling (so cost scales sub-linearly)
- **Head sampling** — decide at request start (e.g. keep 5%). Cheap, but you may
  drop the trace of the one slow request you cared about.
- **Tail sampling** — buffer spans and decide after the request finishes; keep all
  errors and slow requests, sample the boring fast ones. Costs collector memory but
  keeps the *interesting* traces. Prefer tail sampling once volume hurts.
- Metrics are pre-aggregated, so they generally are *not* sampled — control their
  cost via **cardinality**, not rate.

## SLI / SLO / error budget (the math)
- **SLI** (indicator) — a measured ratio of good events to total, e.g.
  `good = requests < 300 ms and 2xx/3xx`, `SLI = good / valid`.
- **SLO** (objective) — the target over a window: "99.9% of requests good over 30
  days."
- **Error budget** — `1 − SLO`. At 99.9% over 30 days you may "spend" ~43 minutes
  of badness. The budget is the contract: while it has room, ship features fast;
  when it's exhausted, freeze risky releases and spend effort on reliability.

### Burn-rate alerts (the right way to page on an SLO)
Don't page the instant the SLI dips. Alert on **burn rate** = how fast the budget
is being consumed relative to the window. A common two-window scheme:
- **Fast burn** — e.g. 14.4× burn over 1 hour (would exhaust a 30-day budget in ~2
  days) ⇒ page now.
- **Slow burn** — e.g. 3× over 6 hours ⇒ ticket.
Multi-window/multi-burn-rate alerts catch both sudden outages and slow leaks while
keeping noise low.

## RED and USE, applied
- **RED** per request-driven service: **R**ate (req/s), **E**rrors (failed req/s
  or %), **D**uration (latency histogram → p50/p95/p99). The default API/web-tier
  dashboard.
- **USE** per resource: **U**tilization (% busy), **S**aturation (queued work —
  often the *earliest* warning, e.g. run-queue length, connection-pool wait),
  **E**rrors (device/driver errors). Saturation leads utilization: a pool at 100%
  utilization with a growing wait queue is already hurting.
- **Four golden signals** = latency + traffic + errors + saturation — RED ∪ the
  saturation half of USE. Use as the standard service dashboard.

## Health checks, tuned
- **Liveness** answers "is the process wedged?" — keep it to in-process state
  (event loop responsive, no deadlock). *Never* call the DB here: a DB blip would
  restart-loop the whole fleet and turn a dependency hiccup into an outage.
- **Readiness** answers "should I get traffic right now?" — check critical deps,
  warmup/migration completion, and shed when overloaded. Failure pulls the instance
  from rotation without killing it.
- **Thresholds:** require N consecutive failures (≈3) before acting, and tune
  probe interval + initial-delay so a slow-but-recovering instance isn't killed.
  The *consumption* of these signals (gating, recovery ramp) is owned by
  `load-balancing` and `resilience-failure`; here you define a *stable* signal.

## Alert design (avoid fatigue)
- **Symptom over cause:** page on "checkout error rate > X" / SLO burn, not "CPU >
  80%". Causes become tickets and dashboards.
- **Every page is actionable + has a runbook link.** If a human can't act on it,
  it's a dashboard, not an alert.
- **Group and inhibit:** one root cause (DB down) should fire *one* incident, not
  fifty correlated pages. Use alert grouping and inhibition rules.
- **Review quarterly:** delete alerts that never fire or always get acked-and-ignored.

## Cardinality, the metrics cost killer
Series count ≈ product of all label-value counts. A `user_id` or raw-`path` label
turns one metric into millions of series and OOMs the store. Keep labels
low-cardinality (status code, route *template*, region); put high-cardinality
identifiers in **traces/logs**, not metric labels.

## Common mistakes
- Synchronous logging/trace export on the request path (telemetry adds latency).
- No sampling at high QPS → the collector falls over during the spike you most need
  to see.
- Alerting on averages instead of percentiles (tail latency stays invisible).
- Dependency checks in liveness → restart loops.
- SLOs nobody defends, or so loose the budget never burns (they mislead instead of guide).
- Treating the metrics store as a log store via high-cardinality labels.
