# Load balancing — AWS

## Service mapping
- **ALB (Application Load Balancer)** — managed **L7**; routes by host/path/header/
  query, TLS termination, HTTP/2 + gRPC, WebSockets, target groups, sticky sessions
  via LB-issued cookie. The default for HTTP(S) services.
- **NLB (Network Load Balancer)** — managed **L4**; ultra-high throughput, very low
  latency, static IP / Elastic IP, TLS passthrough or termination, preserves source
  IP. Use for non-HTTP, extreme throughput, or static-IP needs.
- **CLB (Classic)** — legacy L4/L7; avoid for new designs (use ALB/NLB).
- **Auto Scaling Group + target group** — the fleet ALB/NLB balances over; ASG adds/
  removes instances and the LB health-gates them (the stateless-tier enabler).
- **Route 53** — DNS-level latency/geo/weighted routing (cross-region steering, →
  `content-delivery`), not an L4/L7 LB.
- **Global Accelerator** — anycast static IPs that steer to the nearest healthy
  regional LB.

## When to pick which
ALB for content-based HTTP routing and TLS offload; NLB for raw TCP/UDP
throughput, static IPs, source-IP preservation, or mTLS passthrough; pair an NLB
in front of an ALB only when you need both static IP and L7 routing.

## Limits / things that bite (verify against current docs)
- ALB scales by adding capacity units — it **pre-warms slowly**; a sudden traffic
  cliff can outrun scaling. Engage support for known spikes.
- ALB idle-connection timeout (default ~60s) silently drops long-lived/streaming
  connections; tune it and your backends' keep-alive.
- NLB to targets in the same subnet can break source-IP/health-check unless
  client-IP preservation is configured correctly.
- ASG health checks (EC2) and LB health checks are *separate* — an instance can be
  "EC2-healthy" but LB-unhealthy; wire ELB health checks into the ASG.
- Cross-AZ load balancing may incur data-transfer charges and is on/off per LB type.

## Pitfalls
- Relying on ALB stickiness instead of externalizing session state, then losing
  sessions on scale-in.
- Forgetting deregistration delay (connection draining) so deploys drop requests.
- Treating Route 53 latency routing as a substitute for in-region balancing (it
  isn't — it steers between regions).
- Lock-in: ALB routing rules, target groups, and Global Accelerator don't port to
  other clouds.
