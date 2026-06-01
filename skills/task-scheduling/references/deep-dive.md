# Task scheduling deep-dive

Mechanics that don't belong in the lean SKILL.md. Read when designing the
scheduler/worker layer in detail. Queue delivery itself lives in
`messaging-streaming`; this covers what scheduling and leasing add on top.

## Worker leasing & visibility timeout (the core mechanism)

Pull-based allocation works by *leasing*, not deleting on dequeue:

1. A worker dequeues a task; the broker makes it **invisible** to other workers
   for `visibility_timeout` seconds (the lease).
2. The worker processes it. On success it **acks/deletes** the task.
3. If the worker crashes or runs past the timeout without acking, the lease
   expires and the broker **redelivers** the task to another worker.

This gives at-least-once delivery for free: no task is lost on a crash. The cost
is duplicates — a slow job whose lease expires runs twice. Three knobs control
the failure surface:

- **Timeout length:** set above p99 job duration. Too short → constant
  re-delivery of healthy long jobs (the #1 cause of accidental double-runs). Too
  long → a crashed worker's job sits stuck until the timeout elapses (slow
  recovery). When duration varies wildly, prefer heartbeats over a single big
  timeout.
- **Heartbeat / lease extension:** long jobs periodically renew the lease (extend
  visibility). If the worker dies, heartbeats stop and the lease expires
  promptly — fast recovery *and* no spurious re-delivery of live jobs.
- **Fencing token:** when a re-delivery races the original (the first worker was
  only slow, not dead), a monotonic fence token + a "last writer wins by token"
  check at the side-effect boundary stops the stale worker from committing.
  Fencing/leases theory: `consistency-coordination`.

## Distributed cron & leader election

A single scheduler is a SPOF; running N schedulers naively double-fires every
job. The standard fix: **elect one leader** that owns enqueuing due jobs;
followers stand by and take over on leader loss (lease/lock in
ZooKeeper/etcd/Consul, or a DB row lock). Leader election + fencing are owned by
`consistency-coordination`.

Even with one leader, make enqueue **idempotent**: key each recurring fire by
`(job_name, scheduled_time)` so a leader handover that re-runs the tick produces
a no-op, not a duplicate. The scheduler's job is only to *enqueue* due work; the
worker fleet drains it — keep the two concerns separate so the scheduler stays
light and the workers scale independently.

## Delay-queue implementations

Holding a job until its "not before" time, three common ways:

- **Native delivery delay:** the broker hides the message until the delay
  elapses (simple; often capped, e.g. max ~15 min — chain or re-enqueue for
  longer).
- **Sorted set by timestamp** (Redis `ZADD score=run_at`): a poller pops members
  whose score ≤ now. Timer accuracy is bounded by the poll interval; cheap and
  flexible for arbitrary far-future delays.
- **Timer wheel / hashed wheel:** O(1) insert/expire buckets for huge numbers of
  short timers (used inside many schedulers). Best for millions of near-term
  timers; more complex.

Far-future jobs (a reminder in 30 days) shouldn't squat in a hot queue —
persist them in a store and have the scheduler promote them to the run queue as
their time approaches.

## Priority & fairness algorithms

- **Strict priority queues:** drain high before low. Simple, but sustained
  high-priority load **starves** low forever.
- **Weighted round-robin / weighted fair queuing:** draw across classes by weight
  (e.g. 4 high : 1 low) so low still makes progress. Prevents starvation.
- **Per-tenant fair share:** one queue per tenant (or a token/credit per tenant),
  drained round-robin, plus a **per-tenant concurrency cap** so one tenant's
  burst can't seize the whole fleet. The fix for the "noisy neighbor" problem.
- **Aging:** bump a job's effective priority the longer it waits, so low-priority
  work eventually runs even under high-priority pressure.

## Exactly-once *effect* (not exactly-once delivery)

True exactly-once delivery across systems is impractical; aim for **exactly-once
effect** under at-least-once delivery:

- **Dedup table / idempotency key:** record `task_id` (or a business key) on
  first successful completion; a re-delivery that finds the key already done
  short-circuits. Key contract owned by `api-design`.
- **Idempotent operations:** design side effects so applying them twice equals
  once (upsert by id, conditional write, "charge with idempotency key").
- **Transactional outcome:** commit the result and the dedup marker in one
  transaction where the store allows it, so a crash can't leave them out of sync.

## Engine landscape (when it matters)

- **Celery (Python) / Sidekiq (Ruby) / BullMQ (Node):** task queues over a broker
  (Redis/RabbitMQ). Provide worker pools, retries, scheduled/delayed tasks
  (Celery `beat`, Sidekiq-cron), and priority queues. Beat/cron schedulers are
  typically single-instance — make them HA yourself (leader lock) or they SPOF.
- **Quartz (JVM):** a scheduler library with clustered mode (DB-backed) for HA
  cron and misfire handling.
- **Airflow / Dagster / Prefect:** DAG orchestrators for batch pipelines —
  dependencies, backfill, run history, retries per task. Heavier; scheduler
  latency makes them wrong for low-latency or high-rate tiny jobs.
- **Temporal / durable workflows:** when the *orchestration* (multi-step, retries,
  timers, compensation) is the hard part — see `providers/temporal.md` and
  `messaging-streaming`.

## Common mistakes

- Visibility timeout shorter than the job → healthy jobs re-run constantly.
- No heartbeat on long jobs → either re-runs (short timeout) or slow recovery
  (long timeout); heartbeats give both.
- Treating a leased task as "ran once" — at-least-once requires idempotent tasks.
- Running the scheduler/beat in HA without a leader lock → split-brain double-fire.
- Strict priority with no aging/fairness → low-priority or one tenant starves.
- Far-future delayed jobs parked in a hot queue instead of a store.
