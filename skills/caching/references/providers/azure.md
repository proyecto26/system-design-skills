# Caching — Azure

## Service mapping
- **Azure Cache for Redis** — managed Redis; tiers: Basic (single node, no SLA),
  Standard (two-node replicated), Premium (clustering, persistence, VNet,
  zone redundancy), Enterprise / Enterprise Flash (Redis Enterprise: active
  geo-replication, RediSearch/modules, NVMe flash for larger-than-RAM sets).
- **Azure Front Door / CDN** — edge caching for static/media (→ `content-delivery`).

## When to pick which
Standard for basic HA; Premium for clustering + persistence + VNet isolation;
Enterprise for active-active geo-replication or Redis modules; Enterprise Flash
when the dataset is large and cost/GB matters more than pure RAM speed.

## Limits / things that bite (verify against current docs)
- Clustering and persistence are **Premium+ only** — the cheaper tiers are a
  single logical node.
- Scaling tiers/clusters can require a failover or a brief data flush; plan for it.
- Per-tier caps on connections, bandwidth, and memory — a hot key still saturates
  one shard.
- Geo-replication semantics differ between Premium (passive) and Enterprise
  (active) — know which consistency you're getting.

## Pitfalls
- Choosing Basic/Standard then discovering clustering needs a tier jump (migration).
- Assuming persistence exists below Premium.
- Lock-in via Enterprise modules (RediSearch etc.) that aren't in open-source Redis.
