# Sequencer — GCP

## Service mapping
GCP has **no dedicated ID-generation service** — the generic recipe (Snowflake
library, ULID/UUIDv7, or a ticket row) applies. The notable GCP-specific twist is
**Cloud Spanner**, whose docs *actively warn against* monotonic primary keys:

- **Cloud Spanner** — a globally-distributed SQL DB. A timestamp-ordered or
  auto-incrementing primary key creates a **hotspot**: all new writes land on the
  same key range / split, defeating Spanner's horizontal scaling. Spanner's own
  guidance is to use a **UUID** (v4) primary key, **bit-reverse** a sequential
  key, or hash-prefix it. Spanner also offers a built-in `GENERATE_UUID()` and
  bit-reversed sequences for exactly this reason. (The hotspot/partition concept
  is owned by `data-storage`.)
- **Cloud SQL (MySQL/Postgres)** — native `AUTO_INCREMENT`/`SEQUENCE` and the
  ticket-server pattern work as in generic; single writer serializes a sequence.
- **Bigtable / Firestore** — like Spanner, sequential row keys/document IDs hotspot
  a single tablet; Firestore auto-generated IDs are random by design for this
  reason.
- **GKE / Cloud Run / Compute Engine** — host the Snowflake/ULID library; node-ID
  assignment under autoscaling is the open problem (lease it, or use ULID/UUIDv7).
- **Memorystore (Redis)** — `INCR`/`INCRBY` for an atomic counter or range
  allocator.

## Limits / things that bite (verify against current docs)
- **Spanner split hotspotting** is the headline constraint: monotonic keys cap
  throughput regardless of node count. Use UUID, bit-reversed, or hashed keys.
- **Cloud Run / GKE pods have no stable identity** under autoscaling — static
  Snowflake node ids are unsafe; lease them or avoid needing them.
- Clocks are NTP-synced but can step; keep the rewind guard.

## Provider-specific trade-offs
- Spanner/Bigtable/Firestore push you toward random or time-prefixed-but-
  high-cardinality IDs (UUIDv7/ULID, or bit-reversed sequences) — a hard design
  constraint, not a style choice.
- `GENERATE_UUID()` and bit-reversed sequences keep ID logic in the DB (no app
  library) at the cost of losing client-side generation.

## Pitfalls
- Monotonic / timestamp-leading primary key in Spanner or Bigtable → split/tablet
  hotspot and throttling.
- Static Snowflake node ids on Cloud Run/GKE → duplicates under scale-out.
- Expecting a managed "ID service" — there isn't one; you run a library or a
  DB-side function.
