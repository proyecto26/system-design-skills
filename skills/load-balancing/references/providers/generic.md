# Load balancing — generic / self-hosted

The vendor-neutral default. When no cloud is named, this is the answer.

## What to run
- **HAProxy** — battle-tested L4 and L7 proxy/balancer. Rich algorithms
  (round robin, least-conn, source hash), fine-grained health checks, slow-start,
  connection draining, TLS termination. The default for a dedicated software LB.
- **Nginx** — web server + L7 reverse proxy + balancer; also does static serving,
  caching, compression, TLS termination. Great when the balancer and reverse-proxy
  roles are the same box. L4 (stream) module exists but is less full-featured.
- **Envoy** — modern L4/L7 proxy built for dynamic service discovery, gRPC/HTTP2,
  observability, and outlier detection (passive ejection). The data plane behind
  most service meshes; pick it for dynamic fleets and rich telemetry.
- **Keepalived / VRRP** — floats a virtual IP between two balancers for
  active-passive HA. **IPVS/LVS** — kernel-level L4 for very high throughput.

## Topology
- Single balancer only for non-critical/dev — it's a SPOF.
- **Active-passive:** two balancers, a VIP moved by Keepalived/VRRP on failure
  (failover gap of seconds).
- **Active-active:** multiple balancers behind DNS round robin or anycast/ECMP, or
  a small L4 tier (LVS) fronting an L7 tier (HAProxy/Envoy) for scale.

## Limits / things that bite
- A single instance is bounded by CPU (TLS + L7 parsing), open file descriptors /
  ephemeral ports, and NIC bandwidth — L7 termination is far heavier than L4
  forwarding. Size against peak concurrent connections, not just QPS.
- Health-check config is yours to get right: set failure/success thresholds,
  intervals, jitter, and slow-start explicitly or you'll flap or stampede
  recovering nodes (see deep-dive).
- Connection draining/deregistration delay must be configured for graceful
  deploys/scale-in, or in-flight requests drop.
- Backend discovery is on you: static config, DNS, or a registry (Consul/etcd) +
  reload. Stale targets get traffic until removed.

## Pitfalls
- One balancer with no standby — you reintroduced the SPOF.
- TLS terminated at the LB but the internal hop left in plaintext when compliance
  requires encryption end-to-end (use re-encrypt/passthrough).
- Default round robin on long-lived connections → uneven load (use least-conn).
- Operating HA, certs, and observability yourself — heavier than a managed LB, but
  zero lock-in and full control. Use when self-hosting or for cloud portability.
