# Messaging & streaming deep-dive

Mechanics that don't belong in the lean SKILL.md. Read when designing the
messaging layer in detail.

## Delivery guarantees — what actually happens

The guarantee is a property of the *whole loop* (deliver → process → ack), not
just the broker.

- **At-most-once:** consumer acks *before* processing (or broker fire-and-forgets).
  A crash after ack but before the side effect loses the message. Cheapest, no
  duplicates, drops under failure. Fine for metrics samples, best-effort notifies.
- **At-least-once:** consumer acks *after* the side effect commits. If it crashes
  before acking, the broker redelivers — so the side effect can run twice. This is
  the practical default: no loss, but **duplicates are guaranteed eventually**.
- **Exactly-once:** no loss and no duplicate *effects*. True end-to-end
  exactly-once across independent systems is impossible in general; what vendors
  ship is narrow (exactly-once *within one broker/stream*, e.g. Kafka
  transactions writing back to Kafka). The portable answer is **at-least-once
  delivery + idempotent consumers** = "effectively once."

### Making at-least-once safe (idempotency / dedup)
- **Idempotency key:** carry a stable `message_id`; the consumer records processed
  IDs (a dedup table / set with TTL) and skips repeats. Owned mechanism:
  `api-design` idempotency keys.
- **Natural idempotency:** design the side effect so re-applying is a no-op
  (`SET balance = 100` not `balance += 10`; upsert by key not insert).
- **Dedup window:** brokers that offer dedup do it within a time window (e.g.
  minutes) — beyond that, duplicates slip through, so the consumer still needs to
  be idempotent for correctness over long retries.

## Acks, visibility timeouts, and offsets (the three models)

- **Ack + redelivery (RabbitMQ, SQS):** broker holds the message "in flight" after
  delivery; if not acked within a **visibility timeout**, it's redelivered. Too
  short → duplicate processing of slow jobs; too long → slow recovery from a dead
  consumer. Tune to p99 processing time.
- **Offset commit (Kafka, Kinesis):** the log is immutable; each consumer group
  stores an **offset** (position). "Ack" = commit the offset. Commit *after*
  processing for at-least-once; the gap between process and commit is the
  duplicate window on crash.
- **Lease/extend:** long jobs extend the lease/visibility periodically (heartbeat)
  so they aren't redelivered mid-flight.

## Ordering

- **No global order for free.** A queue with N competing workers processes
  out of order by construction.
- **Per-key ordering** is the usual real requirement: all events for one user/
  account in order. Achieve it by routing a key to a single partition/FIFO group
  (`partition = hash(key) % partitions`); order holds *within* a partition only.
- **Cost:** ordering serializes a key — it caps parallelism and creates the
  **hot-partition** risk (a heavy key can't be spread). FIFO modes also cap
  throughput. Full ordering/consensus theory: `consistency-coordination`.
- A failed message in a strict-order partition blocks everything behind it ("head
  of line blocking") — decide whether to halt, skip-to-DLQ, or pause the key.

## Partitioning a stream

- Partition count caps consumer parallelism: at most one consumer per partition
  per group. Over-provision partitions early — increasing them later rehashes keys
  and breaks ordering for in-flight keys.
- Choose a partition key that spreads load *and* keeps related events together;
  these pull in opposite directions. Same hot-key/sharding shape as `data-storage`.

## Dead-letter queues (DLQ)

- After a capped number of failed deliveries (backoff + jitter between tries), the
  broker routes the message to a separate DLQ instead of redelivering forever. This
  stops a **poison message** from blocking the line and burning capacity. (Retry
  policy, backoff/jitter, and DLQ-as-containment are owned by `resilience-failure`.)
- Preserve the original envelope + failure reason + attempt count. Build a
  **replay path** (DLQ → fix → re-enqueue) and alarm on DLQ arrival rate — a silent
  DLQ is lost data.
- Distinguish **transient** (downstream blip → retry) from **permanent** (bad
  schema → straight to DLQ, don't waste retries) failures.

## Transactional outbox (avoiding the dual-write problem)

Writing to the DB *and* publishing to a broker in one step isn't atomic — a crash
between them loses or phantoms an event. The **outbox** pattern: write the event
to an `outbox` table in the *same DB transaction* as the state change; a separate
relay (poller or CDC tail of the log) publishes outbox rows to the broker. This
gives at-least-once publication with no dual-write race. Owned in depth by
`data-storage`; named here because it's how producers safely emit events.

## Sync vs. async decision

Go async only when the caller doesn't need the result to proceed. Async buys
responsiveness and isolation but costs: eventual consistency (the result lands
later), harder debugging (no single stack trace — use a `trace_id`), and a new
failure surface. If you find yourself building request/reply *over* a queue to get
a synchronous answer, a direct call is probably simpler.

## Durable workflows vs. hand-rolled queue+retry+saga

A multi-step process — reserve inventory, charge card, ship, on failure refund and
release — can be built from queues + state flags + retry logic + compensation
handlers. That works until the orchestration logic (timeouts, partial failure,
"which step are we on after a crash?") becomes the bulk of the code and the bugs.

A **durable execution engine** (e.g. Temporal) persists each step's result and
the workflow's position, so a worker crash resumes exactly where it left off;
retries, timers (sleep for days), and compensation are first-class. Reach for it
when: the process is long-running or spans human delays; correctness under partial
failure is critical; you need visibility into in-flight workflows. Skip it when a
single async step suffices — the engine is a new runtime, programming model, and
lock-in. Saga/compensation *theory* lives in `consistency-coordination`; this is
the build-vs-buy call for *running* one.

## Common mistakes

- Treating at-least-once as exactly-once → duplicate charges/emails (no idempotency).
- No DLQ → one poison message redelivers forever and stalls the consumer group.
- Unbounded queue, no depth/age alarm → backlog hides a meltdown until it's
  unrecoverable.
- Visibility timeout shorter than processing time → silent duplicate processing.
- Choosing global ordering when per-key would do → throughput ceiling + hot partition.
- Dual-write to DB and broker without an outbox → lost or phantom events.
- Building synchronous request/reply over a queue instead of just calling the service.
