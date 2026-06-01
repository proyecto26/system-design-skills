# Estimation recipes (worked end to end)

Each recipe is one multiply/divide chain. Round hard, label units, write
assumptions. The goal is a number good enough to pick an architecture, not a
correct one.

## Recipe 1 — QPS and storage (Twitter-scale example)

**Assumptions** (illustrative, not real Twitter numbers):
- 300M monthly users; 50% active daily → **150M DAU**.
- 2 posts/user/day; 10% of posts carry 1 MB media; data kept 5 years.

**Write QPS**
```
150M DAU × 2 posts ÷ 86,400 s  ≈ 3,500 QPS
Peak QPS ≈ 2 × 3,500          ≈ 7,000 QPS
```
7,000 write QPS > a single RDBMS node (~1,000 QPS) → the write path needs
sharding or a higher-throughput store. That conclusion is the whole point.

**Media storage**
```
per day:  150M × 2 × 10% × 1 MB  ≈ 30 TB/day
5 years:  30 TB × 365 × 5         ≈ 55 PB
```
55 PB → object/blob storage with tiering, not a database. (Text is tiny by
comparison: a tweet ≈ 64 B id + 140 B text ≈ negligible vs 1 MB media.)

## Recipe 2 — How many servers? (CPU-time derivation)

Estimate the compute ceiling of one server from first principles.

**Assumptions:** clock 3.5 GHz; CPI = 1; an average request ≈ 3.5M instructions.
```
time/clock cycle = 1 ÷ (3.5 × 10^9)            s
time/request     = 3.5×10^6 instr × 1 × (1 ÷ 3.5×10^9)
                 = 1 × 10^-3 s  = 1 ms
requests/s/core  = 1 ÷ 10^-3   = 1,000
64-core server   = 64 × 1,000  = 64,000 req/s   (pure CPU)
```
Change the instructions-per-request assumption and the estimate moves — that's
expected. This is the CPU ceiling; most services hit a **datastore** ceiling
first, so size with the per-server QPS rates (RDBMS ~1k, KV ~10k, cache ~100k–1M)
unless the work is genuinely CPU-bound (compression, encoding, ML).

```
servers needed = peak_QPS ÷ per_server_QPS
```

## Recipe 3 — Bandwidth

```
ingress (writes) = write_QPS × avg_request_size
egress  (reads)  = read_QPS  × avg_response_size
```
Estimate read and write separately; reads usually dominate and **egress costs
money**. If egress is large, that's the argument for a CDN (→ `content-delivery`)
and compression.

## Recipe 4 — Cache sizing (working set)

Apply the 80/20 rule: ~20% of data serves ~80% of reads. Size the cache to hold
the hot set.
```
hot set ≈ 20% × (daily reads × avg_object_size)
```
If the hot set fits in RAM across a few cache nodes (each ~100k–1M QPS), a cache
absorbs the read load and protects the database. If it doesn't fit, you're in
IO-bound territory — rethink the access pattern. → `caching`.

## Order-of-magnitude sanity checks

Before trusting any estimate, ask which order of magnitude it lands in:
- QPS: hundreds (single node) · thousands (replicas/cache) · 100k+ (shard) · 1M+
  (rethink the architecture).
- Storage: GB (one node) · TB (replicated/partitioned) · PB (distributed/blob +
  tiering).
- Latency budget: μs (in-memory) · ms (same DC) · 100 ms+ (cross-region — design
  around it).

## Tips (from the source material)

- **Round and approximate** — precision is not the goal; speed and feel are.
- **Write assumptions down** — they're load-bearing and you'll reference them.
- **Label units** — "5" is meaningless; "5 MB" is not.
- **Common asks:** QPS, peak QPS, storage, cache size, number of servers.
- **Then validate:** as a design firms up, replace BOTECs with measured numbers
  (synthetic benchmarks, then production monitoring) to find the real bottleneck.
