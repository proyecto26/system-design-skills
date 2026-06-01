# Blob store deep-dive

Mechanics that don't belong in the lean SKILL.md. Read when designing the object
store in detail.

## Anatomy: data plane + metadata index

A blob store is two systems wearing one API:

- **Data plane** — the storage nodes that hold the actual bytes (as full replicas or
  erasure-coded shards) on disks/SSDs across racks/AZs.
- **Metadata index** — the key/value map from `bucket/key` → `{size, etag, version,
  shard/replica locations, tier, ACL}`. This is the brain and the bottleneck.

A GET is: look up the key in the index → resolve locations → stream bytes from the
data plane. The index is consulted on *every* request, so it must be fast, sharded,
and highly available. It scales with **object count**, not total bytes — ten billion
1 KB objects is a far harder index problem than ten thousand 1 GB objects, even though
the second holds more data. Prefer fewer, larger objects; pack tiny objects together
(tar/parquet/log segments) when you control the producer.

## Chunking

Large objects are stored as fixed-size **chunks** (commonly a few MB each):

- **Parallelism** — chunks upload/download/replicate in parallel.
- **Resumability** — a failed transfer retries only the affected chunks.
- **Dedup (optional)** — content-addressed chunks (hash as the chunk id) let identical
  data across objects share storage; great for backups/snapshots, costs a dedup index.
- **Range reads** — a GET with a byte range fetches only the chunks it needs (video
  seeking, partial reads) without pulling the whole object.

The object's metadata holds an ordered chunk manifest; the data plane stores chunks.

## Durability: replication vs erasure coding

**N-way replication.** Keep N identical copies on independent failure domains (different
disks, racks, AZs). A write is acknowledged when a quorum of copies is durable. Reads hit
any copy (fast, single-node). Rebuild after a disk loss is a straight copy. Cost: N× the
bytes (3× is typical for ~11 nines).

**Erasure coding (Reed–Solomon).** Split the object into *k* data shards, compute *m*
parity shards, store all *k+m* on independent domains. Any *k* of the *k+m* shards
reconstruct the object, so it tolerates *m* simultaneous losses.

- Storage overhead = `(k+m)/k`. E.g. (10,4) → 1.4× and survives 4 losses — far cheaper than
  3× replication for comparable durability.
- **Costs:** every read gathers *k* shards from *k* nodes (more network, higher tail latency,
  bad for small/hot objects); writes do parity math (CPU); a single lost shard rebuild reads
  *k* shards to regenerate one (expensive, amplifies on correlated failures).
- **Use it** for large, cold, throughput-oriented data; **replicate** small/hot/latency-
  sensitive data. Many stores replicate hot tiers and EC cold tiers.

**Background repair / anti-entropy.** Storage nodes continuously scrub (checksum) data and
re-replicate or re-encode objects that fall below their target redundancy after failures.
Watch repair-queue depth: a deep queue means under-durable objects are accumulating faster
than the system heals.

## Consistency model

Object stores historically offered read-after-write for new keys but only eventual
consistency for overwrites/deletes; most now provide strong read-after-write for PUT, GET,
and DELETE. Still, *listing* a bucket can lag a just-written object, and cross-region
replication is asynchronous (a region can serve a stale object after failover). Treat
objects as immutable and version them to sidestep overwrite-consistency entirely. CAP/
consistency-model theory lives in `consistency-coordination`.

## Versioning, tombstones, and lifecycle

- **Versioning on** → every PUT to an existing key creates a new immutable version; a DELETE
  writes a **tombstone** (delete marker) rather than erasing data, so deletes are
  recoverable. Reads return the latest non-tombstone version.
- **Lifecycle rules** automate the silent-growth problem: transition objects to cooler tiers
  after N days, expire non-current versions after M days, and **abort incomplete multipart
  uploads** after K days (orphaned parts cost real money). Without these, versioning and
  multipart both leak storage indefinitely.

## Multipart / resumable upload (the protocol)

1. **Initiate** → server returns an `uploadId`.
2. **UploadPart** for each part (typically ≥5 MB except the last), in parallel; each returns
   a part etag. Failed parts retry independently — the win for flaky networks.
3. **Complete** with the ordered list of part etags → server assembles and exposes the
   object atomically (it does not appear until completion).
4. **Abort** discards parts; lifecycle should also reap forgotten uploads.

Resumable-upload variants (e.g. session-URI style) let a client query how many bytes the
server already has and resume from there after a disconnect.

## Signed (presigned) URLs

The app holds the credentials; it signs a URL that grants a single client a scoped,
time-limited operation (GET or PUT a specific key) and hands it over. The client then
transfers bytes *directly* to/from the store, so large transfers never traverse the app
tier. Pitfalls: the signature encodes an expiry — clock skew or too-long TTLs widen the
leak window; a presigned PUT can let a client overwrite a key, so scope to exact key/method
and short expiry; signed URLs are bearer tokens, so anyone with the link has the access
until it expires.

## Key design and hot prefixes

The key *is* the index. Two forces:

- **Access pattern** — encode what you list/fetch by (`userId/album/photo-uuid`).
- **Prefix spread** — request routing/partitioning can key on the prefix, so monotonic or
  shared prefixes (a date prefix, a single hot user) concentrate load on one partition. Add
  a hash/shuffle to the high-order bytes of hot prefixes to spread them. Sharding/
  partitioning theory (incl. consistent hashing) is `data-storage` / `consistency-coordination`.

## Self-hosted internals (open source)

- **Ceph (RADOS)** — CRUSH algorithm maps objects to placement groups → OSDs without a central
  lookup; supports replication and EC pools; S3-compatible via RGW.
- **MinIO** — S3-compatible, simple, EC by default within a node set; good for on-prem S3.
- **SeaweedFS** — optimized for *many small files*: a master tracks volumes, files are packed
  into large volume files to keep the metadata footprint tiny (directly addresses the
  small-object index problem above).

## Common mistakes

- Storing bytes in the database instead of a pointer to the blob.
- One giant object instead of chunks (no parallelism, no resumability, no range reads).
- Erasure coding small/hot objects (latency and rebuild cost dominate).
- No lifecycle rules → versions and orphaned multipart parts grow storage without bound.
- Serving popular objects from origin without a CDN (egress cost + saturation).
- Long-lived, broadly-scoped signed URLs treated as if they were access-controlled.
- Ignoring object *count*: the metadata index, not raw disk, is the scaling ceiling.
