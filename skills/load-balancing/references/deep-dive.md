# Load balancing deep-dive

Mechanics that don't belong in the lean SKILL.md. Read when configuring a
balancer in detail.

## L4 forwarding: NAT vs. DSR

An L4 balancer never reads the payload; it forwards packets by IP/port.

- **NAT (network address translation):** the balancer rewrites the destination
  (and on the way back, the source) so both directions traverse it. Simple, but
  the balancer is in the return path too — return traffic (often the larger half)
  flows back through it, capping throughput.
- **DSR (direct server return):** the backend replies straight to the client,
  bypassing the balancer on egress. The balancer only handles inbound, so it
  scales much further for response-heavy workloads (video, downloads). Costs more
  setup (loopback VIP on backends, L2 adjacency or tunneling) and loses
  return-path visibility.

L4 keeps the client's TCP connection essentially end-to-end, so it adds minimal
latency and works for any protocol (gRPC streams, databases, custom TCP/UDP).

## L7 termination: how it actually routes

An L7 balancer is a **full proxy**: it terminates the client's TCP/TLS
connection, parses the HTTP request, makes a routing decision, then opens (or
reuses, via a connection pool) a *separate* connection to the chosen backend.
Two connections, two congestion windows. This is what enables:

- **Content routing:** by `Host`, path prefix, header, method, or cookie — e.g.
  `/api/*` to the API pool, `/static/*` to a cache tier, video hosts to media
  servers, billing to hardened nodes.
- **Request manipulation:** header injection (`X-Forwarded-For`, request IDs),
  rewrites, redirects, compression.
- **Backend connection pooling / multiplexing:** many short client connections
  reuse a small pool of warm backend connections (huge win for HTTP/2, gRPC).

Cost: per-request CPU (parsing, TLS), added latency, and the balancer now holds
connection state — making *it* more stateful and its memory a sizing concern.

## Distribution algorithms in detail

- **Round robin:** rotate through the pool. **Weighted** assigns more turns to
  bigger nodes. Blind to actual load — a node stuck on slow requests still gets
  its share.
- **Least connections:** route to the fewest active connections; **least response
  time** also factors latency. Best when request cost is uneven (mixed or
  long-lived connections). Requires the balancer to track live state; a
  just-added node looks idle and can get *flooded* — pair with slow-start.
- **Power of two choices:** sample two backends at random, pick the less loaded.
  Near-optimal balance with O(1) state and no global coordination — the default
  in many modern proxies.
- **Hash-based (IP hash / header hash):** deterministic client→backend mapping for
  affinity without a session store. Plain modulo hashing remaps almost everything
  when the pool changes; **consistent hashing** moves only ~K/N keys on a pool
  change, preserving most affinity and cache locality. The full consistent-hashing
  mechanics (rings, virtual nodes) are owned by `consistency-coordination` — use
  it here purely as the "affinity that survives scaling" tool.

## Health checks (the part people get wrong)

- **Active checks:** the balancer probes each backend (`GET /healthz`, a TCP
  connect, or gRPC health RPC) on an interval. **Passive checks** observe real
  traffic and eject a node after N consecutive errors.
- **Shallow vs. deep:** a shallow check (process accepts a connection / returns
  200 from a trivial handler) tests "is the box up." A deep check (verifies DB,
  cache, downstream) tests "can it serve" — but if the shared dependency hiccups,
  *every* backend fails the deep check simultaneously and the whole pool is
  evicted, turning a slow dependency into a total outage. Prefer shallow liveness
  for pool membership; handle dependency failure with degradation in the app
  (→ `resilience-failure`).
- **Thresholds & jitter:** require multiple consecutive fails before eviction and
  multiple passes before re-admission (anti-flap). Jitter the interval so checks
  don't synchronize into a probe storm.

## Slow-start / connection ramping (anti-stampede)

When a node (re)joins, ramp its share from near-zero up over a warm-up window
instead of handing it a full load instantly. This lets caches fill, JITs warm,
and connection pools build before peak traffic arrives — directly preventing the
recover→overload→drop→recover oscillation. Combine with least-connections-aware
weighting so a "0 connections" fresh node isn't treated as the most attractive
target.

## Connection draining (graceful scale-in / deploy)

On deregistering a node (scale-in, deploy, scale to a smaller instance), stop
sending it *new* connections but let in-flight requests finish for a drain
timeout before terminating. Without draining, every deploy or scale event drops
live requests. Set the drain window to cover your slowest reasonable request.

## TLS termination vs. passthrough

- **Termination at the balancer:** decrypt once at the edge; backends speak plain
  HTTP. Offloads CPU, centralizes certs, and is *required* for L7 content routing
  (you can't route on a path you can't read). Re-encrypt to backends (mTLS in the
  mesh) if the internal hop must stay encrypted.
- **Passthrough (TCP/L4):** the balancer forwards encrypted bytes; the backend
  terminates TLS. Needed for end-to-end encryption or client-cert auth that must
  reach the app. Loses L7 routing and inspection.

## Common mistakes

- One balancer, no standby — the balancer is now the SPOF it was meant to remove.
- Deep health checks that evict the whole fleet when a shared dependency blips.
- No slow-start → recovered nodes get firehosed and flap.
- No connection draining → every deploy drops in-flight requests.
- Sticky sessions used as a crutch instead of externalizing state, then scale-in
  drops live sessions.
- Unbounded retries at the balancer amplifying load onto survivors (cap + backoff;
  → `resilience-failure`).
- Treating cross-region steering as an L4/L7 problem instead of DNS/anycast/CDN
  (→ `content-delivery`).
