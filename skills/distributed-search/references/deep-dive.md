# Distributed search deep-dive

Mechanics that don't belong in the lean SKILL.md. Read when designing the search
layer in detail.

## The inverted index

A forward index maps `doc → terms`. Search needs the inverse: `term → list of
docs containing it`. That mapping is the **inverted index**, and it is why search
is fast where `LIKE '%x%'` is slow — the engine jumps straight to the docs for a
term instead of scanning every row.

For each term, the engine stores a **posting list**: `(doc_id, term_frequency,
[positions])`, often plus field info. Positions enable phrase and proximity
queries ("wireless earbuds" as a phrase, not two loose words). A query for
`A AND B` intersects the posting lists for A and B; `A OR B` unions them.
Posting lists are kept sorted by doc_id and compressed (delta + variable-byte or
similar) so intersection is a fast merge and the index stays small.

**Analysis** builds the terms: an analyzer tokenizes text, lowercases, removes
stop words, and applies stemming (running → run) and synonyms. The *same*
analyzer must run at index time and query time, or terms won't match. Changing
the analyzer (new language, new synonyms) requires a **reindex** — it is a
schema change, not a config tweak.

## Segments and near-real-time

Lucene-family engines write immutable **segments**. A new/changed doc goes to an
in-memory buffer; a **refresh** flushes it into a new searchable segment (this is
what makes a doc visible — refresh interval is the freshness vs cost knob).
Deletes are tombstones; the old doc is filtered out until merge removes it.

Many small segments slow queries (each is searched), so a background **merge**
combines them into fewer larger ones. Merges are I/O- and CPU-heavy and compete
with live queries — the root of indexing/query contention. A **commit** fsyncs
segments durably (paired with a translog/WAL so un-committed writes survive a
crash). Tuning: longer refresh interval = fewer segments and cheaper writes but
staler reads; throttle merges and bulk indexing to protect query latency.

## The crawl / index / search pipeline

For a corpus you own (products, documents), the pipeline is: source change →
durable change stream → indexer (analyze + build docs) → bulk write to shards.
Run it through a durable buffer so a write surge can't outrun the indexer or drop
changes (→ `messaging-streaming`).

For **web search**, prepend a crawler. The crawl front end is its own subsystem:
a **URL frontier** (a prioritized, politeness-aware FIFO set of URLs to fetch),
HTML downloaders, a DNS-resolution cache, content parsing, and **dedup** — both
"URL seen?" (a Bloom filter / hash set so the same URL isn't queued twice) and
"content seen?" (hash/checksum the page body; ~30% of the web is duplicate
content). Politeness (one request at a time per host, robots.txt) and freshness
(recrawl important/changed pages more often) shape the frontier. Distribute
crawlers by partitioning the URL space (consistent hashing across downloaders —
theory in `consistency-coordination`). The crawler outputs parsed documents into
the same index pipeline above.

## Relevance ranking (TF-IDF / BM25)

Ranking answers "which matching docs are *best*". The lexical baseline:

- **TF (term frequency):** a doc mentioning the term more is more relevant — but
  with diminishing returns.
- **IDF (inverse document frequency):** rare terms discriminate more than common
  ones ("the" is worthless; "tachyon" is decisive).
- **BM25** combines them with two knobs: term-frequency **saturation** (extra
  occurrences matter less and less) and **length normalization** (a hit in a
  short title beats one buried in a long body). It is the modern default —
  cheap, explainable, no training data needed.

**Hybrid ranking** layers business/user signals on top of BM25: popularity,
recency, click-through, per-field boosts (title^2), or a learned re-ranker over
the top-N. Add these only when word-overlap demonstrably misses intent — each
signal is another thing to tune and debug. (Semantic/vector retrieval is a
further step; treat it as a separate retrieval path blended with BM25, not a
replacement, unless requirements demand it.)

## Autocomplete (typeahead)

Two approaches, picked by whether suggestions must respect filters/relevance:

- **Prefix trie / FST (finite-state transducer):** an in-memory structure mapping
  prefixes to completions, often weighted by popularity for **top-k** ranking.
  Sub-millisecond, but it's a separate structure to build and refresh, and it
  ignores live filters. Best for a global suggestion box.
- **Edge-n-gram index:** index prefixes as terms ("ear", "earb", "earbu"...) in
  the main index so typeahead is a normal query that can honor filters and
  relevance. Costs index size and write overhead.

Top-k suggestions are usually precomputed/weighted by query logs (most-searched
prefixes win), with personalization layered on if needed.

## Sharding and replication

- **Shards** partition the corpus; each shard is a complete inverted index over
  its doc subset. A document is routed to a shard by `hash(routing_key) %
  num_shards` (default routing key = doc id). Shard count is effectively fixed at
  index creation — to change it you reindex — so size it from corpus bytes ÷
  target shard size up front. Aim for even, healthily-sized shards: too few caps
  parallelism, too many add fan-out and merge overhead. Partitioning theory lives
  in `data-storage`.
- **Replicas** are copies of a shard for read throughput and fault tolerance. A
  query can be served by any copy; writes go to the primary and replicate.
  Replicas raise read QPS and survive a node loss, at the cost of RAM/disk and
  write amplification.

**Query execution** is **scatter-gather**: the coordinator fans the query to one
copy of every shard, each returns its top-N with scores, the coordinator merges
and re-sorts to the global top-N (often a second "fetch" round pulls the full
docs). Tail latency is set by the slowest shard — the core fan-out hazard.

## Common mistakes

- Using search as the system of record (it's a derived, eventually-consistent
  copy — keep the source in `data-storage` and reindex from it).
- Mismatched index-time vs query-time analyzers → queries silently miss.
- Fixing shard count too low/high and discovering reindex is the only fix.
- Deep `from`/`size` pagination instead of `search_after`/cursor.
- Unthrottled bulk reindex against a live cluster → merge storm, query latency
  spike.
- Monitoring throughput but not indexing **lag** — freshness regressions are
  invisible until users complain.
