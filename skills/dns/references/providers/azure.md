# DNS — Azure

## Service mapping
Azure splits "host the zone" from "steer the traffic" across two services — know
which one a routing policy lives in.

- **Azure DNS** — managed authoritative hosting on anycast. Public and private
  zones, `A`/`AAAA`/`CNAME`/`MX`/`TXT`, and **alias records** (the generic `ALIAS`,
  including apex) pointing at Azure resources (Public IP, Front Door, Traffic
  Manager). This is record hosting — it does **not** do latency/geo/failover steering.
- **Traffic Manager** — DNS-*based* global traffic routing. This is where the
  routing policies live: **Priority** (= failover), **Weighted**, **Performance**
  (= latency-based), **Geographic** (= geolocation), **Multivalue**, and **Subnet**.
  Health-checked endpoint monitoring gates them. It returns a `CNAME`/answer per
  policy, so it is still TTL-bound.
- **Azure Front Door** — anycast L7 edge with health-based, near-instant failover
  *without* DNS TTL waits; pair with it (or use instead of Traffic Manager) when
  TTL-bound failover is too slow. Edge caching is `content-delivery`.

## When to pick which
Host the zone in Azure DNS; alias the apex onto Front Door or Traffic Manager. Use
Traffic Manager for DNS-level global routing across regions/clouds/on-prem; use
Front Door when you need fast failover plus edge termination/caching.

## Limits / things that bite (verify against current docs)
- Traffic Manager is DNS-level → **TTL-bound failover**; Front Door is not.
- Traffic Manager Performance routing uses an internet-latency table to Azure
  regions, keyed to the resolver — not the exact user.
- Probe interval/timeout/tolerated-failures set detection speed; tighter = flap risk.
- Per-profile endpoint counts and per-zone record-set quotas apply.

## Pitfalls
- Expecting Azure DNS alone to do failover/geo — that requires Traffic Manager or Front Door.
- Confusing Traffic Manager (DNS, TTL-bound) with Front Door (anycast, fast) failover.
- Nesting Traffic Manager profiles and losing track of effective TTL.
