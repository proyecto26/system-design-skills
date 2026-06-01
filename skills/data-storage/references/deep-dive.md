# Data storage deep-dive

Mechanics that don't belong in the lean SKILL.md. Read when designing the data
tier in detail.

## Partitioning (sharding) schemes

Sharding splits one logical dataset across nodes so each holds a subset. The
**shard key** decides which node owns a record; the whole design lives or dies by
that choice — it must be high-cardinality and produce an even distribution.

- **Range partitioning:** assign contiguous key ranges to shards (A–F, G–M, …).
  Great for range scans ("all orders in March"), but adjacent keys cluster, so
  sequential keys (timestamps, auto-increment IDs) create a **hot shard** that
  takes all new writes.
- **Hash partitioning:** `shard = hash(key) % N`. Spreads load evenly and kills
  hot spots, but destroys range scans (adjacent keys scatter) and **remaps almost
  every key when N changes** — a mass-migration / cache-miss storm. Avoid plain
  modulo for elastic clusters.
- **Consistent hashing:** moves only ~K/N keys when a node joins or leaves, so the
  cluster can grow/shrink without a full reshuffle; virtual nodes even out load.
  This is the standard fix for the rehashing problem above. Full mechanics are
  owned by `consistency-coordination` — link, don't re-derive.
- **Directory-based:** a lookup service maps key → shard. Most flexible
  (rebalance by editing the map) but the directory is a new lookup hop and a
  potential SPOF; cache it.

**Resharding** is the painful part. Triggers: a shard can't hold more data, or
uneven growth exhausts one shard. It means changing the partition function and
moving live data — capacity-plan *ahead* of the cliff so you're not rebalancing a
cluster that's already on fire. Consistent hashing minimizes the data moved.

**Hot/celebrity-key problem:** even with a good key, a single value can dominate
(a celebrity's followers, one giant tenant). Options: dedicate a shard to the hot
key, sub-partition it (append a bucket suffix to spread writes), or absorb its
reads in a cache (→ `caching`).

**Cross-shard pain:** joins and multi-shard transactions are hard once data is
split. Workarounds: denormalize so a query hits one shard; scatter-gather and
merge in the app (slow, fan-out failure risk); or keep related data co-located
under the same shard key. Distributed transactions/saga are owned by
`consistency-coordination`.

## Replication mechanics

- **Leader-follower (master-slave):** all writes go to the leader, which streams
  its change log to followers that serve reads. Scales reads and adds redundancy.
  **Replication lag** means followers serve stale data; under write bursts, lag
  grows. **Failover** promotes a follower to leader — but an async follower may be
  missing the leader's last writes, so promotion can lose data and needs careful
  recovery (split-brain risk if two leaders emerge).
- **Sync vs async replication:** sync waits for a follower to ack before the write
  succeeds — no data loss on failover, but writes are slower and an unreachable
  follower stalls writes. Async acks immediately — fast, but a crash loses the
  un-replicated tail. Semi-sync (ack from one follower) is the common middle.
- **Multi-leader (master-master):** more than one node accepts writes (often one
  per region). Improves write availability and local-write latency, but the same
  record edited in two places creates **write conflicts** needing resolution:
  last-write-wins (simple, drops data), version vectors, or CRDTs (merge without
  loss, limited data types). Reserve for genuine multi-region write needs.
- **Read-your-writes:** after a user writes, route their reads to the leader (or a
  caught-up replica) for a short window so they see their own change. Stronger
  guarantees → `consistency-coordination`.

## Index internals

An index is a secondary data structure that turns a full scan into a lookup, at
the cost of write amplification (every write must update the indexes) and storage.

- **B-tree / B+-tree:** self-balancing, keeps keys sorted; logarithmic point
  lookups *and* range scans. The default for relational engines. Reads are fast;
  writes do in-place updates (random IO).
- **LSM-tree (log-structured merge):** buffers writes in memory, flushes sorted
  runs to disk, compacts in the background. Write-optimized (sequential IO) — the
  engine behind Cassandra, RocksDB, Bigtable. Trade-off: reads may touch several
  runs (mitigated by Bloom filters), and compaction adds background IO.
- **Rule:** B-tree for read/range-heavy relational workloads; LSM for write-heavy
  ingestion. Index the columns in `WHERE`/`JOIN`/`ORDER BY`/`GROUP BY`. Composite
  index column order must match the query's leading predicates. Over-indexing
  slows writes and bloats storage — index for real queries, not hypothetical ones.

## Normalization vs denormalization

- **Normalize** to eliminate redundancy: one fact in one place, integrity enforced
  by foreign keys. Clean writes, but reads pay for joins.
- **Denormalize** to kill joins on the read path: duplicate data into the shape a
  query needs (precomputed feeds, embedded copies, materialized views). Reads get
  fast; writes must now fan out to every copy and copies can drift out of sync.
  Materialized views (Postgres, Oracle) let the engine maintain the redundant copy.
- **When:** reads outnumber writes 100:1+ and joins dominate latency → denormalize.
  Once sharded, denormalization is often *required* because cross-shard joins are
  impractical. Reverse it when write fan-out becomes the new bottleneck.

## Connection pooling

Each DB connection costs memory and a backend process/thread on the server, plus a
TCP+auth handshake to open. Opening one per request, or letting a spike open
thousands, exhausts the database's connection limit and starves every query.

- **Pool** a bounded set of warm connections and lease them per query; size the
  pool to the DB's capacity, not the app's concurrency. For many app instances,
  use an external pooler (e.g. PgBouncer) so total connections stay bounded across
  the fleet.
- Pool too small → requests queue waiting for a connection (latency). Too large →
  the DB thrashes. Watch pool wait time and saturation. Serverless/lambda fan-out
  is notorious for blowing past connection limits — front it with a pooler/proxy.

## Common mistakes

- Choosing NoSQL for "scale" when the data is relational and a single SQL node
  would do — then re-implementing joins and transactions in the app.
- Picking a low-cardinality or monotonic shard key → hot shards, no even spread.
- Designing the schema before the access patterns (especially wide-column, where
  the table *is* the query).
- Treating async read replicas as strongly consistent → read-your-writes bugs.
- Over-indexing; every index is a write tax.
- Sharding prematurely, before a number shows one node is exceeded (YAGNI).
- Ignoring connection limits until a spike turns the DB into a SPOF.
