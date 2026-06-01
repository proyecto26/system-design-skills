# Distributed search — Azure

## Service mapping
- **Azure AI Search** (formerly Cognitive Search) — managed search service:
  inverted-index full-text (BM25), facets, suggesters/autocomplete, indexers that
  pull from data sources (Blob, Cosmos DB, SQL), and optional vector/semantic
  ranking. The default managed search on Azure; it abstracts shards behind
  *replicas* (query throughput/HA) and *partitions* (index size/capacity).
- **Self-managed OpenSearch/Elasticsearch on VMs/AKS** — when you need full
  engine control or portability; then the generic recipe applies.

## When to pick which
AI Search when you want a managed, batteries-included search with built-in
indexers and suggesters and don't want to operate a cluster; self-managed
OpenSearch when you need low-level shard/analyzer control or cross-cloud
portability.

## Limits / things that bite (verify against current docs)
- Capacity is set by **replicas × partitions** (search units); both are bounded
  per tier and the tier caps total index size and doc count — pick the tier from
  your corpus bytes, and re-tiering can mean a rebuild.
- Indexers (the pull pipeline) have batch-size and run-frequency limits; large or
  fast-changing corpora can lag — monitor indexer freshness.
- Per-tier caps on indexes, fields, and queries-per-second.

## Pitfalls
- Under-provisioning partitions for a growing corpus, then hitting a tier change.
- Relying solely on built-in indexers for near-real-time freshness without a
  push path / durable buffer in front (→ `messaging-streaming`).
- Treating it as a primary store rather than a reindexable derived copy.
- Lock-in: skillsets, indexers, and semantic ranking configs are Azure-specific.
