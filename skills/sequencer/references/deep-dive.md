# Sequencer deep-dive

Mechanics that don't belong in the lean SKILL.md. Read when designing the
generator in detail.

## Snowflake bit layout and the epoch

The classic Twitter Snowflake packs a 64-bit signed integer (top sign bit unused
so values stay positive):

```
[ 1 unused | 41 timestamp ms | 10 node id | 12 sequence ]
```

- **Timestamp (41 bits):** milliseconds since a *custom epoch* (not the Unix
  epoch). 2^41 ms ≈ **69.7 years** of lifespan. Picking a recent custom epoch
  (e.g. the project's launch date) buys the full 69 years from *now* instead of
  burning ~55 of them on time already elapsed since 1970.
- **Node id (10 bits):** 1024 distinct generators. Split as datacenter+worker
  (e.g. 5+5) if you need region awareness.
- **Sequence (12 bits):** 4096 IDs per node per millisecond → ~4.0M IDs/node/sec.

The split is a budget you re-allocate to fit the problem: fewer node bits if you
have few generators, more sequence bits if one node must burst harder, more
timestamp bits (e.g. shift to a coarser tick) for a longer lifespan. Decide it
once; changing it later breaks sortability and risks collisions with already-
issued IDs.

**Why it's only k-sorted, not strictly sorted:** IDs are globally sortable *by
millisecond*, but within the same ms two different nodes' IDs interleave by node
id, not by true issue time. So Snowflake (and ULID/UUIDv7) give *k-sortedness*:
roughly time-ordered, good enough for range scans and pagination, not a strict
total order. A strict global monotonic counter needs single-writer serialization
(a sequence, or consensus) — that theory lives in `consistency-coordination`.

## Clock skew, rewind, and monotonic clocks

Time-based IDs assume the wall clock only moves forward. It doesn't: NTP steps it,
VMs pause and resume, leap seconds happen. The generator algorithm must defend:

```
on next_id():
  ts = now_ms()
  if ts < last_ts:            # clock moved backward
      # either block until ts >= last_ts, or reject with an error,
      # or (Snowflake variant) reuse last_ts and bump sequence
      handle_rewind()
  if ts == last_ts:
      seq = (seq + 1) & seq_mask
      if seq == 0:            # sequence exhausted this ms
          ts = wait_next_ms(last_ts)
  else:
      seq = 0
  last_ts = ts
  return (ts << shift) | (node << node_shift) | seq
```

- Read time from a **monotonic source** for the comparison where possible; use
  wall-clock only to fill the timestamp field.
- A small backward jump (a few ms) is best handled by *blocking* until the clock
  catches up. A large jump should *error* and alarm — silently emitting risks
  duplicates across the node+sequence space.
- Keep clocks tight with NTP/chrony; alarm when measured skew exceeds a threshold
  (e.g. tens of ms). Skew also corrupts ordering even when it doesn't collide.

## Node-ID assignment

Static config (node id baked into a deploy) is simple but fragile: autoscaling,
re-imaging, or a copy-paste error can boot two generators with the same id, and
they will mint *duplicates* silently. For elastic fleets, **lease** a node id:

- Register on startup against a coordinator (ZooKeeper/etcd ephemeral node, or a
  DB row with a TTL) and release on shutdown.
- Renew the lease; if it can't be renewed, stop issuing IDs.

Leader election and lease semantics are owned by `consistency-coordination` —
reference it; this skill only decides *that* node ids must be unique and how
collisions manifest.

## DB ticket / range allocation (Flickr-style)

A central table issues IDs without a per-ID network hop per generator:

- **Single-row ticket server:** a row holds the last-issued value; `REPLACE
  INTO ... ; SELECT LAST_INSERT_ID()` (MySQL) atomically bumps and returns it.
  To remove the SPOF, run two servers — one issuing **odd** numbers, one **even**
  (`auto_increment_increment=2`, different offsets). Loosely ordered, highly
  available.
- **Range/block allocation:** instead of one ID per call, a node claims a *block*
  (e.g. `UPDATE counters SET val = val + 1000 ... RETURNING old_val`) and serves
  IDs 0–999 from memory. Allocator load drops by the block size. The cost: a
  restart abandons the unused tail of the block (gaps), and IDs are only ordered
  *within* a block, not across nodes drawing concurrent blocks.

Block size is the knob: bigger blocks = fewer allocator hits and lower coupling,
but more wasted IDs on restart and weaker ordering. Size it to amortize allocator
latency over expected uptime, not to zero.

## ULID vs UUIDv7 byte layout

Both are 128-bit, time-prefixed, and lexicographically sortable by creation time —
fixing UUIDv4's random-index problem while keeping zero coordination.

- **ULID:** 48-bit ms timestamp + 80 bits randomness. Canonical text form is 26
  chars of **Crockford Base32** (case-insensitive, no `I/L/O/U` to avoid
  ambiguity), URL-safe. Monotonic variant increments the random field within the
  same ms.
- **UUIDv7:** 48-bit ms timestamp + version/variant bits + ~74 bits randomness, in
  the standard 36-char hyphenated UUID text form. Prefer it when you need RFC-UUID
  tooling/column-type compatibility.

Both still **leak creation time** in the prefix. If that's sensitive, keep them
internal and expose a separate opaque external id.

## Encoding and size

- **Raw 64-bit int:** smallest index key (8 bytes), but a long decimal string and
  trivially enumerable.
- **Base62 / Crockford Base32:** compact URL-safe strings; Base62 (`0-9A-Za-z`)
  packs a 64-bit int into ~11 chars, Base32 into ~13 but is case-insensitive and
  human-friendlier (good for codes read aloud).
- **128-bit (UUID/ULID):** 16-byte key, 26–36 char text. The index-size and
  cache-footprint cost is real on hot, heavily-indexed tables — a reason to prefer
  a 64-bit Snowflake when key size dominates.

## Common mistakes

- Burning the timestamp range on the Unix epoch instead of a recent custom epoch.
- Static node ids on an autoscaling fleet → silent duplicates.
- Treating ms-sortable IDs as a strict total order.
- UUIDv4 as a clustered primary key on a write-hot table (page splits, bloat).
- Sequential IDs as a shard key → hot shard (partition fix is in `data-storage`).
- No clock-rewind guard; trusting NTP to never step backward.
