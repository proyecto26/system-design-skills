---
name: blob-store
description: This skill should be used when the user wants a "blob store" or "object storage", names "S3" or an S3-compatible store, needs to "store images / video / files", asks about "multipart upload" or "resumable upload", "signed / presigned URLs", "media storage", "unstructured data at scale", object "versioning", storage "tiering" (hot/cold/archive), or "erasure coding" vs replication for durability. Use it whenever a design must hold large unstructured objects (photos, video, backups, logs, ML datasets) and serve them cheaply and durably, even if the user just says "where do we put the files".
---

# Blob store

Store large, immutable, unstructured objects — images, video, backups, model
weights, document blobs — in a flat namespace keyed by a string, replicated for
durability and served by direct download. Getting it wrong means stuffing
multi-megabyte blobs into a row-oriented database (where they bloat the working
set, wreck cache locality, and cap throughput) or hand-rolling a file server that
loses data on the first disk failure.

## When to reach for this
Objects are large (KB to GB), written once and read many times, and you only ever
fetch them whole by key — never query *inside* them. Photo/video stores, user
uploads, backups, data-lake/ML datasets, static-site assets, log archives. The
access pattern is `PUT key → GET key`, durability matters, and the total volume is
too large or too cold to sit in a primary database.

## When NOT to
Small structured records you query, filter, sort, or join — that is `data-storage`.
Data that needs transactions, secondary indexes, or partial updates (blobs are
replace-whole, not edit-in-place). Low-latency reads of tiny values (a KV cache or
`caching` wins). A few files on one box that never grow — the local filesystem is
fine; a blob store is operational overhead you do not need yet (YAGNI). Naming
"object storage" for a workload that is really a database is failure mode #2.

## Clarify first
- **Object size distribution** — average and p99 size? (Decides chunking, multipart
  thresholds, and whether reads stream or buffer.) → `back-of-the-envelope`.
- **Read:write ratio and access recency** — write-once/read-many? How fast does data
  go cold? (Drives tiering and CDN fronting.)
- **Durability and availability target** — how many nines of durability? Can a read
  briefly fail or must it always succeed? (Replication vs erasure coding, multi-region.)
- **Access control** — public, private, or time-limited per-object grants? (Signed URLs.)
- **Mutability and history** — do objects change? Must old versions be retained
  (compliance, undo)? (Versioning + lifecycle.)
- **Egress profile** — who reads, from where, how often? (CDN offload, egress cost.)

## The options
**Durability scheme** (how many copies, what shape)
- **N-way replication** — store N full copies on different nodes/racks/AZs. Use when
  objects are small, hot, and latency matters; simplest to reason about.
- **Erasure coding (EC)** — split an object into *k* data + *m* parity shards; any *k*
  reconstruct it. Use for large/cold data at scale — same durability as replication
  at ~1.4x overhead instead of 3x. (Mechanics in `references/deep-dive.md`.)

**Storage tier** (price/latency/retrieval trade)
- **Hot/standard** — millisecond reads, highest $/GB. Use for actively served objects.
- **Cool/infrequent** — cheaper storage, retrieval fee/slightly higher latency. Use
  for backups and data read a few times a month.
- **Archive/cold** — cheapest storage, minutes-to-hours retrieval. Use for compliance
  retention and rarely-touched data; never for anything on a request path.

**Upload path**
- **Single PUT** — one request. Use for small objects (under the multipart threshold).
- **Multipart / resumable** — split into parts, upload in parallel, retry per-part,
  commit on completion. Use for large objects and flaky networks; the default above
  the threshold.

**Mutation model**
- **Immutable + versioning** — each write is a new version; deletes are tombstones.
  Use when history, undo, or accidental-overwrite protection matters.
- **Overwrite-in-place (last-writer-wins)** — simplest; no history. Use when only the
  latest object matters and storage of old copies is waste.

## Trade-offs

| Option | What it solves | What it worsens | Change it when |
|---|---|---|---|
| N-way replication | Simple, fast reads, fast rebuild | 3x+ storage cost | Data is large/cold and cost dominates → erasure coding |
| Erasure coding | Same durability at ~1.4x storage | CPU + multi-node read on every fetch; slow small-object reads; costly rebuild | Objects are small/hot and latency matters → replication |
| Hot tier | Low-latency serving | Highest $/GB | Data goes cold and is rarely read → cool/archive |
| Archive tier | Cheapest at-rest storage | Minutes–hours to first byte; retrieval fees | Anything ends up on a latency-sensitive path → hot/cool |
| Multipart/resumable upload | Large files survive flaky links; parallel throughput | More client logic; orphaned parts cost money | Objects are small → single PUT |
| Versioning | Undo, history, overwrite protection | Storage grows silently; needs lifecycle expiry | Only latest matters → overwrite, last-writer-wins |
| Signed URLs | Offload transfer off your app; scoped access | Leaked/over-broad URLs; clock-skew expiry bugs | Content is fully public → CDN + public read |

## Behavior under stress
A blob store rarely "falls over" the way a database does, but it amplifies trouble in
specific ways.

- **Hot object / hot prefix:** a viral file or a key scheme where many writes share a
  prefix concentrates load on one partition. *Mitigate:* front hot reads with a CDN
  (`content-delivery`), randomize/hash key prefixes, replicate the hot object.
- **Metadata-index bottleneck:** the index that maps key → shard locations is the real
  SPOF and the throughput ceiling (millions of tiny objects hurt far more than a few
  huge ones). *Mitigate:* shard the index, cache hot lookups, prefer fewer-larger objects.
- **Thundering herd on cold-tier promotion:** a burst of reads for archived data
  triggers slow, expensive bulk retrievals. *Mitigate:* expose retrieval as async, queue
  it (`messaging-streaming`), set expectations on latency.
- **Orphaned multipart uploads:** aborted uploads leave parts that silently accrue cost.
  *Mitigate:* lifecycle rule to abort incomplete uploads after N days.
- **Egress storm / cost blow-up:** a popular object served directly from origin saturates
  bandwidth and runs up egress bills. *Mitigate:* CDN in front; the origin should serve
  cache fills, not end users.
- **Partial failure during write:** a node dies mid-write. *Mitigate:* write is not
  acknowledged until the durability quorum (replicas or EC shards) is met; background
  repair re-replicates under-durable objects.

**Monitor:** request rate and error rate per operation (PUT/GET/DELETE), p99 first-byte
latency, durability/repair queue depth, per-prefix hotness, incomplete-multipart count,
and egress volume + cost.

## How to apply
1. **Clarify the inputs** — pin object size distribution, read:write ratio, durability
   target, access control, and egress profile (see *Clarify first*). If the data is
   really small structured records you query, stop — use `data-storage`.
2. **Pick from the trade-off table** — choose a durability scheme (replication for
   small/hot, erasure coding for large/cold), a default tier, an upload path keyed to
   size, and a mutation model keyed to whether history matters.
3. **Set the key knobs** — design the key/prefix scheme to avoid hotspots, set the
   multipart threshold and part size, define lifecycle rules (tier transitions, version
   expiry, abort-incomplete-uploads), and decide signed-URL TTLs.
4. **Stress-test the choice** — walk each item in *Behavior under stress* (hot object,
   metadata bottleneck, cold-retrieval herd, orphaned parts, egress storm) and confirm a
   mitigation exists for the ones this traffic can trigger.
5. **Size it with numbers** — total storage with replication/EC overhead, object count
   (metadata-index load), peak PUT/GET QPS, and monthly egress. → *Numbers that matter*.
6. **Pick a provider** — default to the generic recipe; open a provider file only if the
   user named a cloud (see *Choosing a provider*).

## Dos and don'ts
**Do**
- Keep the blob in the store and a *pointer* (key + metadata) in the database — never the
  bytes in a row.
- Treat objects as immutable; version instead of editing in place when history matters.
- Front public/hot reads with a CDN so the origin serves fills, not end users.
- Use multipart/resumable upload above the size threshold, and abort incomplete uploads via lifecycle.
- Design key prefixes to spread load; hash or shuffle high-cardinality prefixes.
- Set lifecycle rules to move cold data down tiers and expire old versions automatically.

**Don't**
- Don't store large blobs in a relational/NoSQL row — it wrecks the working set and throughput.
- Don't put archive tiers on a read path; minutes-to-hours retrieval will time out requests.
- Don't serve a popular object directly from origin without a CDN (egress blowup).
- Don't hand out broad or long-lived signed URLs; scope them tight and short.
- Don't assume erasure coding is free — it adds CPU, multi-node reads, and expensive rebuilds.
- Don't ignore millions-of-tiny-objects: the metadata index, not the disks, is the ceiling.

## Numbers that matter
The figures that drive the design: total stored bytes × durability overhead (replication
≈ 3x, erasure coding ≈ 1.3–1.5x), object *count* (the metadata index scales with count, not
size), peak upload/download QPS, and monthly egress (often the dominant cost). Object-store
durability targets are commonly quoted around eleven nines; treat that as a design goal set
by the durability scheme, not a given. For the actual storage/bandwidth/QPS arithmetic and
unit conversions, use `back-of-the-envelope` — do not restate its tables here.

## Interface sketch
The contract is small and key-addressed:
```
PUT    /{bucket}/{key}        body=bytes, headers: Content-Type, optional checksum
GET    /{bucket}/{key}        → bytes (supports Range for partial/streamed reads)
DELETE /{bucket}/{key}        → tombstone (new version if versioning on)
HEAD   /{bucket}/{key}        → metadata only (size, etag, version-id)
# multipart: Initiate → UploadPart×N (parallel, retryable) → Complete | Abort
# signed URL: presign(GET|PUT, key, expiry) → time-limited URL the client uses directly
```
The **key** is the whole index (e.g. `userId/2026/photo-uuid.jpg`); choose it for both
access pattern and prefix spread. The **etag/checksum** lets clients verify integrity and
do conditional requests. The database stores this key plus app metadata, not the bytes.

## Choosing a provider
Default to the generic recipe above. If the user names a cloud, read
`references/providers/<provider>.md` for the managed-service mapping, quotas/limits, and
provider-specific trade-offs. If no file exists for that provider, the generic recipe is
the answer.

## Diagram
To visualize the upload/download path (client → signed URL → store; CDN fronting GET; index
mapping key → shards) or the EC write fan-out, use the in-plugin `architecture-diagram`
skill — show the metadata index as a distinct node and the CDN as the edge layer. Do not
embed Mermaid here.

## Related building blocks
- `content-delivery` — *pairs with* this: a CDN fronts the blob origin so repeat reads are
  served from the edge and the store handles only cache fills (edge caching is *owned* there).
- `data-storage` — *alternative to* this for large unstructured objects: store the blob here,
  keep a pointer (key + metadata) in the DB; sharding/indexing the metadata is *owned* there.
- `back-of-the-envelope` — *depends on* this for storage, object-count, QPS, and egress sizing
  (the numbers that pick replication vs EC and a tier live there).
- `messaging-streaming` — *pairs with* this to queue async work like cold-tier retrieval and
  post-upload processing (transcode, thumbnail); delivery guarantees are *owned* there.
- `caching` — *pairs with* this for hot small-object reads and metadata-lookup offload.
- `system-design` — *owned-concept lives in* the orchestrator: the reasoning loop, the
  trade-off method, and the ten failure modes.

## References
- **`references/deep-dive.md`** — chunking, the metadata index, erasure-coding math and read
  path, durability/repair, versioning + lifecycle, multipart internals, signed-URL mechanics.
  Read when designing the store in detail.
- **`references/providers/{generic,aws,azure,gcp}.md`** — service mappings, decision-changing
  limits, and pitfalls per environment.
