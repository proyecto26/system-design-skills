# Blob store — Azure

## Service mapping
- **Azure Blob Storage** — the object store, inside a *storage account* → *containers* → blobs.
  **Block blobs** are the object-storage workhorse (uploaded as blocks then committed — Azure's
  multipart); append blobs suit log appends; page blobs back disks (not general object storage).
- **Access tiers** (the tiering knob) — *Hot*, *Cool*, *Cold*, and *Archive* (offline; rehydrate
  to an online tier over hours before reading). Set per-blob or as an account default.
- **Redundancy** (the durability knob, set on the account) — *LRS* (replicas in one datacenter),
  *ZRS* (across availability zones), *GRS/GZRS* (asynchronous copy to a second region),
  *RA-GRS* (read access to the secondary). Pick by failure domain you must survive.
- **Azure CDN / Front Door** — CDN in front of the blob origin (→ `content-delivery`).
- **SAS (Shared Access Signature)** — Azure's signed-URL equivalent: scoped, time-limited,
  per-blob or per-container grants.

## When to pick which
Hot for actively served blobs; Cool/Cold for backups and infrequently read data (cheaper
storage, higher access cost, minimum retention periods); Archive for compliance retention off
the request path. LRS for cheapest single-region; ZRS for AZ resilience; GRS/GZRS for region loss.

## Limits / things that bite (verify against current docs)
- Block-blob max size is a function of max block size × max block count; large blobs require the
  block (multipart) path.
- **Archive is offline** — you must *rehydrate* (hours) to Hot/Cool before a read; plan it as async.
- Cool/Cold/Archive have minimum storage-duration charges and per-GB retrieval costs; churny or
  tiny blobs can cost more in a cool tier.
- Redundancy is largely an *account-level* setting — mixing requirements may mean multiple accounts.
- GRS replication to the secondary region is asynchronous → possible data loss window on failover.

## Provider-specific trade-offs
- Tight integration with Entra ID, Event Grid (blob events), and lifecycle management policies;
  convenient but Azure-specific.
- Account-scoped redundancy/throughput limits make the storage-account boundary a real design unit,
  unlike S3's flatter bucket model.

## Pitfalls
- Reading from Archive without budgeting rehydration latency → timeouts.
- No lifecycle policy to delete old versions/snapshots or tier down cold data → silent growth.
- Over-broad or long-lived SAS tokens (especially account-level SAS) — scope to blob + short expiry.
- Serving hot blobs from origin without Front Door/CDN → egress and throughput pressure.
