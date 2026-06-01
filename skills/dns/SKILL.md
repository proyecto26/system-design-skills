---
name: dns
description: This skill should be used when the user asks about "DNS", "domain resolution", "GeoDNS / geo routing", "latency-based routing", "weighted / failover routing", "Route 53 / Cloud DNS", an "A/CNAME/ALIAS record", "anycast", or "DNS TTL / propagation". It gives the global front door that maps a name to the right IP and steers users to the right region or endpoint. Use it whenever a design must direct traffic across regions/data centers, do health-checked failover at the name layer, or expose a stable hostname even if the user doesn't say "DNS".
---

# DNS

DNS is the global front door: it turns a name (`api.example.com`) into an address
*before any request reaches your servers*. It is also a routing layer — the same
lookup can hand different clients different answers (by region, latency, health,
or weight). Get it wrong and clients reach a dead region, fail over in minutes
instead of seconds, or cache a bad answer for hours. It is not a load balancer
and not a CDN; it decides *which endpoint a client is told to use*, not how bytes
are balanced inside that endpoint.

## When to reach for this
A service is reachable by a stable hostname; traffic must be steered to the
closest or healthiest region/data center; or an endpoint's IP can change (a new
load balancer, a failover site) and clients must follow without code changes.
Multi-region or multi-data-center designs need DNS to pick the entry point;
single-region designs still need it for a stable, movable name.

## When NOT to
Routing *inside* one region — that is a load balancer's job (→ `load-balancing`),
which reacts in milliseconds, not TTL-bound minutes. Fine-grained per-request or
session-aware steering — DNS answers per lookup, then the client caches it. Fast
failover with sub-second recovery — DNS failover is gated by TTL and resolver
caching; do not promise instant cutover from the name layer. And do not reach for
exotic routing policies before a number shows users are spread across regions
(YAGNI) — a single `A`/`ALIAS` record is the right default for one region.

## Clarify first
- **Geographic spread** — one region or many? Where are the users? (→ `requirements-scoping`)
- **Failover target** — recovery time objective for losing a region: seconds, or "a few minutes is fine"?
- **How dynamic is the endpoint** — fixed IPs, or an LB hostname that changes? (drives `A` vs `CNAME`/`ALIAS`)
- **Steering goal** — closest by latency, by user geography, by weight (canary/A-B), or just round-robin?
- **Staleness tolerance for the mapping** — how long can a client keep a stale answer? (sets the TTL → `back-of-the-envelope`)

## The options

**Record type (what the name returns)**
- **`A` / `AAAA`** — name → IPv4 / IPv6. Use when the endpoint has a stable IP.
- **`CNAME`** — name → another name. Use to alias onto a provider hostname; never at the zone apex (`example.com`).
- **`ALIAS` / `ANAME`** (provider-specific) — apex alias to a hostname. Use to point `example.com` at an LB/CDN hostname.
- **`NS` / `MX` / `TXT`** — delegation, mail, verification. Use as the domain requires; not traffic steering.

**Routing policy (which answer a client gets)**
- **Simple** — one answer for everyone. Use for a single endpoint.
- **Weighted** — split by percentage. Use for canary, A/B, or shifting between clusters.
- **Latency-based** — answer the region with lowest measured latency to the resolver. Use to minimize round-trip.
- **Geolocation / GeoDNS** — answer by the *client's* location (data residency, localized content). Use when geography, not latency, must decide.
- **Failover** — primary while healthy, else secondary. Use for active-passive DR.
- **Multivalue** — return several healthy IPs; client picks. Use for cheap client-side spread with health pruning.

**Reachability**
- **Anycast** — one IP advertised from many sites; the network routes to the nearest. Use for resolver/CDN front ends and DDoS resilience (concept lives in `content-delivery`).

## Trade-offs

| Option | What it solves | What it worsens | Change it when |
|---|---|---|---|
| Simple `A`/`ALIAS` | Trivial; one stable name | No steering, no failover; SPOF if the IP dies | Traffic spans regions or needs DR → weighted/latency/failover |
| Weighted | Gradual shifts, canary, cluster balancing | Manual/slow; not health-aware unless paired with checks | You need automatic closeness → latency; or automatic cutover → failover |
| Latency-based | Lowest RTT per user automatically | Routes to *resolver* location, not user; needs per-region endpoints | Data residency matters more than speed → geolocation |
| Geolocation | Compliance, localized answers | Misroutes via VPN/forwarding resolvers; coarse map | Speed matters more than geography → latency-based |
| Failover | Automatic active-passive cutover | Recovery bounded by TTL + caching; cold standby risk | RTO must be sub-second → in-region LB, not DNS |
| Anycast | Nearest entry + absorbs DDoS | Operationally heavy (BGP); flap on route changes | You only have one site → not worth it |

## Behavior under stress
DNS fails in slow, wide ways — a bad answer or an authoritative outage affects
*everyone who looks up next*, and lingers as long as TTLs allow.

- **TTL caching delays recovery and propagation.** Resolvers and OS/browser
  caches hold answers for the TTL; some ISPs over-cache. A failover or IP change
  only takes effect as old entries expire — the *effective* recovery time is TTL
  plus stragglers, not zero.
- **Authoritative DNS as a SPOF.** If your authoritative servers (or a single
  managed zone) go down, *nothing* resolves, even though your servers are healthy.
  Use a provider on anycast across many sites; consider a secondary DNS provider.
- **Health-check stampede / flapping.** Aggressive health checks across many
  endpoints can hammer targets, and a flapping check can oscillate answers,
  scattering clients. Tune interval, failure threshold, and require N consecutive
  failures (→ `resilience-failure` owns health-check tuning).
- **Low-TTL load.** Cutting TTL to seconds for fast failover multiplies lookup QPS
  against authoritative servers and removes the cache cushion during an attack.
- **DDoS on the resolver tier.** DNS is a classic amplification/DDoS target; an
  overwhelmed resolver makes your whole property unreachable.

**Monitor:** resolution latency and error/SERVFAIL rate, query QPS per record,
health-check status per endpoint, time-to-propagate after a change, and the share
of traffic each region/answer actually receives.

## How to apply
1. **Clarify the inputs** — geographic spread, RTO for a region loss, endpoint
   stability, steering goal, and mapping staleness (see *Clarify first*). One
   region with a fixed entry point needs only a simple record — stop there.
2. **Pick the policy from the trade-off table** — choose a record type (`ALIAS`
   at the apex onto an LB/CDN hostname is the common default) and a routing policy
   keyed to the steering goal: weighted for canary, latency for speed, geo for
   residency, failover for active-passive DR.
3. **Set the key knobs** — TTL (balance fast failover against lookup load and
   propagation), health-check interval and failure threshold, and the failover
   target. Decide secondary-DNS / anycast posture up front.
4. **Stress-test the choice** — walk *Behavior under stress*: confirm the TTL
   gives an acceptable effective recovery time, the authoritative tier is not a
   SPOF, and health checks won't flap or stampede.
5. **Size it with numbers** — estimate lookup QPS at the chosen TTL and the
   propagation window a change implies (→ *Numbers that matter*).
6. **Pick a provider** — default to the generic recipe; open a provider file only
   if the user named a cloud (see *Choosing a provider*).

## Dos and don'ts
**Do**
- Put steering at DNS for *cross-region* choice and let an LB balance *within* a region.
- Use `ALIAS`/`ANAME` at the apex onto an LB/CDN hostname so IP changes need no edits.
- Pair routing policies with health checks so dead regions stop being handed out.
- Run authoritative DNS on anycast across many sites; consider a second provider.
- Set TTL deliberately — short enough for your RTO, long enough to survive load.

**Don't**
- Don't expect DNS failover to be instant; it is bounded by TTL plus resolver caching.
- Don't put a `CNAME` at the zone apex — it is invalid; use `ALIAS`/`ANAME`.
- Don't trust geolocation for security or precise placement (VPNs and forwarders lie).
- Don't run a single authoritative zone as a SPOF for an otherwise multi-region design.
- Don't drop TTL to seconds everywhere "just in case" — it multiplies query load.

## Numbers that matter
The quantities to estimate: the **TTL**, which sets both the propagation window
and the effective failover time (a 60 s TTL means up to ~60 s-plus of staleness,
not instant); the **lookup QPS** the TTL implies against authoritative servers
(shorter TTL → more queries); and a resolution **latency budget** (one extra
round trip, largely hidden by caching). Anchor these with rules of thumb and
peak-multiplier math in `back-of-the-envelope` — don't restate its tables here.

## Interface sketch
A DNS record is a contract: **name** (`api.example.com`), **type** (`A`/`AAAA`/
`CNAME`/`ALIAS`), **value** (IP or target hostname), **TTL** (seconds), and an
optional **routing policy + health check**. Example as a zone line:

```
api.example.com.   60   IN   A   203.0.113.10     ; latency-policy, region us-east, health-check id hc-1
```

Decide per record: which policy selects it, what health check gates it, and the
TTL that bounds its staleness.

## Choosing a provider
Default to the generic recipe above. If the user names a cloud, read
`references/providers/<provider>.md` for the managed-service mapping,
quotas/limits, and provider-specific trade-offs. If no file exists for that
provider, the generic recipe is the answer.

## Diagram
To visualize the resolution path (client → recursive resolver → root/TLD/
authoritative → answer) or a geo/latency-steered multi-region front door, use the
in-plugin `architecture-diagram` skill. A quick inline sketch:
`client → resolver → authoritative (policy: latency) → region A | region B`.

## Related building blocks
- `load-balancing` — *complements* this: DNS spreads traffic across regions/endpoints, while an LB spreads requests within a region and reacts in milliseconds.
- `content-delivery` — *pairs with* this: CDNs route users to edge POPs via anycast and DNS, and the anycast/edge-caching concept is *owned* there.
- `resilience-failure` — *feeds into* this: health-check tuning, failover, and degradation patterns (and rate limiting) are *owned* there and gate DNS failover.
- `back-of-the-envelope` — *feeds into* this: it supplies the TTL/QPS/latency math that sizes the record set and propagation window.
- `system-design` — *owned-concept lives in* the orchestrator: the reasoning loop, the trade-off method, and the ten failure modes.

## References
- **`references/deep-dive.md`** — resolution hierarchy (recursive vs authoritative, root/TLD), the full record-type set, how TTL/propagation really behaves, anycast mechanics, and health-checked failover internals. Read when designing the DNS layer in detail.
- **`references/providers/{generic,aws,azure,gcp}.md`** — service mappings, limits, and pitfalls per environment.
