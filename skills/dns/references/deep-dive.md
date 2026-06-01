# DNS deep-dive

Mechanics that don't belong in the lean SKILL.md. Read when designing the DNS
layer in detail.

## Resolution hierarchy (recursive vs authoritative)

A lookup is a delegated walk down a tree, usually done *for* the client by a
**recursive resolver** (your ISP's, or a public one like 8.8.8.8 / 1.1.1.1):

1. Client asks its **stub resolver** (OS), which asks the **recursive resolver**.
2. The recursive resolver, if not cached, asks a **root** server → it returns the
   **TLD** name server for `.com`.
3. Asks the **TLD** server → it returns the **authoritative** name servers for
   `example.com` (your `NS` records / delegation).
4. Asks an **authoritative** server → it returns the final record (e.g. the `A`).
5. The recursive resolver caches each answer for its TTL and returns it to the client.

Two roles to keep straight: **recursive resolvers** *do the legwork and cache*
(you usually don't run these — clients/ISPs do); **authoritative servers** *hold
the truth for your zone* (this is what your managed DNS provider runs for you).
Most of the latency hides in the recursive resolver's cache — a warm cache
answers in microseconds; a full cold walk is several round trips.

## Record types (the set that matters)

- **`A` / `AAAA`** — name → IPv4 / IPv6 address.
- **`CNAME`** — alias to another name. Resolvers chase it to an address. Invalid at
  the zone apex (the apex must coexist with `SOA`/`NS`, which `CNAME` forbids).
- **`ALIAS` / `ANAME`** — provider-side apex alias: the provider resolves the
  target and serves an `A`/`AAAA`, so `example.com` can point at an LB/CDN hostname.
  Not a standard record type — implemented by the provider.
- **`NS`** — delegates a zone to its authoritative servers.
- **`MX`** — mail servers (with priority).
- **`TXT`** — arbitrary text: SPF/DKIM, domain-ownership verification.
- **`SOA`** — zone metadata (serial, refresh, negative-cache TTL).
- **`SRV`, `CAA`, `PTR`** — service location, cert-authority authorization, reverse lookup. Use as needed; not traffic steering.

## TTL and propagation (why changes are slow)

The TTL on a record tells resolvers how long to cache it. A change to a record is
**not** pushed — it takes effect only as cached copies expire across the internet.
So the *effective* propagation/failover time is the TTL plus stragglers (some
resolvers and ISPs ignore low TTLs and over-cache; browsers/OS cache too). Tactics:

- **Lower the TTL before a planned change**, wait one old-TTL period, make the
  change, then restore a sane TTL. This bounds the cutover window.
- **Negative caching** (`SOA` minimum / negative-TTL) controls how long *NXDOMAIN*
  answers are cached — a too-long negative TTL delays a newly-created record.
- **Trade-off:** short TTL = faster failover but more authoritative QPS and less
  cache cushion during a DDoS; long TTL = cheap and resilient but slow to change.

## Anycast (how one IP reaches the nearest site)

The same IP prefix is advertised via BGP from many physical sites. The internet's
routing naturally delivers a packet to the topologically nearest advertiser. Used
for resolver front ends, root/TLD servers, and CDN edges. Benefits: proximity
without per-client logic, and DDoS absorption (attack traffic is spread across all
sites). Costs: you operate BGP; a route change/withdrawal can briefly flap which
site a client hits, and per-site capacity must each survive local spikes. The
edge-caching/CDN use of anycast is owned by `content-delivery`.

## Health-checked failover (internals)

Managed DNS can attach a **health check** to a record so unhealthy endpoints stop
being returned:

- The provider probes the endpoint (HTTP/HTTPS/TCP) from multiple vantage points.
- A record is considered healthy only when probes from enough locations succeed,
  over **N consecutive checks** at a set **interval** — this damps flapping.
- On failure, the policy stops handing out that answer (failover → secondary;
  latency/weighted → drop the dead region).
- **Effective recovery** = detection time (interval × threshold) + TTL expiry of
  already-cached answers. This is why DNS failover is minutes-scale, not instant.

Pitfalls: too-tight thresholds cause flapping and client scatter; probing from few
locations misreads partial outages; health-checking a path that differs from the
real user path gives false confidence. Health-check tuning, retries/backoff, and
graceful degradation are owned by `resilience-failure`.

## Active-active vs active-passive at the name layer

- **Active-active** (latency/geo/weighted across live regions): all regions serve;
  losing one drops its share, survivors absorb it (size for it). Needs the data
  tier to be multi-region (→ `data-storage`, `consistency-coordination`).
- **Active-passive** (failover policy): primary serves, standby idles until
  promoted. Simpler data story, but the standby may be cold (cache empty, scaled
  down) — warm it or expect a post-failover latency hit. The failover is still
  TTL-bound.

## Common mistakes

- Treating DNS as a real-time load balancer (it caches per-lookup; LB is per-request).
- A single authoritative provider/zone as a SPOF for a multi-region design.
- `CNAME` at the apex (invalid) instead of `ALIAS`/`ANAME`.
- Forgetting negative-cache TTL when a record "should exist but doesn't resolve yet."
- Latency routing surprises: it steers by the *resolver's* network position, which
  may be far from the actual user (corporate/public resolvers).
