# Distributed logging deep-dive

Mechanics that would bloat SKILL.md. Read when designing the pipeline in detail.

## The pipeline stages

`collect → buffer → ship → index → store → retain`. Each stage is a place a spike
can stall. The art is making every stage shed load gracefully so an incident's log
flood never feeds back into the application.

- **Collect** — an agent (Fluent Bit, Vector, Fluentd, Filebeat) tails files or reads
  the container stdout stream, parses/enriches (add `host`, `pod`, `region`, `service`),
  and forwards. Fluent Bit/Vector are lightweight (C/Rust) node agents; Fluentd is
  heavier with more plugins. Keep parsing cheap — regex parsing of free-text at the
  agent is a common CPU sink; prefer structured input.
- **Buffer** — a bounded queue between collect and ship. Local disk buffer on the
  agent survives short indexer outages; a durable bus survives long ones and fans out.
- **Ship** — push or pull to the indexer/sink. Batch and compress; one request per
  line melts the network and the indexer.
- **Index** — build the search structure (inverted index for full-text, or label
  index for Loki). Most expensive stage in RAM and disk.
- **Store + retain** — hot searchable tier, then roll to cold object storage.

## Buffering and backpressure

The cardinal rule: **logging is best-effort and must never block or crash the app.**
Concretely:

- Use an **async, bounded** in-process buffer (ring buffer / bounded channel). When
  full, choose an overflow policy explicitly: drop-newest, drop-oldest, or sample.
  Never an unbounded queue (it becomes an OOM) and never a synchronous blocking write
  to the network on the hot path.
- The agent's **disk buffer** rides out indexer hiccups and retries with backoff. Size
  it to cover the longest expected sink outage at peak volume — that is a real GB
  number, not "some".
- A **durable bus** (`messaging-streaming`) moves the backlog off the application
  hosts entirely: producers write and move on, consumers (indexer, archiver) read at
  their own pace and replay after an outage. Delivery guarantees, consumer-group
  backpressure, ordering, and DLQ behavior are owned by `messaging-streaming`; this
  pipeline just relies on them.

Backpressure must terminate at a *drop or sample*, never at the user request. If the
only thing throttling producers is the indexer being slow, an indexer incident
becomes an application incident.

## Sampling strategies

Sampling trades completeness for survivability and cost. Pick per log class:

- **Keep all errors/warns, sample info/debug.** The cheapest high-value policy — you
  almost always want every error but not every health-check line.
- **Head sampling** — decide at emit time (e.g. keep 10% of debug). Simple, cheap,
  but may drop the one line you needed.
- **Tail sampling** — buffer a trace's lines and keep the whole trace only if it
  errored or was slow. Far better signal, needs the trace's lines grouped (partition
  by `trace_id`) and short buffering.
- **Dynamic / rate-capped** — per-service ceiling (e.g. max N lines/sec/service); a
  runaway debug deploy gets clamped instead of blowing the cluster.

Always **meter the sample/drop rate and alert on it.** Silent dropping hides the
failure you are debugging — that is the "ignore failure" trap in disguise.

## Structured logging and correlation IDs

- **Structured (JSON or key/value)** logs are queryable as fields; free text forces
  fragile regex at index time. Standardize a schema across services: `ts`, `level`,
  `service`, `host`, `trace_id`, `span_id`, `msg`, plus typed fields.
- **Correlation / trace ID**: generate at the system edge (gateway/LB) if absent,
  propagate through every hop (HTTP header like `traceparent`, message metadata, RPC
  context), and stamp it on every log line. This is what turns "search 8 services by
  hand" into one query. The propagation convention and the metrics/traces side of this
  are owned by `observability`; here it is just a mandatory field on the log event.
- Keep **index labels bounded** (low cardinality: `service`, `level`, `region`).
  Put high-cardinality values (`user_id`, `request_id`) in the *body* as searchable
  fields, not as index keys — high-cardinality index fields cause mapping explosions
  and hot shards.

## Index lifecycle and rollover

- **Time-based indices** (e.g. one index per day/hour, or rollover at a size/age
  threshold) let retention be "delete old indices" — cheap and atomic — instead of
  per-document deletes.
- **Shard sizing**: too many tiny shards waste cluster memory; one giant shard becomes
  a hot spot. Aim for moderate, even shards; let rollover cap shard size.
- **Tiered nodes** (hot/warm/cold) move aging indices to cheaper, slower hardware
  before archival. ILM/lifecycle policies automate the hops.

## Ordering

A durable bus orders messages **only within a partition**. Logs merged from many
hosts/partitions interleave, and clocks across hosts skew. Therefore:

- Treat **arrival order as meaningless** for causality. Sort by the **event timestamp**
  carried in the line at query time.
- For strict per-request order, partition the bus by `trace_id` so one request's lines
  land on one partition in order, and/or carry a monotonic sequence/span order.
- For a globally monotonic ordering key, use `sequencer` (Snowflake-style IDs); clock
  skew and monotonicity are its domain.

## Cold tiering to object storage

- Roll data out of the hot index once it ages past the **debugging window** (often
  7–30 days) into compressed objects in `blob-store`. Logs compress well (~5–10×).
- Cold reads are **slow and often manual** (rehydrate / re-index a day's archive, or
  query in place with a query engine). That is acceptable for audit/forensics; if old
  data needs fast search, widen the hot window instead — and pay for it.
- Object-store **lifecycle rules** (transition to colder classes, then expire) enforce
  retention automatically. Durability, tiering classes, and lifecycle are owned by
  `blob-store`.
- Encrypt and redact: PII often must be masked before archive, and legal holds may
  freeze deletion. Bake redaction into the pipeline (at the agent or a stream
  processor), not as an afterthought.

## Common mistakes

- A logging call that blocks the request thread on a slow sink (turns a sink outage
  into a user-facing outage).
- Unbounded in-memory buffer → OOM during the exact spike it was meant to absorb.
- Indexing high-cardinality fields → mapping explosion and hot shards.
- One huge "logs" index with no rollover → cannot delete old data cheaply, retention
  becomes a crisis.
- Silent sampling/drop with no metric → the incident's evidence vanishes invisibly.
- Trusting arrival order across hosts as causal order.
- Keeping everything hot "just in case" → the cluster cost balloons; tier instead.
