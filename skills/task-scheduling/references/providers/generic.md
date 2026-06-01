# Task scheduling — generic / self-hosted

The vendor-neutral default. When no cloud is named, this is the answer. The queue
transport underneath is `messaging-streaming`; this layer adds scheduling and
leasing.

## What to run
- **Celery (Python) / Sidekiq (Ruby) / BullMQ (Node)** — task-queue frameworks
  over Redis or RabbitMQ. Worker pools, retries+backoff, priority queues,
  scheduled/delayed tasks. Maps the **pull leasing** + **priority** options. The
  default for app-level background jobs.
- **Quartz (JVM)** — scheduler library; **clustered mode** (DB-backed) gives HA
  cron with misfire handling. Maps the **distributed scheduler** option.
- **Airflow / Dagster / Prefect** — DAG orchestrators; dependencies, backfill, run
  history. Maps the **workflow DAG** option for batch pipelines.
- **Redis sorted set** (`ZADD score=run_at` + poller) or **RabbitMQ delayed
  exchange** — maps the **delay-queue / timer** option.
- **Leader lock** in etcd / ZooKeeper / Consul / a DB row — makes a single-instance
  scheduler (Celery beat, Sidekiq-cron) HA without double-firing.

## Topology
- One scheduler/beat process (leader-elected if HA) enqueues due jobs.
- A queue (Redis/RabbitMQ) holds ready and delayed jobs.
- A horizontally-scaled worker pool leases and drains; scale workers on backlog.
- A DLQ (or failed-set) holds poison tasks after the retry cap.

## Limits / things that bite
- **Beat/cron is usually single-instance** — running two without a leader lock
  double-fires every recurring job. Make it HA yourself.
- **Visibility-timeout semantics differ by broker:** Redis-backed task queues
  often re-deliver on worker loss only if configured (`acks_late`, visibility
  timeout); the default may ack-on-receive and *lose* a job on crash. Set it
  deliberately.
- **Redis as broker can lose messages** (no fsync per message) — fine for
  recompute, risky for must-run jobs; RabbitMQ persists but you operate the nodes.
- **Priority queues** in some brokers are coarse (a fixed set of levels), not
  arbitrary integer priority.

## Pitfalls
- Using `acks_early`/ack-on-receive for jobs that must survive a crash.
- No leader lock on the scheduler → split-brain double-fire.
- Reaching for Airflow for low-latency or high-rate tiny jobs (scheduler tick
  latency makes it the wrong tool).
- Treating Redis-broker durability as guaranteed for money/must-run work.

Operationally heavier than a managed service, but zero lock-in and full control.
Use when running your own infra or for portability across clouds.
