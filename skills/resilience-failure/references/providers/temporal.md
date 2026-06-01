# Resilience & failure — Temporal (durable execution)

Read this when the resilient unit of work is a **multi-step, long-running
process** (an order, a payment flow, a provisioning pipeline) rather than a
single request/response call. Temporal makes retries, timeouts, and recovery
*durable primitives of the workflow itself* instead of ad-hoc app logic.

## Service mapping (generic option → Temporal primitive)
- **Retry with backoff + jitter** → an **Activity RetryPolicy** (initial interval,
  backoff coefficient, max interval, max attempts, non-retryable error types).
  Temporal owns the retry loop and persists attempt state, so a worker crash mid-
  retry resumes from the durable record, not from zero.
- **Timeout** → built-in **StartToClose / ScheduleToClose / Heartbeat** timeouts
  per activity. Heartbeat timeouts detect a stuck worker on a long activity.
- **Graceful degradation / compensation** → the **Saga pattern**: on a failed
  step, run registered compensating activities to undo prior steps (the
  distributed-transaction alternative; the saga *theory* is owned by
  `consistency-coordination`).
- **Recovery without stampede** → workflow state is durable, so after an outage a
  workflow **resumes deterministically** from its last completed step instead of
  every client re-driving the whole process. No replay-the-backlog herd.
- **Rate limiting** → worker **task-queue concurrency limits** and activity
  **rate limits** cap how fast work is pulled — backpressure rather than a 429 at
  the edge (edge limiting still belongs upstream).

## Limits / things that bite (verify against current docs)
- Workflow code must be **deterministic** — no wall-clock, random, or direct I/O
  in workflow functions (use activities / Temporal's SDK APIs). Non-determinism
  breaks replay-based recovery.
- Event-history size and per-workflow limits are bounded; very long or high-event
  workflows need **Continue-As-New** to reset history.
- The Temporal **service/cluster (and its persistence store) is itself a
  dependency** to make highly available — it's not magic uptime.

## Provider-specific trade-offs
- Temporal replaces *hand-rolled* retry/timeout/saga state machines and the brittle
  "where was I?" recovery logic with durable guarantees — a big win for
  long-running orchestration.
- It adds an operational dependency (the cluster) and a programming-model
  constraint (determinism). **YAGNI for a plain stateless request path** — a
  resilience library is lighter there. Reach for it when the *process*, not the
  call, must survive crashes.

## Pitfalls
- Sneaking non-determinism into workflow code (clock, UUID, network) — passes in
  test, fails on replay.
- Treating Temporal's durable retries as a license to retry **non-idempotent**
  activities without dedup — the activity still needs an idempotency key
  (→ `api-design`).
- Letting event history grow unbounded instead of using Continue-As-New.
- Forgetting the Temporal cluster needs the same redundancy/SPOF analysis as any
  other critical component.
