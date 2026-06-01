# Task scheduling — Temporal (durable execution)

Temporal is not a queue or a cron daemon; it's a **durable workflow engine**. It
belongs here as the alternative to hand-rolling reliable scheduling, leasing,
retries, and timeouts out of a queue + cron + state flags — the engine makes all
of those first-class and crash-safe.

## What it maps to in the generic options
- Replaces the **distributed scheduler** + **worker leasing** + **retry/timeout**
  machinery with one model. Temporal **Schedules** fire recurring/cron and delayed
  workflows (no leader lock to operate). Inside a workflow, `sleep` for seconds or
  weeks is a durable timer; **Activity timeouts + retry policies** are the durable
  equivalent of visibility timeout + lease heartbeat + retry/backoff.
- It does **not** replace a high-throughput transport (Pub/Sub, Kafka, SQS) for
  fan-out delivery — pair them: a queue delivers the trigger, a Temporal workflow
  orchestrates the multi-step, retry-heavy reaction. (Saga *theory*:
  `consistency-coordination`.)

## When to choose it (the decision)
Reach for Temporal when the *reliability of the orchestration* is the hard part:
multi-step jobs with retries and compensation, long-running or human-in-the-loop
delays (wait days for approval), and "which step are we on after a crash?" being
non-trivial. The engine persists every step, so a worker crash resumes exactly
where it stopped. Skip it when a single scheduled or delayed job suffices — a
plain scheduler + queue + idempotent worker is simpler.

## Decision-changing limits (verify against current docs)
- **Workflow code must be deterministic** — no direct clocks, randomness, or I/O
  in workflow functions; side effects go in **Activities**. This is the main
  learning curve and the source of most bugs.
- **Activity timeouts (start-to-close, heartbeat) and retry policies** are
  explicit and per-activity — set heartbeat timeouts for long activities so a
  dead worker is detected promptly (the lease-heartbeat equivalent).
- **History size / event count per workflow** is bounded; long recurring loops use
  **Continue-As-New** to reset history.
- **Self-hosted** needs a backing store (Cassandra/PostgreSQL/MySQL) and ops care;
  **Temporal Cloud** removes that at a cost and some lock-in.

## Provider-specific trade-offs
- Buys crash-safe scheduling/retries/timeouts and removes a class of hand-rolled
  state-machine and double-fire bugs; costs a runtime, the determinism model, and
  engine lock-in (workflow code is Temporal-shaped).
- Cloud-native analogs (AWS Step Functions, Azure Durable Functions, GCP
  Workflows) win on zero-ops within their ecosystem; Temporal wins on code-first
  ergonomics, cross-cloud portability, and complex/long workflows.

## Pitfalls
- Putting non-deterministic code (time, UUIDs, HTTP) directly in a workflow →
  replay failures.
- Using Temporal as a high-volume message queue/stream — it orchestrates, it
  doesn't transport bulk events.
- Unbounded workflow history (long recurring loops without Continue-As-New).
- Reaching for it for a single cron job where a scheduler + queue would do (YAGNI).
