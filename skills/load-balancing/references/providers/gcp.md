# Load balancing — GCP

## Service mapping
GCP unifies most options under **Cloud Load Balancing**, split by layer and scope:
- **Global external Application LB** — **L7**, anycast single global IP, host/path
  routing, TLS termination, integrates with Cloud CDN at the edge (cross-region
  steering + caching, → `content-delivery`). The default for global HTTP(S).
- **Regional external Application LB** — **L7** scoped to one region when global/
  anycast isn't needed.
- **External passthrough Network LB** — **L4** (TCP/UDP); preserves client IP,
  passthrough (no termination), very high throughput.
- **Proxy Network LB** — **L4** that terminates TCP (optionally TLS) and proxies.
- **Internal LBs** — L4 and L7 variants for private VPC traffic between tiers.
- **Managed Instance Group (MIG)** — the autoscaling fleet the LB balances over,
  with health-gated membership (the stateless-tier enabler).

## When to pick which
Global external Application LB for global HTTP(S) with anycast + CDN; regional
Application LB for single-region L7; passthrough Network LB for L4 throughput and
source-IP preservation; internal LBs for tier-to-tier traffic inside the VPC.

## Limits / things that bite (verify against current docs)
- The global Application LB uses **anycast** with Google's edge — there's no single
  warm-up cliff like some per-region LBs, but backend MIG capacity and autoscaling
  still bound real throughput.
- **Health checks are central** to membership and to autoscaling/autohealing — a
  too-aggressive or too-deep check can evict or recreate healthy instances; tune
  interval, thresholds, and check depth.
- Backend service settings (connection draining timeout, balancing mode by
  RATE/UTILIZATION/CONNECTION, capacity scaler) directly shape distribution — set
  them deliberately.
- Network LB is **passthrough** (no TLS termination / no L7 routing) — use an
  Application LB or Proxy LB when you need those.

## Pitfalls
- Picking a passthrough Network LB then needing path-based routing or TLS
  termination (wrong layer — use Application LB).
- Leaving generated-cookie affinity on instead of externalizing session state.
- Misconfigured balancing mode causing hot backends (e.g. CONNECTION mode for
  uneven request cost — prefer RATE/UTILIZATION).
- Lock-in: backend-service config, URL maps, and global anycast IPs don't port to
  other clouds.
