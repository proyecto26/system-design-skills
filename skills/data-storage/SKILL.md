---
name: data-storage
description: This skill should be used when the user asks "SQL or NoSQL", "which database", how to design a "data model" or "schema design", picks an "indexing" strategy, needs "sharding" or "partitioning", sets up "replication" (leader-follower / multi-leader), defines a "primary key"/"sort key", asks whether to "denormalize", or weighs "polyglot persistence". Use it whenever a design must decide where records live, how they are keyed and accessed, and how the store scales past one node — even if the user just says "store the data".
---

# Data Storage

Choose where records live, how they are keyed and queried, and how the store
grows past a single machine. Storage is the hardest layer to change later: a
wrong data model or shard key calcifies into a scaling ceiling, and getting
replication wrong silently serves stale or lost data.

## When to reach for this
Any system that persists state: picking SQL vs NoSQL, designing a schema and its
access paths, adding indexes, splitting a hot table, distributing data across
nodes (sharding/partitioning), adding read replicas, or deciding what to
denormalize. Reach here the moment "store the data" needs a concrete key and
query shape.

## When NOT to
Don't shard, add replicas, or reach for NoSQL before a number forces it (YAGNI).
A single well-indexed relational node handles ~1k QPS and tens of GB to low TB
comfortably — most systems never outgrow it. Sharding multiplies operational
cost and breaks joins/transactions; add it only when one node's write throughput
or dataset size is genuinely exceeded (→ `back-of-the-envelope`). Caching reads
(→ `caching`) and adding read replicas are cheaper first moves than sharding.

## Clarify first
Answer these before choosing a store or topology — they decide the design:

- **Data shape & relationships** — flat key-value? rich relations needing joins?
  document blobs? a graph of connections? Drives SQL vs NoSQL.
- **Access patterns** — *how* is data read and written, not just where it lives.
  Point lookups by key, range scans, ad-hoc queries, aggregations? Model the
  store around the queries it must serve.
- **Read:write ratio & scale** — QPS each way, total size now and at retention.
  (→ `back-of-the-envelope` for QPS, storage, and shard counts.)
- **Consistency need** — must reads see the latest write, or is eventual OK? Are
  multi-record transactions required? (CAP/consistency theory → `consistency-coordination`.)
- **Latency & durability targets** — p99 read/write budget, and how much recent
  data the system can afford to lose on a node failure.

## The options

**Relational (SQL — Postgres, MySQL):** strict schema, joins, ACID transactions.
*Use when* data is relational, integrity matters, and queries are varied/ad-hoc —
the safe default until a number rules it out.

**Document (MongoDB, etc.):** flexible schema, self-contained JSON-ish documents
queried by structure. *Use when* records are read/written as a whole and the
schema evolves; relationships are few.

**Key-value (Redis, DynamoDB, Riak):** O(1) get/put by key, no rich queries.
*Use when* access is purely by a known key and massive throughput is needed.

**Wide-column (Cassandra, Bigtable, HBase):** rows keyed by partition, columns
sparse, keys kept sorted for range scans. *Use when* writes are huge and the
table can be designed around a few known query patterns.

**Graph (Neo4j):** nodes and edges. *Use when* the core queries traverse
many-to-many relationships (social graph, recommendations).

**Scaling moves (apply on top of any store):**
- **Indexing** — add a secondary structure so a query stops scanning. First lever.
- **Read replicas (leader-follower)** — copy writes to followers that serve reads.
  *Use when* reads dominate and slight staleness is OK.
- **Federation** — split DBs by function (users / products / forums). *Use when*
  functional domains scale independently and rarely join.
- **Sharding/partitioning** — split one logical table across nodes by a shard key.
  *Use when* a single node's writes or dataset are exceeded. (This skill owns it.)
- **Denormalization** — store redundant copies to skip joins. *Use when* reads
  vastly outnumber writes and joins are the bottleneck.

**Polyglot persistence:** use more than one of the above, each for what it's best
at (e.g. Postgres for orders, Redis for sessions, a search index for full-text).
The cost is operating and reconciling several stores.

## Trade-offs

| Option | What it solves | What it worsens | Change it when |
|---|---|---|---|
| Relational/SQL | Joins, ACID, ad-hoc queries, integrity | Single-node write ceiling; schema migrations; harder horizontal scale | Writes/size exceed one node, or schema is truly fluid → NoSQL/shard |
| Document | Schema flexibility; whole-object reads | No joins; cross-document consistency is manual; query engine weaker | Data turns relational or needs multi-doc transactions → SQL |
| Key-value | Extreme throughput, simple ops | Only key access; no range/secondary queries | Queries beyond the key are needed → document/wide-column |
| Wide-column | Write-heavy scale, range scans on sorted keys | Must know queries up front; rigid once keyed; eventual by default | Access patterns are unknown/varied → relational |
| Graph | Cheap deep relationship traversal | Niche tooling; hard to shard; weak for bulk scans | Relationships are shallow → relational/document |
| Indexing | Turns scans into lookups | Slower writes; more storage; index bloat | Write amplification hurts more than the read win |
| Read replicas | Offloads reads; redundancy | Replication lag → stale reads; failover/promotion logic | Stale reads unacceptable → read-from-leader / `consistency-coordination` |
| Federation | Per-domain scale, smaller working sets | Cross-domain joins break; app routing logic | A single domain still won't fit → shard that domain |
| Sharding | Horizontal write + storage scale | Cross-shard joins/txns hard; resharding pain; hot shards | One node holds it fine, or hot shards dominate → consolidate/re-key |
| Denormalization | Kills expensive joins on the read path | Duplicated data; write-time fan-out; consistency drift | Write load makes fan-out the new bottleneck → normalize/cache |

## Behavior under stress
Storage is where load and failure get amplified into outages.

- **Hot shard / celebrity key:** a skewed shard key sends disproportionate traffic
  to one node (a viral user, a single tenant) while others idle. The cluster looks
  under-loaded but one shard is melting. *Mitigate:* a shard key with high
  cardinality and even distribution; isolate or sub-partition hot keys.
- **Replication lag:** under write bursts, followers fall behind the leader, so
  reads go stale — and a failover may promote a follower that lost recent writes.
  *Mitigate:* read-from-leader for read-your-writes; bound and alert on lag.
- **Connection exhaustion:** each DB connection costs memory and a backend
  process/thread; a traffic spike (or a retry storm) opens more connections than
  the DB can serve, and *every* query slows or errors. A pooler in front (bounded
  pool) is what keeps the DB alive — without it the database is a SPOF that fails
  under load.
- **Thundering writes / lock contention:** hot rows or a single sequence/counter
  serialize writes; index updates and lock waits stack up.
- **Resharding under pressure:** rebalancing while already overloaded moves huge
  data volumes and can tip the cluster over. Plan capacity ahead of the cliff.

**Monitor:** replication lag, per-shard QPS and size (skew), connection-pool
saturation/wait time, slow-query rate, lock waits, and disk/IOPS headroom.

## How to apply
1. **Clarify the inputs** — settle data shape, access patterns, read:write ratio,
   consistency need, and latency/durability targets (see *Clarify first*). No store
   choice survives unknown access patterns.
2. **Pick the store from the trade-off table** — match data shape to an option;
   default to relational until a number or relationship pattern rules it out. Name
   what each candidate worsens, not just what it solves.
3. **Pin the interface** — write the primary key, partition/sort key, and the
   secondary indexes for each query before adding scale machinery (see *Interface
   sketch*). The key is the decision.
4. **Set the scaling knobs in cheap-first order** — index, then cache (→ `caching`),
   then read replicas, then federation, then shard. Stop at the first level that
   meets the target.
5. **Stress-test the choice** — walk hot shard, replication lag, connection
   exhaustion, and resharding (see *Behavior under stress*); confirm a skewed key
   or write burst does not melt one node.
6. **Size it, then pick a provider** — compute shard count and per-node load from
   `back-of-the-envelope`; if it is one node, do not shard. Default to the generic
   recipe and read the provider file only when a cloud is named.

## Dos and don'ts
**Do**
- Start from the queries: model the store around its access paths, and write a
  concrete key before drawing any box.
- Default to a single well-indexed relational node and exhaust index + cache +
  replicas before sharding.
- Choose a shard key with high cardinality and even distribution; isolate or
  sub-partition known hot keys.
- Put a bounded connection pooler in front of the database and alert on
  replication lag and per-shard skew.
- Compute shard count from peak write QPS and dataset size, taking the larger.

**Don't**
- Don't reach for NoSQL, replicas, or shards before a number forces it (YAGNI).
- Don't pick a store on hype before the data shape and consistency need are known.
- Don't assume replicas give fresh reads — replication lag serves stale data and
  failover can lose recent writes.
- Don't shard on a low-cardinality or monotonically increasing key; it creates hot
  shards and write hotspots.
- Don't reshard a cluster that is already overloaded; plan capacity ahead of the
  cliff.

## Numbers that matter
Don't restate the tables — pull the figures from `back-of-the-envelope`. The ones
that drive storage decisions: a single RDBMS node ≈ **1k QPS**; a key-value node
≈ **10k QPS**; **10 GB fits in RAM, 10 TB needs distributed storage**. Use these
to compute **shard count = peak write QPS ÷ per-node QPS** (and again by size =
total bytes ÷ per-node capacity), then take the larger. If the result is one
node, do not shard.

## Interface sketch
The data model *is* the contract (GUIDE failure mode #8) — a "NoSQL box" decides
nothing until the key is written. Pin down per entity:

- **Primary key** — what uniquely identifies a row/item and how it's looked up.
- **Partition (shard) key + sort key** — e.g. wide-column/DynamoDB:
  `PK = user_id` (hash, spreads load), `SK = created_at` (sort, enables range
  scans like "latest N posts"). The PK must be high-cardinality and even.
- **Secondary indexes** — the non-key access paths that must be supported, each
  with its query.
- **Relational** — tables, columns with types, foreign keys, and the indexes that
  back each query; note what is intentionally denormalized.

Without a concrete key and the query it serves, the rest of the design is
guesswork.

## Choosing a provider
Default to the generic recipe above. If the user names a cloud, read
`references/providers/<provider>.md` for the managed-service mapping,
quotas/limits, and provider-specific trade-offs. If no file exists for that
provider, the generic recipe is the answer.

## Diagram
To visualize the data tier — leader with read replicas, a sharded cluster with a
router, or a polyglot split — use the in-plugin `architecture-diagram` skill.
Draw the shard key on the routing arrow and the replication direction explicitly;
do not embed Mermaid here.

## Related building blocks
- `caching` — *pairs with* this for read offload and is the cheap first move;
  *alternative to* read replicas before sharding.
- `consistency-coordination` — *owned-concept lives in* it: CAP/consistency models,
  consistent hashing, quorum, and distributed transactions/saga. *Pairs with* this
  when stale reads or cross-shard atomicity are unacceptable.
- `back-of-the-envelope` — *feeds into* this: supplies the QPS, storage, and
  shard-count numbers that force (or rule out) each move here.
- `scaling-evolution` — *depends on* this block; sequences when each storage move
  is introduced as a system grows.
- `system-design` — the orchestrator that *routes into* this block.

## References
- **`references/deep-dive.md`** — partitioning schemes (range/hash/directory),
  replication mechanics and conflict resolution, index internals (B-tree vs LSM),
  normalization vs denormalization, connection pooling, resharding. Read when
  designing the data tier in detail.
- **`references/providers/{generic,aws,azure,gcp}.md`** — service mappings, the
  limits that change a decision, and per-environment pitfalls.
