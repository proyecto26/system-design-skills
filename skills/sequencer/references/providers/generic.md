# Sequencer — Generic (self-hosted / open-source / library)

The default answer when no cloud is named. There is no "ID service" to buy in the
common case — you pick a library or a tiny piece of infrastructure you already run.

## Recipe mapping → options
- **UUIDv4 / UUIDv7** → standard-library or first-party uuid packages in every
  language (e.g. Python `uuid`, Java `java.util.UUID` + a v7 lib, Go `google/uuid`).
  No infrastructure.
- **ULID** → small libraries in every ecosystem (e.g. `ulid` packages). No
  infrastructure; pick the *monotonic* variant if you generate many per ms.
- **Snowflake-style** → embed a library (Twitter's original, Sony's `sonyflake`,
  Baidu `uid-generator`, or a ~50-line homegrown generator). Node id from config
  or a lease (see below).
- **Ticket / range allocator** → a single SQL row. MySQL: `REPLACE INTO Tickets ...
  ; SELECT LAST_INSERT_ID()`. Postgres: a `SEQUENCE` with `CACHE`/range claims, or
  `UPDATE counters SET v = v + :block RETURNING v - :block`.
- **Plain sequence** → Postgres `SERIAL`/`IDENTITY`, MySQL `AUTO_INCREMENT` — the
  default when one DB node owns the writes.
- **Node-ID leasing** → ZooKeeper/etcd ephemeral node, Consul session, or a DB row
  with a TTL (coordination theory: `consistency-coordination`).

## Limits / things that bite (verify against current docs)
- A single ticket/sequence row tops out near a single relational node's write
  ceiling (~**1k QPS** order of magnitude; → `back-of-the-envelope`). Range
  allocation with block size N multiplies that headroom by ~N.
- A 64-bit Snowflake's lifespan and node count are fixed by its bit split (e.g.
  ~69 years / 1024 nodes / 4M IDs/node/sec for 41/10/12) — chosen once, hard to
  change after IDs are issued.
- Postgres sequences are not gap-free and may skip on rollback/crash — fine for
  IDs, not for "count of rows."

## Trade-offs specific to self-hosting
- You own node-ID assignment, clock-skew monitoring (NTP/chrony), and allocator
  failover — no managed automation, but full portability and no lock-in.
- Embedding a Snowflake library means *no* network hop per ID (best latency) but
  pushes clock-sync and node-ID discipline onto every host.
- A ticket server is one more stateful thing to make highly available (run
  odd/even pair, or replicate).

## Pitfalls
- Reaching for a distributed scheme when one `SERIAL` column would serve the load.
- Static node ids on an autoscaling fleet → silent duplicate IDs.
- Using the Unix epoch (not a recent custom epoch) and wasting decades of the
  timestamp range.
- UUIDv4 as a clustered primary key on a write-hot table — random order causes
  index page splits; prefer ULID/UUIDv7.
- No clock-rewind guard in a homegrown Snowflake generator.
