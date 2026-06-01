# The trade-off framework

There is no single correct design. Two competent teams given the same problem
produce different systems, because every component carries distinct advantages,
costs, and weaknesses. The job is not to find *the* answer — it is to choose
deliberately and be able to defend the choice. This is the difference between
designing a system and repeating a pattern.

## The three questions

For **every** major component or decision, answer all three:

1. **What problem does this solve?** — the specific constraint (from steps 1–2)
   that motivates it. If you can't tie it to a requirement or a number, you
   probably don't need it yet.
2. **What does it make worse?** — the cost. Every addition trades something:
   operational complexity, latency, consistency, money, a new failure mode.
3. **What would make me change this decision?** — the breaking point. State the
   condition under which this choice stops being right ("this holds until writes
   exceed ~10k/s", "fine until we need cross-region reads").

If you cannot answer all three, the decision is not grounded. Say so, and either
clarify or pick the simpler option and note the risk.

> After every major choice, write down one thing it improves and one thing it
> makes harder. If you can't, you don't yet own the decision.

## Worked example: "use Kafka"

| Question | Answer |
|---|---|
| Solves | Decouples producers from consumers; absorbs write spikes; high throughput; replay. |
| Worsens | Operational complexity; end-to-end latency; eventual consistency between producer and consumer views; another thing to monitor. |
| Change it when | Latency must be very low and volume is modest → a managed queue (SQS, RabbitMQ); or when you need per-key transactional ordering a simpler store gives you. |

That table — not the word "Kafka" — is the design contribution.

## Common axes to reason on

Most decisions reduce to a position on one or more of these. Name where you sit
and why.

- **Consistency ↔ availability** (under partition, per CAP). Reject writes to
  preserve invariants, or accept and reconcile? → `consistency-coordination`.
- **Latency ↔ throughput.** Batching and queues raise throughput and tail
  latency; synchronous paths lower latency but cap throughput.
- **Read ↔ write optimization.** Denormalization, caching, and fan-out-on-write
  speed reads at the cost of write amplification and staleness. → `caching`,
  `data-storage`.
- **Strong ↔ eventual consistency.** Stronger guarantees cost latency,
  availability, and coordination.
- **Cost ↔ complexity ↔ performance.** The cheapest design that meets the
  constraint usually wins; over-engineering is a real red flag.
- **Push ↔ pull.** Precompute on write (push) vs compute on read (pull); the
  celebrity/hot-key problem usually forces a hybrid. → `messaging-streaming`.
- **Normalization ↔ denormalization.** Integrity and write simplicity vs read
  speed and duplication.

## Resource management and weaknesses

Two more lenses the GUIDE calls out:

- **Resource management** — choices differ in money and operational burden, not
  just performance. Use resources efficiently; don't pay for scale you won't
  reach soon.
- **Weaknesses** — every design has limits. Surface them *proactively*: "this
  won't handle a 10× spike, but we don't expect that soon; we'll monitor growth
  and shard when reads pass X." Naming the weakness and the plan is a strength,
  not a confession.

## The "but the user insists" case

Sometimes you have strong reasons for NoSQL but the user insists on a relational
DB (or vice versa). Don't dig in. Restate the trade-off honestly, agree to their
constraint, and adapt the rest of the design to it (e.g. relational with
read-replicas + a denormalized read model). Flexibility under a fixed constraint
is the senior signal; defending design purity is the red flag.
