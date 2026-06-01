# Distributed search — AWS

## Service mapping
- **Amazon OpenSearch Service** — managed OpenSearch/Elasticsearch; provisioned
  domains (you size data/master nodes, shards, replicas) — the default managed
  full-text engine on AWS.
- **OpenSearch Serverless** — auto-scaling capacity in "collections" (search /
  time-series / vector); removes node sizing at a price premium and with less
  low-level tuning control.
- **OpenSearch Ingestion** — managed pipeline (collect/transform → index); pairs
  with the indexing pipeline. A durable buffer (e.g. Kinesis/MSK) still belongs
  in front (→ `messaging-streaming`).
- **CloudSearch** — older managed search; prefer OpenSearch for new designs.

## When to pick which
Provisioned domains when you want control over shard/replica sizing and steady
cost; Serverless when load is spiky and you don't want to size nodes; Ingestion
when you want managed transform-and-load rather than running your own indexer.

## Limits / things that bite (verify against current docs)
- Provisioned domains need master nodes for stability at scale; under-sizing
  master/data nodes causes cluster instability under load.
- Storage, shard-per-node, and field-count limits per instance type — a hot or
  oversized shard still saturates one node and drags fan-out latency.
- Serverless OCU (compute unit) billing can surprise at steady high load; it
  isn't automatically cheaper than a right-sized provisioned domain.
- Version upgrades and blue/green domain changes can be disruptive — plan them.

## Pitfalls
- Assuming Serverless removes all tuning — you lose some shard/analyzer control.
- Skipping dedicated master nodes on a production provisioned domain.
- Treating the domain as a source of truth instead of a reindexable derived copy.
- Lock-in: OpenSearch APIs are portable, but Serverless collections and
  Ingestion configs don't port directly to other clouds.
