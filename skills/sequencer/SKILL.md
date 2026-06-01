---
name: sequencer
description: This skill should be used when the user needs a "unique ID generator", "distributed IDs", a "Snowflake ID", asks "UUID vs auto-increment", wants a "time-sortable ID", a "monotonic sequence", a "ticket server", or "ID generation at scale". It gives a menu of ID schemes (UUID/ULID, Snowflake-style, DB ticket/range) with their causality, ordering, and clock-skew trade-offs. Use it whenever a design needs collision-free identifiers across many nodes, even if the user doesn't say "sequencer".
---

# Sequencer

Hand out identifiers that are unique across every node without a central
bottleneck — and decide whether those IDs must also be *sortable* or *monotonic*.
Getting this wrong shows up late and hard: collisions corrupt data, a single
allocator caps write throughput, and IDs that leak a creation time or a sequential
count expose business secrets and enable enumeration attacks.

## When to reach for this
A system writes new records across multiple nodes and each needs a primary key
(orders, messages, uploads, events). Reach for this when a single auto-increment
column would serialize all writes, when IDs must be generated before a DB round
trip (client-side, offline), or when records must be roughly time-ordered without
a separate sort field.

## When NOT to
A single relational node still comfortably serves the write load (→
`back-of-the-envelope`) — then a plain `BIGINT AUTO_INCREMENT`/`SERIAL` is the
cheapest correct answer; do not build a distributed ID service for it (YAGNI).
If a natural unique key already exists (email, ISBN, content hash), use it. Don't
demand global monotonicity unless an invariant truly needs it — it is the most
expensive property here and usually only *per-entity* ordering is required.

## Clarify first
- **Generation point** — client/edge, app server, or database? (Decides whether a
  DB round trip per ID is acceptable.)
- **Ordering need** — none, *time-sortable* (k-sorted is fine), or *strictly
  monotonic*? Per-entity or global? This is the single biggest fork.
- **Write rate & node count** — IDs/sec at peak and how many generators (→
  `back-of-the-envelope`). Sets the bits needed for a sequence counter.
- **Size & encoding budget** — 64-bit int (fits an indexed key cheaply) vs 128-bit
  (no coordination ever) vs short URL-safe string?
- **Leakage tolerance** — may the ID reveal creation time or a guessable count
  (enumeration / competitor signal)?

## The options
- **Auto-increment / SQL sequence** — one DB column hands out IDs. Use when a
  single node owns the writes and you want zero new infrastructure.
- **UUIDv4 (random 128-bit)** — generate anywhere, no coordination, effectively
  zero collision risk. Use when you only need uniqueness and never sort by ID.
- **ULID / UUIDv7 (time-prefixed 128-bit)** — random but with a millisecond
  timestamp prefix, so IDs sort by creation time. Use when you want UUIDv4's
  zero-coordination *and* time-ordering (the modern default for new keys).
- **Snowflake-style (timestamp + node + sequence, 64-bit)** — pack a timestamp,
  a node ID, and a per-ms counter into a sortable 64-bit int. Use at high write
  rates where a compact, k-sorted integer key matters.
- **DB ticket / range allocation (Flickr-style)** — a central table hands out
  *blocks* of IDs (e.g. 1000 at a time); each node serves from its block in
  memory. Use when you want simple monotonic-ish integers without per-ID
  coordination.

## Trade-offs

| Option | What it solves | What it worsens | Change it when |
|---|---|---|---|
| Auto-increment / sequence | Trivial, monotonic, compact int | Serializes writes; single node caps throughput; leaks count | Writes outgrow one node, or you need client-side IDs → ticket/Snowflake |
| UUIDv4 (random) | Generate anywhere, no coordination, no leakage | 128-bit; random order kills index locality (page splits); not sortable | You need time-ordering → ULID/UUIDv7 |
| ULID / UUIDv7 | Zero coordination + time-sortable + index-friendly | Still 128-bit; only ms-sortable (not strict); leaks creation time | You need a 64-bit key or strict order → Snowflake / sequence |
| Snowflake-style (64-bit) | Compact, k-sorted, ~4M IDs/node/sec | Needs node-ID assignment + clock-skew handling; epoch/bit budget caps lifespan | Clock sync is unreliable, or you can't assign node IDs → ULID |
| DB ticket / range | Monotonic-ish ints, low coordination, simple | Allocator table is a SPOF; gaps on restart; only loosely ordered across nodes | Allocator becomes a bottleneck or SPOF → Snowflake/ULID |

## Behavior under stress
The whole point of distributed ID schemes is to avoid a single allocator, so the
failure modes cluster around *coordination shortcuts*.

- **Allocator as SPOF/bottleneck (ticket, single sequence):** every write blocks on
  one row/node. A spike or its failure stalls all inserts. *Mitigate:* hand out
  larger ranges, replicate the allocator, or move to Snowflake/ULID (no central
  hop). Larger ranges trade away monotonicity and waste IDs on restart.
- **Clock skew & rewind (Snowflake/time-prefixed):** if a node's clock jumps
  backward (NTP correction, VM pause), it can re-emit a timestamp it already used
  and collide within its node+sequence space. *Mitigate:* refuse to emit while
  `now < last_timestamp` (block or error), use a monotonic clock source, and alarm
  on skew. Never silently trust wall-clock time.
- **Sequence-bits exhaustion:** more than `2^seq_bits` IDs in one millisecond on
  one node overflows the counter. *Mitigate:* spin-wait to the next ms, or size
  the bit budget to peak rate up front.
- **Node-ID collision:** two generators boot with the same node ID (bad config,
  autoscaling reuse) and silently mint duplicates. *Mitigate:* lease node IDs from
  a coordinator (→ `consistency-coordination`) instead of static config.
- **Hot shard from sequential keys:** monotonic IDs as a shard/partition key send
  all new writes to one shard. *Mitigate:* hash the key or prefix-shard — the
  partitioning fix lives in `data-storage`.

**Monitor:** ID issuance rate per node, clock-skew/rewind events, allocator
latency and range-exhaustion rate, and duplicate-key errors (should be zero).

## How to apply
1. **Clarify the inputs** — pin down the generation point, the ordering need
   (none / time-sortable / strict; per-entity vs global), peak IDs/sec, the size
   budget, and leakage tolerance (see *Clarify first*). If one DB node serves the
   writes, stop — use auto-increment (→ `back-of-the-envelope`).
2. **Pick from the trade-off table** — no ordering and 128-bit is fine → UUIDv4;
   want time-sortable with zero coordination → ULID/UUIDv7; need a compact 64-bit
   k-sorted int at high rate → Snowflake; want simple monotonic ints → ticket/range.
3. **Set the key knobs** — for Snowflake fix the epoch and the timestamp/node/seq
   bit split against your node count and peak rate; for ticket pick the block size;
   decide the node-ID assignment method (lease vs static); choose the encoding
   (raw int, Base62, Crockford Base32).
4. **Stress-test the choice** — walk *Behavior under stress*: clock rewind,
   sequence exhaustion, node-ID collision, allocator failure, and the hot-shard
   effect of sequential keys. Confirm a mitigation for each one your profile hits.
5. **Size it with numbers** — confirm the bit budget covers peak IDs/sec/node and
   the epoch gives enough years; confirm the encoded length fits the key/URL
   constraint (→ *Numbers that matter*).
6. **Pick a provider** — default to the generic recipe (a Snowflake library, a
   ticket row, or ULID/UUIDv7); only open a provider file if the user named a
   cloud (see *Choosing a provider*).

## Dos and don'ts
**Do**
- Default to ULID/UUIDv7 for new keys when you want zero coordination plus rough
  time-ordering — it dodges UUIDv4's random-index pain.
- Size the Snowflake bit budget (timestamp/node/sequence) against peak rate and
  required lifespan *before* picking it; write the epoch down.
- Lease node IDs from a coordinator instead of static config when nodes autoscale.
- Refuse to emit on clock rewind and alarm on skew; treat duplicate-key errors as
  a P1.
- Separate the *internal* key (sortable, may leak time) from any *external* opaque
  ID when enumeration or leakage matters.

**Don't**
- Don't build a distributed ID service before a number shows one DB node can't
  keep up (YAGNI).
- Don't use a random UUIDv4 as a clustered/primary index on a hot table — random
  order causes page splits and write amplification.
- Don't make a single sequence or ticket row the allocator for the whole fleet
  without replication — it's a SPOF and a write bottleneck.
- Don't use a globally monotonic ID as a shard key — it creates a hot shard (fix
  in `data-storage`).
- Don't trust wall-clock time for ordering; ms-sortable is k-sorted, not strict.

## Numbers that matter
A 64-bit Snowflake layout (≈41 timestamp bits + 10 node + 12 sequence) gives ~69
years from its epoch, 1024 nodes, and 4096 IDs/node/ms ≈ **4M IDs/node/sec** —
ample for almost any single service. UUID/ULID are 128 bits = 16 bytes (vs 8 for
a 64-bit int), doubling index key size. A ticket block of N IDs cuts allocator
hits by N× but risks losing up to N IDs on a node restart. For peak-rate and
storage sizing, see `back-of-the-envelope`; restate only the figure a decision
turns on.

## Interface sketch
An issued ID is a contract. State its **width** (64 vs 128 bit), its **layout**
(e.g. Snowflake `[timestamp:41 | node:10 | seq:12]`), its **ordering guarantee**
(unordered / k-sorted by ms / strict), and its **encoding** (raw int, Base62,
Crockford Base32 — case-insensitive, URL-safe). A generator endpoint, if any, is
minimal: `next(entity) -> {id, issued_at}`. Document whether the ID is the storage
key, the sort key, or both — that choice is consumed by `data-storage`.

## Choosing a provider
Default to the generic recipe above. If the user names a cloud, read
`references/providers/<provider>.md` for the managed-service mapping,
quotas/limits, and provider-specific trade-offs. If no file exists for that
provider, the generic recipe is the answer (most clouds have **no** dedicated ID
service — you run a library or a sequence yourself).

## Diagram
To visualize the issuance path (generator nodes → 64-bit layout → record key) or
the ticket-server block-allocation flow, use the in-plugin `architecture-diagram`
skill; an inline `[ts | node | seq]` sketch is enough for quick bit-budget
reasoning. Do not embed Mermaid.

## Related building blocks
- `data-storage` — *feeds into* it: the ID becomes the primary/sort key, and the
  sharding/partitioning that a sequential key can hot-spot is owned there.
- `consistency-coordination` — *depends on* it for the causality, ordering, and
  leader-election theory behind monotonic guarantees and node-ID leasing; link,
  don't re-teach.
- `messaging-streaming` — *pairs with* it for message ordering and dedup, where
  time-sortable IDs give a natural sequence and idempotency anchor.
- `api-design` — *pairs with* it: ID generation underpins idempotency keys (owned
  there) for safe retries.
- `system-design` — *owned-concept lives in* the orchestrator: the reasoning loop,
  the trade-off method, and the ten failure modes.

## References
- **`references/deep-dive.md`** — Snowflake bit-layout math and epoch choice,
  clock-skew/monotonic-clock handling, ticket-server range allocation, ULID vs
  UUIDv7 byte layout, encoding (Base62/Crockford), and node-ID leasing. Read when
  designing the generator in detail.
- **`references/providers/{generic,aws,gcp}.md`** — library/service mappings,
  limits, and pitfalls per environment.
