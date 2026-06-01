# Distributed logging — Azure

## Service mapping (generic stage → Azure)
- **Collect:** Azure Monitor Agent (AMA) on VMs/VMSS; for AKS, Container Insights or a
  Fluent Bit DaemonSet. Apps/services emit diagnostic logs to **Azure Monitor**.
- **Buffer / transport:** **Event Hubs** as the durable log bus (Kafka-protocol
  compatible). Diagnostic settings can stream resource logs to Event Hubs for fan-out.
- **Index / search:** **Azure Monitor Logs / Log Analytics workspace**, queried with
  **KQL** (Kusto Query Language) — the managed hot search/index tier.
- **Cold archive:** **Azure Blob Storage** via diagnostic settings or Event Hubs
  capture, with lifecycle tiering to Cool/Archive (→ `blob-store`).

Common recipe: agents/resources → diagnostic settings → Log Analytics (hot, KQL) and/or
Event Hubs → Blob Storage (cold) for cheap long retention.

## Limits / things that bite (verify against current docs)
- **Log Analytics ingestion** is billed per GB ingested and per GB retained; the
  default retention window is limited and longer retention costs more — set it per
  table.
- **Table plans:** an Analytics tier for interactive KQL vs. a cheaper Basic/Auxiliary
  tier for high-volume logs you rarely query interactively — choosing wrong is a
  cost/queryability trap.
- **Event Hubs** throughput is sized in throughput units / processing units; partition
  count is fixed at creation and caps consumer parallelism; ordering is per-partition.
- Ingestion has per-workspace rate caps that throttle during spikes.

## Provider trade-offs
- Log Analytics + KQL is powerful and tightly integrated with Azure Monitor metrics
  and alerts (the *alerting/SLO* side is `observability`), but ingest cost scales with
  volume — sample and tier.
- Basic/Auxiliary tables are far cheaper for verbose logs but restrict query features
  and retention; route high-value logs to Analytics, bulk logs to the cheap tier or
  straight to Blob.
- Lock-in: KQL queries, diagnostic-setting routing, and workspace structure don't port.

## Pitfalls
- Sending all verbose logs to the Analytics tier (expensive) instead of the Basic tier
  or Blob archive.
- Leaving default retention and ingesting unsampled debug floods → bill shock.
- Assuming Event Hubs preserves global order — it's per-partition only.
