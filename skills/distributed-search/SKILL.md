---
name: distributed-search
description: This skill should be used when the user designs a "search system", needs "full-text search", asks about an "inverted index", "Elasticsearch / OpenSearch", "relevance ranking" (TF-IDF/BM25), "search autocomplete / typeahead", an "indexing pipeline", or "faceted search". It gives the crawl/index/search architecture, index sharding and replication, ranking, and near-real-time indexing. Use it whenever users must query text by relevance rather than fetch rows by key, even if they don't say "search engine".
---

# Distributed search

Find the documents that best match a free-text query, ranked by relevance, fast,
across more data than one machine holds. Getting it wrong means either slow
`LIKE '%term%'` scans that melt the primary database, or a search box that
returns the wrong results and erodes user trust — both are silent until traffic
or corpus size exposes them.

## When to reach for this
Users type words and expect ranked, relevant matches — not exact-key lookups.
The corpus is text-heavy (documents, products, logs, messages), queries are
ad-hoc (any term, any combination), and results need ranking, highlighting,
facets, or typeahead. Reach for it when a `WHERE col LIKE` or full-table scan is
already the read bottleneck, or when you need fuzzy/partial matching a B-tree
index cannot serve.

## When NOT to
The access pattern is fetch-by-known-key or a fixed filter — a primary database
index serves that far more cheaply and consistently; keep it in `data-storage`.
The corpus is tiny (thousands of rows): an in-process filter or the database's
built-in full-text index is enough — a separate search cluster is pure
operational overhead (YAGNI). Search is a *derived, eventually-consistent* copy
of your data; never make it the system of record.

## Clarify first
- **Corpus size and growth** — document count, average doc size, total index
  bytes? (→ `back-of-the-envelope`) This decides shard count.
- **Query QPS and shape** — read-heavy? term queries, phrase, fuzzy, facets,
  autocomplete? Latency target (p99)?
- **Indexing freshness** — must a new/edited doc be searchable in seconds
  (near-real-time) or is minutes/hours of lag fine?
- **Relevance bar** — is exact term-match enough, or do users expect "best"
  results (ranking, synonyms, typo tolerance)?
- **Write rate** — how many docs/sec change? This sizes the indexing pipeline.

## The options

**The pipeline** (almost always present): a source emits document changes →
an **indexing pipeline** transforms/analyzes them → the **inverted index** stores
term→document postings → the **query path** matches and ranks. For a crawl-based
system (web search), prepend crawl → parse → dedupe; that crawler is its own
subsystem feeding the same pipeline.

**Index build mode**
- **Batch / bulk reindex:** rebuild the whole index periodically. Use when the
  corpus changes slowly or freshness in hours is acceptable.
- **Near-real-time (incremental):** apply changes continuously so docs are
  searchable in seconds. Use when users expect to find what they just wrote.

**Ranking model**
- **Boolean / filter only:** match, no scoring. Use for exact filtering (tags,
  facets) where order doesn't matter.
- **TF-IDF / BM25 (lexical):** score by term frequency and rarity. The default
  full-text relevance model; cheap and explainable.
- **Hybrid (lexical + signals):** blend BM25 with popularity, recency, or
  business boosts. Use when "best" means more than word overlap.

**Autocomplete**
- **Prefix trie / FST in memory:** sub-millisecond typeahead from a prefix. Use
  for suggestion-as-you-type.
- **Edge-n-gram index:** prefix matching inside the main index. Use when
  suggestions must also respect filters/relevance, at higher cost.

**Distribution**: split the index into **shards** (each a self-contained
inverted index over a doc subset) for capacity, and **replicas** per shard for
read throughput and fault tolerance. Sharding theory lives in `data-storage`.

## Trade-offs

| Option | What it solves | What it worsens | Change it when |
|---|---|---|---|
| Batch reindex | Simple, atomic swap, no live-write complexity | Stale until next build; full rebuild is costly | Users need fresh results → near-real-time |
| Near-real-time | Seconds-fresh; no full rebuild | Segment churn, merge load, refresh cost on writes | Write rate or merge cost overwhelms nodes → batch/larger refresh interval |
| Boolean/filter | Cheapest; deterministic | No notion of "best" result | Users judge result quality → add BM25 |
| BM25 | Good relevance, explainable, cheap | Ignores popularity/recency/intent | Word-overlap isn't enough → hybrid signals |
| Hybrid signals | Matches business/user intent | Complex, harder to debug, needs tuning data | Tuning cost exceeds value → fall back to BM25 |
| Prefix trie/FST | Fastest typeahead | Separate structure to build/refresh; ignores filters | Suggestions need filters/relevance → edge-n-gram |
| More shards | Parallelism, fits big corpus | Per-query fan-out + merge overhead; tiny shards waste resources | Fan-out latency dominates → fewer, larger shards |
| More replicas | Read QPS + HA | More RAM/disk; replication lag on writes | Write amplification hurts → fewer replicas |

## Behavior under stress
Search amplifies trouble through **fan-out** and **derived-data lag**.

- **Query fan-out tail latency:** every query hits all shards; the slowest shard
  sets the response time. One hot or GC-paused shard drags every query.
  *Mitigate:* size shards evenly, add replicas, cap result depth, use timeouts +
  partial results.
- **Indexing vs query contention:** a write/merge surge (bulk import, reindex)
  steals CPU and I/O from queries, spiking latency. *Mitigate:* throttle bulk
  indexing, schedule big merges off-peak, isolate index vs query node roles.
- **Hot shard / skew:** an uneven shard key concentrates docs or popular terms on
  one node. *Mitigate:* hash-route documents; reroute or split the hot shard.
- **Deep pagination:** `from=100000` forces every shard to sort huge windows.
  *Mitigate:* cursor/`search_after`, cap page depth.
- **Pipeline backlog:** if the source produces changes faster than the indexer
  consumes, freshness lag grows unbounded. *Mitigate:* backpressure and a durable
  buffer (→ `messaging-streaming`); monitor lag, not just throughput.
- **Cold cache after restart:** filesystem/page cache is empty, so latency spikes
  until it warms. *Mitigate:* warm critical queries; ramp traffic.

**Monitor:** per-shard p99 query latency, indexing lag (source→searchable),
segment/merge count, heap/GC, shard balance, and rejected/queued requests.

## How to apply
1. **Clarify the inputs** — pin corpus size, query QPS and shape, freshness
   target, and the relevance bar (see *Clarify first*). If a DB index or built-in
   full-text serves the access pattern, stop — you don't need a search cluster.
2. **Pick from the trade-off table** — choose a build mode (freshness), a ranking
   model (relevance bar), and whether autocomplete needs its own structure.
3. **Set the key knobs** — shard count (from index bytes ÷ target shard size),
   replica count (from read QPS + HA), the analyzer/tokenizer (language, stemming,
   synonyms), and the refresh interval (freshness vs write cost).
4. **Stress-test the choice** — walk *Behavior under stress* (fan-out tail,
   indexing contention, hot shard, deep pagination, pipeline backlog) and confirm
   a mitigation for each one the traffic profile can trigger.
5. **Size it with numbers** — confirm shards fit the corpus and per-shard size
   stays in a healthy range, replicas cover peak QPS, and indexing throughput
   keeps lag inside the freshness budget (→ *Numbers that matter*).
6. **Pick a provider** — default to the generic recipe; open a provider file only
   if the user named a cloud (see *Choosing a provider*).

## Dos and don'ts
**Do**
- Treat the index as a derived, rebuildable copy — keep the system of record in
  `data-storage` and be able to fully reindex from it.
- Size shards before launch (corpus ÷ target shard size); aim for even, not tiny,
  shards to bound fan-out cost.
- Feed the indexing pipeline through a durable buffer so a write surge can't
  outrun the indexer or lose changes.
- Start ranking with BM25; add popularity/recency signals only when word-overlap
  demonstrably misses intent.
- Monitor indexing lag separately from query latency — freshness fails silently.

**Don't**
- Don't use a search engine as your primary store or for transactional writes.
- Don't reach for a separate cluster when a DB full-text index or in-process
  filter covers a small corpus (YAGNI).
- Don't allow deep `from`/`offset` pagination; use cursors instead.
- Don't over-shard — many tiny shards add fan-out and merge overhead without
  benefit.
- Don't run heavy bulk reindex unthrottled against a cluster serving live queries.

## Numbers that matter
The quantities that drive the design: total index bytes (corpus × per-doc
overhead, then ÷ target shard size to get shard count), read QPS × fan-out (each
query touches every shard) for replica sizing, and indexing throughput vs change
rate to keep freshness lag inside budget. A single shard performs well within a
bounded size range; past it, split. Use `back-of-the-envelope` for the latency,
QPS, and storage figures — don't restate them here.

## Interface sketch
The contracts are the document, the query, and the postings. A **document** is a
typed record with analyzed fields, e.g. `{ "id": "p123", "title": "...",
"body": "...", "tags": ["a","b"], "price": 9.99 }`. A **query** names fields,
match type, filters, sort, and pagination cursor, e.g. `q="wireless earbuds",
fields=[title^2, body], filter={tag:audio}, sort=_score, search_after=<cursor>`.
The **inverted index** maps each term → posting list of `(doc_id, term_freq,
positions)`; ranking reads these to compute BM25. Decide the analyzer
(tokenizer, lowercasing, stemming, synonyms) up front — it is part of the
contract and changing it requires a reindex.

## Choosing a provider
Default to the generic recipe above (Elasticsearch/OpenSearch, Lucene, Solr,
self-hosted). If the user names a cloud, read
`references/providers/<provider>.md` for the managed-service mapping,
quotas/limits, and provider-specific trade-offs. If no file exists for that
provider, the generic recipe is the answer.

## Diagram
To visualize the source → indexing pipeline → inverted index (sharded +
replicated) → query/rank path, or the crawl→parse→dedupe front end, use the
in-plugin `architecture-diagram` skill — show the indexing path and the query
fan-out as distinct flows, with replicas behind each shard.

## Related building blocks
- `data-storage` — *alternative to* a DB `LIKE`/full-table scan for text search;
  search owns the inverted index, while sharding/partitioning and replication
  theory live there — name and link, don't re-teach.
- `messaging-streaming` — *depends on* this for the index-update pipeline: a
  durable buffer carries document changes to the indexer and absorbs write
  surges (delivery, ordering, backpressure are owned there).
- `caching` — *pairs with* this to cache hot/repeated queries and reduce fan-out
  load (stampede, hot-key, eviction handling owned there).
- `back-of-the-envelope` — *feeds into* this skill: corpus bytes, QPS, and
  freshness numbers size the shards, replicas, and pipeline.
- `system-design` — *owned-concept lives in* the orchestrator: the reasoning
  loop, the trade-off method, and the ten failure modes.

## References
- **`references/deep-dive.md`** — inverted-index internals (postings, segments,
  merges), the crawl/index/search pipeline, BM25 scoring, near-real-time refresh,
  autocomplete (trie/FST/n-gram), shard routing and replica reads. Read when
  designing the search layer in detail.
- **`references/providers/{generic,aws,azure,gcp}.md`** — service mappings,
  limits, and pitfalls per environment.
