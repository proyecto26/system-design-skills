---
name: messaging-streaming
description: This skill should be used when the user designs a "message queue", reaches for "Kafka", "RabbitMQ", "SQS", "Kinesis", "pub/sub", or "event-driven" architecture, asks about "async processing", "background jobs", "stream processing", or wrestles with "exactly-once vs at-least-once", "delivery guarantees", "message ordering", "duplicate handling / dedup", "dead letter queue", "backpressure", "saga orchestration", or "durable workflow". Use it whenever a slow or spiky operation should move off the request path, or two services must be decoupled, even if the user doesn't say "queue".
---

# Messaging & Streaming

Move work off the synchronous request path and decouple producers from
consumers, so a slow, spiky, or failure-prone operation doesn't block the
caller. Getting this wrong is subtle: a queue silently changes the delivery and
ordering guarantees, and under load it can absorb a spike gracefully *or* become
the thing that hides a meltdown until the backlog is unrecoverable.

## When to reach for this
A step is too slow to do inline (image transcode, fan-out, third-party call); the
write path is spiky and needs a buffer to smooth bursts (→ `back-of-the-envelope`
for the spike factor); two services must be decoupled so one can fail or deploy
independently; or many consumers need the same event stream. The async hand-off
buys responsiveness, isolation, and elasticity (scale producers and consumers
separately).

## When NOT to
The caller needs the result *now* to proceed (a synchronous read, a balance check
before confirming) — a queue only adds latency and a place for work to get lost.
Strong read-after-write within one request. Trivial in-process work that a
function call handles. Don't add a broker before a number or a coupling problem
justifies it (YAGNI): it's a new stateful system to operate, monitor, and reason
about under failure. "We'll need Kafka eventually" is name-dropping, not a
requirement.

## Clarify first
- **Sync or async?** Does the caller need the result inline, or is fire-and-react
  acceptable? This decides whether a queue belongs here at all.
- **Delivery guarantee needed** — is a dropped message acceptable (at-most-once),
  or must every message be processed (at-least-once + idempotent consumers)?
- **Ordering** — must messages be processed in order, globally or per-key (per
  user, per account)? Global ordering is expensive; per-key usually suffices.
- **Throughput and retention** — messages/sec at peak, and how long must they be
  replayable? (→ `back-of-the-envelope`.) One-shot work vs. a replayable log.
- **Consumer count and pattern** — one worker pool draining a job, or many
  independent subscribers each reading every event?
- **Failure handling** — what happens to a message that keeps failing? Where does
  it go, and who looks at it?

## The options

**Sync vs. async — settle this before picking a tool.** Stay synchronous when the
caller needs the result to continue and the call is fast and reliable; a direct
request is simpler to build, trace, and reason about. Go async when the work is
slow, spiky, fan-out-heavy, or the caller can react to the result later — this
trades immediate consistency and an easy stack trace for responsiveness and
isolation. Only after choosing async do the options below apply. Building
request/reply *over* a queue to fake a synchronous answer is a smell — a direct
call is the better design.

**Queue (work/task queue)** — one logical consumer group competes to drain
messages; a message is delivered to one worker and removed when acked. *Use when*
there are background jobs or commands to process exactly once-ish, and workers
should scale to drain a backlog.

**Pub/sub (fan-out)** — each subscriber gets its own copy of every message;
producers don't know subscribers. *Use when* multiple independent consumers react
to the same event (notify, index, audit) and loose coupling matters.

**Stream (durable, replayable log)** — an append-only, partitioned, retained log;
consumers track their own offset and can replay history. *Use when* the design
needs ordering per partition, multiple consumers at different positions, event
sourcing, or reprocessing (→ `data-storage` for event sourcing/outbox).

**Durable workflow (orchestration engine)** — code that survives process crashes;
the engine persists each step and resumes where it left off, with built-in
retries, timers, and compensation. *Use when* a multi-step process with retries,
human delays, and rollback (a saga) would otherwise become a fragile hand-rolled
mesh of queues, state flags, and cron jobs.

Delivery semantics cut across all of these: **at-most-once** (fire and forget,
may drop), **at-least-once** (retries until acked, may duplicate — the practical
default), **exactly-once** (no loss, no dup). True end-to-end exactly-once is
impractical: a broker's "EOS" (e.g. Kafka) is **intra-cluster only**, so across
systems you always implement it as **at-least-once + idempotent/deduped
consumers** (→ `api-design` idempotency keys). See
`references/deep-dive.md` for the mechanics.

## Trade-offs

| Option | What it solves | What it worsens | Change it when |
|---|---|---|---|
| Queue (work queue) | Decouples + buffers; scale workers to drain backlog | At-least-once means duplicates; ordering not guaranteed across workers | Replay or many independent consumers are needed → stream/pub-sub |
| Pub/sub (fan-out) | One event, N decoupled reactions; add consumers freely | No replay (transient); slow subscriber can lag or drop; fan-out amplifies load | History/replay or per-key ordering is needed → stream |
| Stream (log) | Ordering per partition, replay, multi-consumer, event sourcing | Operationally heavier; partition key is a hot-shard risk; consumers must manage offsets | Simple one-shot jobs don't need a log → queue |
| Durable workflow | Crash-safe long-running sagas; retries/compensation built in | New runtime + programming model; latency overhead; lock-in to engine semantics | A single async step with no orchestration → plain queue |
| At-least-once delivery | No message loss under retry/crash | Duplicates — consumers must be idempotent (→ `api-design` idempotency keys) | Loss is acceptable and dedup cost isn't worth it → at-most-once |
| Exactly-once (effective) | No loss and no duplicate side effects | Cost/complexity; often narrow (within one broker, not across systems) | Idempotent at-least-once is good enough (it usually is) |

## Behavior under stress
A broker's whole job is to absorb a spike — but it can also *hide* a meltdown.

- **Backlog growth / unbounded queues:** producers outpace consumers; the queue
  grows past memory, spilling to disk and slowing further. End-to-end latency
  climbs invisibly while throughput looks fine. *Mitigate:* **backpressure** —
  bound the queue and shed or 503 producers (with backoff) once full, rather than
  buffering forever. Alarm on queue depth and message age, not just rate.
- **Retry storms / poison messages:** a message that always fails is redelivered
  forever (at-least-once), burning consumer capacity and re-amplifying load on a
  downstream that's already struggling. *Mitigate:* capped retries with
  backoff+jitter, then route to a **dead-letter queue (DLQ)** so the poison
  message stops blocking the line and a human can inspect it. (Retries, backoff,
  DLQ-as-containment, and backpressure are owned by `resilience-failure`.)
- **Duplicate amplification:** under retry, the same side effect (charge, email)
  fires twice unless consumers dedup. *Mitigate:* idempotency keys / dedup table.
- **Hot partition:** in a stream, a skewed partition key (one celebrity, one
  tenant) overloads a single partition while others idle — the same hot-key shape
  as `data-storage` sharding. *Mitigate:* better key, sub-partitioning, or batching.
- **Slow consumer in fan-out:** one lagging subscriber backs up or drops; isolate
  consumers so one can't stall the others.

**Monitor:** queue depth, **oldest-message age / consumer lag** (the single best
signal), redelivery/DLQ rate, consumer throughput vs. producer rate, and
end-to-end latency.

## How to apply
1. **Clarify the inputs.** Settle sync vs. async first; if the caller needs the
   result inline, stop — no broker. Then answer delivery guarantee, ordering
   scope, throughput/retention, consumer pattern, and failure handling (see
   *Clarify first*).
2. **Pick the shape from the trade-off table.** One worker pool draining jobs →
   **queue**; many independent reactions to one event → **pub/sub**; ordering,
   replay, or multiple offsets → **stream**; multi-step retry/compensation saga →
   **durable workflow**. Pick the cheapest shape that meets the constraint.
3. **Set the key knobs.** Choose the delivery semantic (at-least-once + idempotent
   consumers is the default), the ack point (after-process vs. before), the
   partition/ordering key, retention window, and retry cap before the DLQ.
4. **Stress-test the choice.** Walk backlog growth, retry storms / poison
   messages, duplicate amplification, hot partition, and slow fan-out consumer.
   Add backpressure, a DLQ, and dedup where each applies.
5. **Size it with numbers.** Compute peak produce vs. sustained consume rate,
   `consume_rate − produce_rate` drain, partition count vs. consumer parallelism,
   and storage = rate × message size × retention (→ `back-of-the-envelope`).
6. **Pick a provider.** Default to the generic recipe; only read a provider file
   if the user names a cloud and a managed limit changes the choice.

## Dos and don'ts
**Do**
- Settle sync vs. async before naming any broker; keep synchronous work synchronous.
- Default to at-least-once and make consumers idempotent (→ `api-design` keys).
- Bound queues and apply backpressure; alarm on oldest-message age / consumer lag.
- Cap retries with backoff+jitter, then route poison messages to a DLQ.
- Define the message envelope (`message_id`, schema version, key, `trace_id`) up front.

**Don't**
- Don't add a broker "for scale later" before a number or coupling problem justifies it.
- Don't build request/reply over a queue to fake a synchronous answer.
- Don't reach for exactly-once when idempotent at-least-once already suffices.
- Don't buffer an unbounded backlog — it hides a meltdown until it's unrecoverable.
- Don't pick a global ordering guarantee when per-key ordering is enough.

## Numbers that matter
Quantify before choosing: peak produce rate vs. sustained consume rate (if
producers can outrun consumers for long, backpressure and a depth alarm are
required), retention window (drives storage = rate × message size × retention), and
partition count (caps consumer parallelism — one consumer per partition per
group). A backlog drains at `(consume_rate − produce_rate)`; if that's negative,
it never drains. Use `back-of-the-envelope` for the spike factor, message sizes,
and storage; don't restate its tables here.

## Interface sketch
A message is a contract. Define it explicitly, not as "an event":
- **Envelope:** stable `message_id` (for dedup), `type`/`schema_version`, a
  `partition_key`/ordering key, `timestamp`, and a `trace_id` for correlation.
- **Payload:** a versioned schema. Prefer event facts (`OrderPlaced{order_id,
  total}`) over commands when fanning out; keep it small and forward-compatible.
- **Ack contract:** when does the consumer ack — before or after the side effect?
  Ack-after-process gives at-least-once; ack-before gives at-most-once.
- **DLQ shape:** failed messages keep the original envelope plus failure reason
  and attempt count, so they can be inspected and replayed.

## Choosing a provider
Default to the generic recipe above. If the user names a cloud, read
`references/providers/<provider>.md` for the managed-service mapping,
quotas/limits, and provider-specific trade-offs. If no file exists for that
provider, the generic recipe is the answer.

## Diagram
To visualize the producer → broker → consumer path, fan-out to multiple
subscribers, or the retry → DLQ flow, use the in-plugin `architecture-diagram`
skill. Quick inline sketch: `producer → [queue] → workers ─fail→ [DLQ]`; the main
path solid, the DLQ branch dashed.

## Related building blocks
- `resilience-failure` — *owned-concept lives in*: retries/backoff/jitter,
  dead-letter queues, and backpressure as outage containment. This skill names
  them; that one tunes them.
- `api-design` — *depends on* its idempotency keys, the mechanism that makes
  at-least-once delivery safe.
- `data-storage` — *pairs with* this for event sourcing and the transactional
  outbox; *owned-concept lives in*: the hot-shard/partition-key problem streams inherit.
- `consistency-coordination` — *owned-concept lives in*: ordering guarantees,
  exactly-once vs. idempotency, and saga/distributed-transaction theory behind
  durable workflows.
- `back-of-the-envelope` — *feeds into* sizing: the produce/consume rates,
  retention, and storage that size the broker.
- `system-design` — *the orchestrator* that routes here when work goes async.

## References
- **`references/deep-dive.md`** — delivery-guarantee mechanics (acks, visibility
  timeouts, offsets, idempotent/dedup consumers, transactional outbox), ordering
  internals, partitioning, DLQ design, and when durable-workflow engines beat
  hand-rolled queue+retry+saga. Read when designing the messaging layer in detail.
- **`references/providers/{generic,aws,azure,gcp,temporal}.md`** — service
  mappings, decision-changing limits, and pitfalls per environment.
