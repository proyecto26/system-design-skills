# Task scheduling — GCP

## Service mapping
- **Cloud Scheduler** — fully-managed cron; fires HTTP, Pub/Sub, or App Engine
  targets on a crontab. Maps the **distributed scheduler** option (HA, no leader
  to run).
- **Cloud Tasks** — managed task queue with explicit dispatch to an HTTP/App
  Engine target, **per-task scheduled time** (delay), **rate/concurrency limits**,
  and automatic **retries with backoff**. Maps **pull/push leasing** + the
  **delay queue** + per-queue **fairness/rate** options.
- **Workflows** — managed orchestration of steps/services with retries. Maps the
  **workflow DAG** option for multi-step jobs (see also `temporal.md`).
- **Pub/Sub** — the transport when fan-out delivery is needed (→ `messaging-streaming`).

## When to pick which
Cloud Scheduler for cron/recurring triggers; Cloud Tasks when you need
per-task delays, rate limiting, and built-in retries to a worker endpoint;
Workflows when multi-step orchestration is the hard part. Cloud Scheduler →
publishes a message; Cloud Tasks → dispatches to your handler — combine them.

## Limits / things that bite (verify against current docs)
- **Cloud Tasks** has per-queue dispatch rate and max-concurrent-dispatch caps
  (your fairness/throttle knob) and a max task schedule time / retention window
  (far-future delays beyond it need storing and re-enqueue).
- Cloud Tasks dispatch is **at-least-once** with a per-task **dispatch deadline**
  (the lease/visibility equivalent) — exceed it and the task is retried → make
  handlers idempotent.
- **Cloud Scheduler** fires at-least-once — a tick can double-fire on retry;
  make the target idempotent (key by scheduled time).
- Targets are HTTP/Pub/Sub endpoints, so worker scaling is your handler's
  concern (Cloud Run / GKE autoscaling).

## Pitfalls
- Setting the Cloud Tasks dispatch deadline shorter than the job → retries and
  double-runs.
- Assuming Cloud Scheduler guarantees exactly-once firing (it doesn't).
- Using Cloud Tasks for far-future delays beyond its schedule horizon.
- Lock-in: Cloud Tasks/Scheduler/Workflows configs don't port to other clouds.
