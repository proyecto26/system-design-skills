# Task scheduling — Azure

## Service mapping
- **Logic Apps** — managed scheduled/recurring triggers and low-code workflow
  orchestration; recurrence trigger maps the **distributed scheduler** option,
  and the connector workflow maps the **workflow DAG** option.
- **Azure Functions Timer trigger** — cron-expression scheduled functions; HA
  managed cron for code-first jobs. Maps the **scheduler** option.
- **Storage Queues / Service Bus Queues + Functions or workers** — the queue
  holds jobs; the **lock/visibility (peek-lock) duration** is the lease; a worker
  pool drains it. Maps **pull leasing**. Service Bus has **dead-lettering**
  built in.
- **Service Bus scheduled messages / message TTL** — per-message scheduled
  enqueue time. Maps the **delay queue** option.
- **Durable Functions** — code-first orchestration with retries/timers (see
  `temporal.md`).

## When to pick which
Functions Timer trigger for code-first cron; Logic Apps for low-code scheduled
workflows and connector-heavy orchestration; Service Bus + workers for
priority/sessions and built-in DLQ; Storage Queues for a cheap, simple job queue.

## Limits / things that bite (verify against current docs)
- **Service Bus peek-lock** default lock is short (e.g. ~30–60 s); renew the lock
  (the heartbeat equivalent) for long jobs or set a longer lock duration; lock
  expiry re-delivers.
- **Storage Queues** give at-least-once with a visibility timeout but **no native
  DLQ** (you build it) and weaker ordering; **Service Bus** adds sessions
  (ordering), DLQ, and scheduled messages.
- **Functions Consumption plan** has an execution-time cap and cold starts — long
  or latency-sensitive jobs want Premium/Dedicated or container workers.
- Per-namespace/throughput quotas apply on Service Bus.

## Pitfalls
- Using Storage Queues and discovering there's no built-in dead-lettering.
- Leaving the Service Bus lock too short for long jobs → re-delivery and double-runs.
- Running the Functions Timer trigger as if it guarantees exactly-once firing —
  make the handler idempotent.
- Lock-in: Logic Apps / Durable Functions definitions don't port to other clouds.
