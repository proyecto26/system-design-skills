# Task scheduling — AWS

## Service mapping
- **EventBridge Scheduler** — managed cron/at/rate triggers at scale; fires a
  target (Lambda, SQS, Step Functions). Maps the **distributed scheduler** option
  (HA, no leader to operate). Successor to CloudWatch Events scheduled rules.
- **SQS + Lambda (or ECS/EC2 workers)** — the queue holds ready/delayed jobs; the
  **visibility timeout** is the lease; Lambda/worker pool drains it. Maps **pull
  leasing**. SQS **redrive policy → DLQ** after `maxReceiveCount`.
- **Step Functions** — managed workflow/DAG with retries, timers (`Wait`),
  and Map/parallel. Maps the **workflow DAG** option for orchestrated multi-step
  jobs (see also `temporal.md`).
- **SQS message timers / delay queues** — per-message or per-queue delivery delay.
  Maps the **delay queue** option.

## When to pick which
EventBridge Scheduler for cron/recurring triggers; SQS + Lambda for pull-based
worker draining with visibility-timeout leasing and a DLQ; Step Functions when
multi-step orchestration with retries/compensation is the hard part; FIFO SQS
when per-group ordering + content dedup is required.

## Limits / things that bite (verify against current docs)
- **SQS delivery delay caps at 15 min** — for longer delays, store the job and
  re-enqueue, or use EventBridge Scheduler with a one-time `at` schedule.
- **SQS visibility timeout max 12 h**; extend with `ChangeMessageVisibility`
  (the heartbeat equivalent). Default is 30 s — too short for most jobs.
- **Standard SQS is at-least-once + best-effort order** → design idempotent
  consumers. **FIFO SQS** dedups within a 5-min window and is throughput-capped.
- **Lambda** has a max execution time (minutes, not hours) — long jobs need
  ECS/EC2 workers, not Lambda.
- EventBridge Scheduler / SQS have per-account throughput quotas — raise via
  Service Quotas before high-rate dispatch.

## Pitfalls
- Leaving the SQS visibility timeout at 30 s for a multi-minute job → constant
  re-delivery and double-runs.
- Assuming FIFO SQS gives free exactly-once across systems — it dedups *delivery*
  in a window, not your side effects.
- Using Lambda for long-running jobs and hitting the timeout mid-task.
- Forgetting to set a redrive policy → poison messages loop forever.
- Lock-in: EventBridge Scheduler / Step Functions definitions don't port to
  other clouds.
