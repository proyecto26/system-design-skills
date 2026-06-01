# Blob store — AWS

## Service mapping
- **S3** — the object store. Buckets + keys, strong read-after-write, versioning, multipart
  upload, presigned URLs, lifecycle rules, event notifications. The default.
- **Storage classes** (the tiering knob) — *Standard* (hot), *Standard-IA* / *One Zone-IA*
  (infrequent access, cheaper storage + retrieval fee), *Glacier Instant/Flexible Retrieval*
  and *Glacier Deep Archive* (archive; minutes-to-hours retrieval, cheapest at rest),
  *Intelligent-Tiering* (auto-moves objects between tiers by access pattern).
- **Durability/replication** — S3 handles intra-region durability internally; **Cross-Region
  Replication (CRR)** / Same-Region Replication for geo/compliance copies (asynchronous).
- **CloudFront** — CDN in front of S3 origin (→ `content-delivery`).

## When to pick which
Standard for actively served objects; IA for backups read a few times a month; Glacier/Deep
Archive for compliance retention off the request path; Intelligent-Tiering when access is
unpredictable and you don't want to manage lifecycle transitions yourself.

## Limits / things that bite (verify against current docs)
- Max single object size and the single-PUT vs multipart threshold — large objects *must* use
  multipart; multipart part-size minimum (~5 MB) and a max part count cap effective object size.
- Glacier/Deep Archive retrievals take minutes to hours and charge retrieval + request fees —
  never on a latency path.
- IA/One Zone-IA have a minimum billable object size and minimum storage duration; tiering
  many tiny objects can cost *more* than Standard.
- **Egress to the internet is billed**; CloudFront in front cuts both egress and origin load.
- Request rate scales per *prefix* — historically high-cardinality random prefixes spread load;
  monotonic/date prefixes can hotspot.

## Provider-specific trade-offs
- Deep S3 integration (IAM, KMS encryption, event → Lambda, S3 Select) is convenient but is
  lock-in; the S3 API itself is the de-facto standard others emulate.
- Intelligent-Tiering removes lifecycle work but adds a per-object monitoring charge — wasteful
  for very small objects.

## Pitfalls
- Putting Glacier on a read path and timing out requests.
- No lifecycle rule to **abort incomplete multipart uploads** → orphaned parts billed forever.
- Versioning on with no expiry of non-current versions → silent storage growth.
- Serving popular objects straight from S3 without CloudFront → egress blowup.
- Over-broad/long-lived presigned URLs and bucket policies — scope tight, expire short.
