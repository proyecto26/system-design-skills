# DNS — generic / self-hosted

The vendor-neutral default. When no cloud is named, this is the answer.

## What to run
- **BIND** — the reference authoritative + recursive server; ubiquitous, flexible,
  zone-file driven. Heaviest to operate; large attack surface if misconfigured.
- **PowerDNS** — authoritative server with pluggable backends (SQL, etc.) plus a
  separate recursor; good when zones live in a database. Some geo/load features via
  backends (e.g. geoip).
- **Knot DNS / NSD** — modern, fast authoritative-only servers; pair with Unbound
  as the recursive resolver. Common for high-performance authoritative tiers.
- **CoreDNS** — plugin-based, common inside Kubernetes for service discovery.

## Topology
- **Authoritative tier** holds your zones; run **at least two** name servers, on
  separate networks/sites. Standard DNS supports primary→secondary **zone transfer**
  (AXFR/IXFR) so secondaries stay in sync — use it for redundancy.
- **Anycast** the authoritative IPs across sites via BGP for proximity and DDoS
  resilience (you operate the routing).
- **Recursive resolvers** are usually the client's/ISP's; you run recursors only
  for internal resolution.

## Routing policies without a managed service
Plain BIND/NSD give you simple and round-robin (multiple `A` records) out of the
box. **Weighted, latency, geo, and failover** policies are *features layered on
top* — PowerDNS geoip/lua backends, dnsdist, or a GSLB appliance — and **health-
checked failover** means running your own prober that rewrites zone records on
failure. This operational burden is exactly why most teams use a managed provider
for traffic steering.

## Limits / things that bite
- Self-run health-check failover is DIY: you build the prober, the thresholds, and
  the record-rewrite path — and it's still TTL-bound for recovery.
- Zone transfers must be secured (TSIG) or you leak/expose your zone.
- A misconfigured open recursive resolver becomes a DDoS amplifier — lock it down.
- Geo/latency steering needs an IP-geolocation database you keep current.

## Pitfalls
- One physical site for all authoritative servers → SPOF; spread them.
- Forgetting DNSSEC key rollover if signing zones (broken validation = outage).
- Treating round-robin `A` records as load balancing — clients cache one answer and
  there's no health awareness.

Maximum control and zero lock-in, but you own anycast/BGP, health checking, and
geo data. Use when running your own infra or when a managed provider can't meet a
constraint; otherwise a managed zone removes most of this toil.
