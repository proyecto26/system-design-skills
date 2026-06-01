# Distributed search — GCP

## Service mapping
- **Vertex AI Search** (formerly Enterprise Search / Discovery Engine) — managed,
  Google-quality search and recommendations over your data; handles indexing,
  ranking, and semantic/keyword retrieval with little tuning. Use when you want a
  high-quality search experience without operating an engine.
- **Self-managed OpenSearch/Elasticsearch on GCE/GKE** — when you need full
  engine control, custom analyzers/shard tuning, or cross-cloud portability; the
  generic recipe applies. (GCP has no managed Elasticsearch-API service of its
  own; Elastic Cloud on GCP is a third-party option.)
- **AlloyDB / Cloud SQL full-text** — built-in DB full-text for small corpora
  where a separate search system isn't warranted (→ `data-storage`).

## When to pick which
Vertex AI Search for a managed, relevance-strong experience with minimal ops and
built-in semantic ranking; self-managed OpenSearch when you need explicit
shard/replica/analyzer control or portability; DB full-text when the corpus is
small enough not to need a cluster (YAGNI).

## Limits / things that bite (verify against current docs)
- Vertex AI Search abstracts the index — you trade low-level shard/analyzer
  control for managed quality; verify it supports your filter/facet/freshness
  needs before committing.
- Quotas on data stores, documents, and QPS per project apply.
- Self-managed clusters carry the generic operational burden (heap, merges,
  shard sizing) plus regional/VPC placement affecting latency.

## Pitfalls
- Assuming a drop-in Elasticsearch-API managed service exists natively — it
  doesn't; either use Vertex AI Search's model or self-manage / Elastic Cloud.
- Adopting Vertex AI Search then needing custom analyzers/scoring it doesn't expose.
- Treating any of these as a source of truth rather than a reindexable derived copy.
- Lock-in: Vertex AI Search data stores and config don't port to other clouds.
