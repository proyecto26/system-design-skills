# Load balancing — Azure

## Service mapping
- **Azure Load Balancer** — managed **L4** (TCP/UDP); high throughput, low latency,
  source-IP preservation, public or internal. The L4 default within a region.
- **Application Gateway** — managed **L7**; path/host routing, TLS termination,
  cookie-based affinity, autoscaling, with an optional **WAF** tier. The HTTP(S)
  default when you need content routing in-region.
- **Azure Front Door** — global **L7** edge: anycast entry, TLS offload, path/host
  routing, caching, and WAF at the edge (cross-region steering + CDN, →
  `content-delivery`). Use for global apps, not single-region balancing.
- **Traffic Manager** — DNS-based global routing (priority/weighted/geo/perf); like
  Route 53, it steers between endpoints, it is not an L4/L7 data-path LB.
- **VM Scale Set** — the autoscaling fleet the LB/App Gateway balances over.

## When to pick which
Azure Load Balancer for L4 TCP/UDP throughput within a region; Application Gateway
for in-region L7 HTTP routing + WAF; Front Door for global edge routing/caching;
Traffic Manager when DNS-level endpoint selection is enough.

## Limits / things that bite (verify against current docs)
- Application Gateway v1 had manual sizing; v2 autoscales — confirm you're on v2
  for elastic load, and note warm-up time on sudden spikes.
- Basic Load Balancer lacks features/SLA of Standard and is being retired — use
  Standard.
- L4 Load Balancer does **no** TLS termination or content routing (that's App
  Gateway/Front Door); don't expect L7 behavior from it.
- Probe (health-check) interval/threshold config drives eviction speed and flap —
  set deliberately; an unhealthy probe drops the backend from rotation.

## Pitfalls
- Reaching for Front Door for a single-region app (over-engineering + cost) — App
  Gateway or Load Balancer suffices.
- Using cookie affinity on App Gateway instead of externalizing session state,
  then losing sessions on scale-in.
- Confusing Traffic Manager (DNS steering) with an actual data-path balancer.
- Lock-in: App Gateway/Front Door rules and WAF policies don't port to other clouds.
