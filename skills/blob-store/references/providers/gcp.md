# Blob store — GCP

## Service mapping
- **Cloud Storage (GCS)** — the object store. Buckets + objects, strong global read-after-write,
  object versioning, resumable + multipart uploads, signed URLs, lifecycle (Object Lifecycle
  Management). The default.
- **Storage classes** (the tiering knob, set per-bucket default or per-object) — *Standard* (hot),
  *Nearline* (≈ once-a-month access), *Coldline* (≈ once-a-quarter), *Archive* (cheapest at rest,
  for rarely-read retention). **All classes have millisecond first-byte latency** — the colder
  classes differ by price, minimum storage duration, and retrieval cost, *not* by a rehydration
  wait. *Autoclass* moves objects between classes automatically by access.
- **Location type** (the durability/geo knob) — *regional* (single region), *dual-region*, or
  *multi-region* (geo-redundant); GCS handles intra-location durability internally.
- **Cloud CDN / Media CDN** — CDN in front of a GCS origin (→ `content-delivery`).

## When to pick which
Standard for served objects; Nearline/Coldline for backups by access frequency; Archive for
long-term retention. Regional for lowest cost/latency; multi-region for geo-redundancy and
availability across a region loss. Autoclass when access patterns are unpredictable.

## Limits / things that bite (verify against current docs)
- Resumable upload is the recommended path for large objects and flaky links (session-URI based,
  query-and-resume); multipart (XML API) also exists for S3-compatibility.
- Colder classes carry **minimum storage durations** and per-GB **retrieval fees** — early deletes
  and tiny churny objects can cost more than Standard despite the lower storage rate.
- **Egress to the internet is billed** (and inter-region transfer); Cloud CDN cuts egress + origin load.
- Request rate auto-scales but ramps; very spiky write bursts to a fresh bucket can need a warm-up.
- Unlike most stores, even Archive is instant-access — do not assume an archive "thaw" step.

## Provider-specific trade-offs
- Integrates with IAM, Pub/Sub notifications (object events → `messaging-streaming`), and
  BigQuery/Dataflow for data-lake reads; convenient but GCP-specific.
- Multi-region buckets simplify geo-redundancy without app-managed replication, at higher $/GB.

## Pitfalls
- Deleting Nearline/Coldline/Archive objects before the minimum duration → early-deletion charges.
- No lifecycle rule to expire noncurrent versions or tier down → silent storage growth.
- Serving popular objects from origin without Cloud CDN → egress blowup.
- Over-broad or long-lived signed URLs — scope to object + method, keep expiry short.
