# Messaging & streaming — Temporal (durable execution)

Temporal is not a broker; it's a **durable workflow engine**. It belongs here as
the alternative to hand-rolling a multi-step async process out of queues + retry
logic + state flags + compensation handlers.

## What it maps to in the generic options
- Replaces the **durable workflow** option, and often the *orchestration glue*
  around queues. You write the workflow as ordinary code; Temporal persists every
  step's result and the workflow's position, so a worker crash resumes exactly
  where it stopped. Retries, timers (sleep days/weeks), and compensation (saga
  rollback) are first-class. (Saga *theory*: `consistency-coordination`.)
- It does **not** replace a high-throughput transport stream (Kafka/Kinesis) or a
  raw fan-out bus — pair Temporal with those: a stream/queue delivers the trigger,
  a Temporal workflow orchestrates the multi-step reaction.

## When to choose it (the decision)
Reach for Temporal when the orchestration *is* the hard part:
- Long-running or human-in-the-loop processes (order → pay → ship → refund;
  approvals that wait days).
- Correctness under partial failure matters and "which step are we on after a
  crash?" is non-trivial.
- You need visibility into in-flight workflows, retries, and history.

Skip it when a single async step suffices — a plain queue + idempotent consumer is
simpler. The engine is a new runtime, a new programming model (determinism rules),
and a dependency to operate (self-hosted) or a bill (Temporal Cloud).

## Decision-changing limits (verify against current docs)
- **Workflow code must be deterministic** — no direct clocks, randomness, or I/O
  in workflow functions; side effects go in **Activities**. Violating determinism
  breaks replay. This is the main learning curve.
- **Activity timeouts and retry policies** are explicit and per-activity; the
  durable equivalent of visibility timeout + retry/backoff.
- **History size / event count per workflow** is bounded; very long or high-volume
  loops use **Continue-As-New** to reset history.
- **Self-hosted** needs a backing store (Cassandra/PostgreSQL/MySQL) and operational
  care; **Temporal Cloud** removes that at a cost and some lock-in.

## Provider-specific trade-offs
- Buys crash-safe orchestration and removes a whole class of hand-rolled
  state-machine bugs; costs a runtime, the determinism model, and engine lock-in
  (workflow code is Temporal-shaped).
- Cloud-native analogs exist (AWS Step Functions, Azure Durable Functions, GCP
  Workflows). Temporal wins on code-first ergonomics, portability across clouds,
  and complex/long workflows; the cloud-native options win on zero-ops within
  their ecosystem.

## Pitfalls
- Putting non-deterministic code (time, UUIDs, HTTP) directly in a workflow →
  replay failures.
- Using Temporal as a message queue or stream — it orchestrates, it doesn't
  transport high-volume events.
- Unbounded workflow history (long loops without Continue-As-New).
- Reaching for it for a single fire-and-forget job where a queue would do (YAGNI).
