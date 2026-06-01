---
name: observability
description: This skill should be used when the user asks about "observability" or "monitoring", what "metrics, logs, and traces" to collect, "health checks" (liveness/readiness), "alerting" or "on-call", "SLO/SLI" or "error budgets", the "RED" or "USE" method, "dashboards", or names a tool like "Prometheus", "Grafana", or "Datadog". Use it whenever a design has no answer to "how would we know this is broken?" or "what do we alert on?" — i.e. any time failure would be invisible until users complain, even if the user doesn't say "observability".
---

# Observability

Decide *what to measure* so a system can be seen, alerted on, and debugged in
production. Getting this wrong is failure mode #6 — ignoring failure: a design
that works on the whiteboard but goes dark under load, where the first signal of
an outage is a user complaint instead of a page.

## When to reach for this
Any production design needs an answer to "how would we know this broke, and how
fast?" Reach for this when defining what the system measures, what pages a human,
what an acceptable level of service is (SLO), or how a request is traced across
services. It is the design move that makes every *other* block's stress section
real — you cannot mitigate a thundering herd or a hot shard you can't see.

## When NOT to
Do not build a full metrics-logs-traces stack for a prototype or an internal tool
with no users to disappoint (YAGNI) — a health check and error logging are
enough. Do not invent SLOs nobody will defend, or wire alerts before knowing the
symptom that matters; an alert with no owner and no runbook is noise that trains
the team to ignore pages. This skill owns *what* to measure and alert on; the
**high-volume log pipeline** (collect → buffer → ship → index → retain) lives in
`distributed-logging` — summarize and link, don't rebuild it here.

## Clarify first
- **What is "healthy" from a user's view?** The symptom that defines a bad
  experience (slow checkout, failed upload) — alerts target this, not CPU.
- **SLO target and window?** e.g. 99.9% of requests < 300 ms over 30 days. This
  sets the error budget and the alert thresholds. (→ `back-of-the-envelope` for the nines.)
- **Request volume and cardinality?** QPS drives metric/trace sample rates;
  high-cardinality labels (user ID, URL) blow up a metrics store.
- **Is this request-driven or resource-driven?** Picks RED (services) vs USE
  (CPU/disk/queues) as the measurement frame.
- **Multi-service request path?** If a request crosses services, tracing earns
  its keep; a single service may not need it yet.

## The options

**The three pillars** (complementary, not either/or):
- **Metrics** — cheap numeric time series (counters, gauges, histograms). Use for
  dashboards, trend analysis, and *alerting* — the always-on signal.
- **Logs** — discrete events with context. Use for debugging the specific failure
  after an alert fires. (The pipeline that moves them is `distributed-logging`.)
- **Traces** — one request's journey across services with timing per hop. Use to
  find *which* service or dependency is the latency/error source.

**What to measure** (pick a frame per component):
- **RED** (request-driven services): **R**ate, **E**rrors, **D**uration. Use for
  APIs, web tiers, anything serving requests.
- **USE** (resources): **U**tilization, **S**aturation, **E**rrors. Use for CPU,
  memory, disk, connection pools, queues.
- **Four golden signals** (latency, traffic, errors, saturation) — the superset;
  use as the default service dashboard.

**Health checks** (the signal, consumed by `load-balancing`/orchestrator):
- **Liveness** — is the process alive / not deadlocked? Failure ⇒ *restart*. Keep
  it cheap; don't check dependencies. Use to recover stuck processes.
- **Readiness** — can this instance serve traffic *now* (deps reachable, warmup
  done)? Failure ⇒ *pull from rotation, don't restart*. Use to gate cold/struggling instances.

**Alerting**:
- **Symptom-based (SLO burn)** — page when the user-facing SLO is at risk. Use as
  the default; it is actionable and low-noise.
- **Cause-based (resource thresholds)** — ticket/warn on CPU, disk, saturation.
  Use for capacity planning, not paging.

## Trade-offs

| Option | What it solves | What it worsens | Change it when |
|---|---|---|---|
| Metrics | Cheap, always-on alerting + trends | No per-request detail; high-cardinality labels explode storage/cost | You need to debug a *specific* request → add traces/logs |
| Logs | Rich context for debugging an incident | Volume + cost; needs the `distributed-logging` pipeline to scale | Volume is unmanageable → sample, or shift detail to metrics |
| Traces | Pinpoints the slow/failing hop across services | Instrumentation effort; sampling needed at high QPS | Single-service or low volume → defer; metrics suffice |
| RED | Right frame for request services | Misses resource exhaustion that hasn't yet hurt requests | Component is a resource (queue, disk) → use USE |
| USE | Catches saturation before it hurts users | Resource-centric, not user-centric; can be noisy | Alerting on it → switch to symptom/SLO-based |
| Liveness check | Recovers deadlocked processes | Too aggressive ⇒ restart loops, mask real bugs | Restarts hide a crash-loop → fix readiness/root cause |
| Readiness check | Keeps cold/broken instances out of rotation | Flapping if it checks flaky deps ⇒ capacity yo-yo | All instances fail readiness together → it's a dep outage |
| SLO/error budget | Ties alerting + release pace to user pain | Effort to define + defend; wrong SLO misleads | Budget never burns (too loose) or always burns (too tight) |
| Symptom alerting | Low-noise, actionable pages | Slightly slower to localize root cause | Need faster localization → add cause-based *tickets* (not pages) |

## Behavior under stress
Observability is most needed exactly when it's most likely to break or mislead.

- **The monitoring amplifies the outage.** Synchronous logging on the request path
  turns a slow log backend into request latency. Per-request trace export with no
  sampling melts the collector under a spike. Keep telemetry async and sampled so
  it degrades the *signal*, never the service.
- **Health-check stampede.** Aggressive liveness probes restart instances that are
  merely slow, and readiness flaps yank capacity mid-spike — making the spike
  worse. The gating/recovery behavior is owned by `load-balancing` and
  `resilience-failure`; this block owns defining a *stable* signal (sane
  thresholds, consecutive-failure counts, deps in readiness not liveness).
- **Cardinality blow-up.** A label like `user_id` or raw URL multiplies time series
  into the millions and OOMs the metrics store under load — drop or bucket
  high-cardinality dimensions.
- **Alert storm.** One root cause (a DB outage) fires fifty correlated alerts; the
  on-call drowns. Alert on the user-facing symptom; group/inhibit downstream alerts.
- **Blind spot on recovery.** After an incident, dashboards must show whether the
  fix worked and whether recovery traffic is overwhelming a cold tier.

**Monitor:** the four golden signals per service (rate, errors, latency p50/p95/p99,
saturation), SLO error-budget burn rate, healthy-host count and probe flap rate,
and the telemetry pipeline's own lag/drop rate (watch the watcher).

## How to apply
1. **Clarify the inputs** — pin the user-facing symptom, the SLO target + window,
   request volume/cardinality, and whether the path is multi-service (see *Clarify
   first*). No SLO yet? Define the symptom first; the number follows.
2. **Pick the pillars and frame from the trade-off table** — metrics for alerting
   always; RED for services and USE for resources; add traces only when a request
   crosses services or volume justifies it.
3. **Set the key knobs** — define liveness vs readiness endpoints (deps in
   readiness, not liveness), consecutive-failure thresholds, trace sample rate, and
   the SLO + error-budget policy. Drop high-cardinality labels up front.
4. **Stress-test the choice** — walk *Behavior under stress*: confirm telemetry is
   async/sampled, probes won't stampede, cardinality is bounded, and alerts group
   by root cause so one outage isn't fifty pages.
5. **Size it with numbers** — sanity-check metric series count and retention,
   trace/log sample volume against the QPS, and that the SLO's nines match the
   architecture's redundancy (→ *Numbers that matter*).
6. **Pick a provider** — default to the generic recipe; open a provider file only
   if the user named a cloud (see *Choosing a provider*).

## Dos and don'ts
**Do**
- Alert on user-facing symptoms (SLO burn), and make every page actionable with a runbook.
- Put dependency checks in *readiness* and keep *liveness* cheap and dependency-free.
- Emit telemetry asynchronously and sampled so it never adds latency or melts the collector.
- Define an SLO + error budget you will actually defend, and tie release pace to it.
- Standardize a per-service dashboard on the four golden signals.

**Don't**
- Don't page on causes (CPU > 80%) — ticket those; pages are for user pain.
- Don't use high-cardinality labels (user ID, raw URL) as metric dimensions.
- Don't check downstream dependencies in liveness — you'll restart-loop the fleet.
- Don't build a full stack for a prototype, or wire alerts no one owns (YAGNI / alert fatigue).
- Don't reimplement the log pipeline here — that's `distributed-logging`.

## Numbers that matter
The SLO sets everything else: 99.9% over 30 days allows ~43 minutes of budget; if
the architecture's redundancy can't deliver those nines, the SLO is fiction (→
`back-of-the-envelope` for the availability-nines table). Alert on **p95/p99**, not
averages — averages hide tail pain. Sample traces (often 1–10% at high QPS) so cost
scales sub-linearly with traffic. Watch metric **cardinality** (series ≈ product of
label values): one unbounded label can mean millions of series. Don't restate the
latency/QPS/nines tables — they live in `back-of-the-envelope`.

## Interface sketch
Telemetry has contracts worth pinning down. A **metric**: name + label set +
type (`http_requests_total{service,method,status}` counter) — labels are
low-cardinality. A **health endpoint**: `GET /livez` → 200/503 (process only),
`GET /readyz` → 200/503 (deps + warmup), with version/build info in the body for
debugging. A **trace context**: a `trace_id` + `span_id` propagated on every
inbound/outbound call (e.g. W3C `traceparent` header) so traces and logs correlate.

## Choosing a provider
Default to the generic recipe above (Prometheus + Grafana + Loki + Jaeger, glued
by OpenTelemetry). If the user names a cloud, read
`references/providers/<provider>.md` for the managed-service mapping, quotas/limits,
and provider-specific trade-offs. If no file exists for that provider, the generic
recipe is the answer.

## Diagram
To visualize the telemetry flow (app → OpenTelemetry SDK → collector → metrics /
logs / traces backends → dashboard + alertmanager) or the alert-to-page path, use
the in-plugin `architecture-diagram` skill. Telemetry export uses dashed arrows to
show it is off the request path.

## Related building blocks
- `distributed-logging` — *owned-concept lives in* there: the high-volume log
  pipeline (collect → buffer → ship → index → retain). This skill decides *what* to
  log and alert on; that skill decides *how* to move and store it at scale.
- `resilience-failure` — *pairs with* this: alerts and SLO burn trigger graceful
  degradation and circuit breaking, and the health-check signal defined here is the
  input its failover and `load-balancing` health-gating consume.
- `scaling-evolution` — *feeds into* it: saturation metrics and the golden signals
  reveal the next bottleneck that justifies the next scaling step.
- `back-of-the-envelope` — *feeds into* this skill: it supplies the availability
  nines and QPS that turn an SLO and sample rates into real numbers.
- `system-design` — *owned-concept lives in* the orchestrator: the reasoning loop,
  the trade-off method, and the ten failure modes (this block defends #6).

## References
- **`references/deep-dive.md`** — pillar mechanics (histograms vs gauges, push vs
  pull, sampling), SLI/SLO/error-budget math and burn-rate alerts, RED/USE in
  detail, health-check tuning, and alert design. Read when designing the
  observability layer in depth.
- **`references/providers/{generic,aws,azure,gcp}.md`** — service mappings, limits,
  and pitfalls per environment.
