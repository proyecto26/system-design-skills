# Blob store — generic / self-hosted

The vendor-neutral default. If no cloud is named, this is the answer.

## Service mapping (generic recipe → open source)
- **S3-compatible object store** → **MinIO** (simplest, S3 API, erasure coding within a node
  set; the on-prem S3 default), **Ceph + RGW** (RADOS data plane, replication *or* EC pools,
  S3/Swift gateways; scales to exabytes, heavier to operate), **SeaweedFS** (optimized for
  *many small files* — packs them into volume files to keep the metadata index tiny).
- **Durability scheme** → replication or erasure-coded pools, configured per bucket/pool.
- **Tiering** → hot pool on SSD/NVMe, cold pool on HDD; lifecycle/transition policies move
  objects between pools.
- **CDN fronting** → any CDN or reverse-proxy cache in front (→ `content-delivery`).

## Decision-changing limits (verify against current docs)
- The **metadata/index node** is the scaling ceiling and the SPOF — replicate and shard it.
  Billions of tiny objects stress it long before disk capacity does; pick SeaweedFS or pack
  small objects if the count is huge.
- Erasure-coded reads gather *k* shards across nodes — sensitive to network and per-node
  count; keep EC for large/cold pools.
- Multipart part-size minimums and max-parts-per-upload exist (S3-compatible APIs commonly
  use a ~5 MB minimum part and a max part count); confirm for the chosen implementation.

## Trade-offs (self-host vs managed)
- You own placement, rebalancing, failure-domain layout, capacity planning, and upgrades —
  real operational weight, but no egress markup and no lock-in.
- S3-compatible APIs make migration to/from a cloud feasible, *if* you avoid provider-only
  features (lifecycle quirks, server-side encryption modes, event hooks).
- Capacity is provisioned, not elastic — you must plan headroom; a cloud absorbs spikes.

## Pitfalls
- Treating the index node as an afterthought — it is the first thing to fall over.
- Erasure-coding a hot small-object pool, then chasing tail latency.
- Skipping lifecycle/abort-incomplete rules — orphaned parts and old versions grow forever.
- Assuming "S3-compatible" means feature-complete; verify the specific API surface you rely on.
