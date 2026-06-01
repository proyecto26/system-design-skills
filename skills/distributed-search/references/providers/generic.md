# Distributed search — generic / self-hosted

The vendor-neutral default. When no cloud is named, this is the answer.

## What to run
- **Elasticsearch / OpenSearch** — distributed search engines over Lucene; REST
  API, JSON docs, sharding + replication, near-real-time refresh, aggregations
  (facets), BM25 by default. The default full-text choice. OpenSearch is the
  Apache-2.0 fork; pick on licensing/feature needs.
- **Apache Lucene** — the underlying library (inverted index, segments, BM25).
  Embed it directly only when you want a single-node, in-process index and no
  cluster operations.
- **Apache Solr** — also Lucene-based; mature faceting and config-driven schemas.
  A reasonable alternative to Elasticsearch for classic enterprise search.

Map the SKILL's options: build mode = refresh interval + bulk vs streaming
indexing; ranking = default BM25, add function-score/boosts for hybrid;
autocomplete = completion suggester (FST) or edge-n-gram field; distribution =
shard count at index creation + replica count per shard.

## Topology
- Single node for small corpora / dev.
- Multi-node cluster with dedicated roles for scale: master-eligible (cluster
  state), data nodes (shards), and coordinating nodes (fan-out/merge). Isolate
  indexing-heavy and query-heavy load onto separate node pools when they contend.
- Shards per index fixed at creation; replicas adjustable. Size shards from
  corpus bytes up front (reindex to change shard count).

## Limits / things that bite (verify against current docs)
- Shard count is effectively immutable post-creation — under/over-sharding both
  hurt; plan from index bytes ÷ target shard size.
- JVM heap pressure and large GC pauses on a data node spike query tail latency
  across every fan-out query.
- Deep `from`/`size` pagination is expensive cluster-wide; use `search_after` /
  scroll / point-in-time cursors.
- Refresh interval trades freshness for write cost; merges contend with queries.

## Pitfalls
- Treating it as a primary store — no transactions; it's a derived, rebuildable
  index. Keep the source of truth elsewhere and own a full-reindex path.
- Mismatched index-time vs query-time analyzers → silent zero-result queries.
- Running unthrottled bulk reindex against a live cluster (merge storm).
- No durable buffer in front of the indexer, so a write surge stalls or drops.
- You operate it: capacity, upgrades, snapshots, security (TLS/auth) are on you.
