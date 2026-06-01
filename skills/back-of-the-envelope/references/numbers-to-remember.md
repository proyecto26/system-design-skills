# Numbers to remember

The reference points a designer should know cold, so BOTECs don't need lookups.
**Memorize the orders of magnitude, not the decimals** — the ratios between
components are what shift an architecture.

## Powers of two (data volume)

Storage and memory are base-2; network/disk *marketing* sizes are base-10. Keep
both in mind, but for estimates the approximate value is enough.

| Power | ≈ Value | Unit |
|---:|---|---|
| 2^10 | 1 Thousand | 1 KB |
| 2^20 | 1 Million | 1 MB |
| 2^30 | 1 Billion | 1 GB |
| 2^40 | 1 Trillion | 1 TB |
| 2^50 | 1 Quadrillion | 1 PB |

Seconds in a day ≈ **86,400 ≈ 10^5**. This single rounding (`/100,000`) turns
"per day" into "per second" fast.

## Latency numbers (order of magnitude)

| Operation | ≈ Time |
|---|---:|
| L1 cache reference | ~1 ns |
| L2 cache reference | ~3 ns |
| L3 cache reference | ~13 ns |
| Main memory reference | ~100 ns |
| Compress 1 KB | ~1–3 µs |
| Read 1 MB sequentially from **memory** | ~3–10 µs |
| SSD random read | ~16 µs |
| Read 1 MB sequentially from **SSD** | ~50–200 µs |
| Round trip within same datacenter | ~500 µs |
| Disk seek | ~2–10 ms |
| Read 1 MB sequentially from **disk** | ~1–30 ms |
| Network round trip cross-continent | ~70–150 ms |

Takeaways: memory is fast, disk is slow — **avoid disk seeks**; compression is
cheap, so **compress before sending over the network**; **cross-region hops are
expensive** (~100 ms), so keep chatty traffic in one datacenter.

## Request types (the 1× / 10× / 100× rule)

Real requests are CPU-bound, memory-bound, or IO-bound. Approximate the gap as
orders of magnitude:

| Type | Limited by | Example | Relative time |
|---|---|---|---|
| CPU-bound | processing | compress 1 KB | **1×** |
| Memory-bound | memory subsystem | read 1 MB from RAM | **~10×** |
| IO-bound | disk / network | read 1 MB from disk | **~100×** |

If a CPU task takes `X`, treat memory as `10X` and IO as `100X`. This tells you
where a request actually spends its time, and which resource to add.

## Per-server throughput (QPS) rates

Approximations — real numbers vary with query type (point vs range), schema,
indexing, and load. Use them as divisors for "how many servers?".

| Component | ≈ QPS one node handles |
|---|---:|
| MySQL / RDBMS | ~1,000 |
| Key-value store | ~10,000 |
| Cache server (Redis/Memcached) | ~100,000 – 1,000,000 |

## Typical commodity server (a grounding reference point)

| Component | Spec |
|---|---|
| Processor | modern server-class CPU (e.g. Intel Xeon) |
| Cores | ~64 |
| RAM | ~256 GB |
| L3 cache | ~100 MB |
| Storage | ~16 TB |

Server roles differ in their resource profile:
- **Web servers** — first hop after the load balancer; handle API calls;
  CPU-leaning, moderate RAM/storage.
- **Application servers** — run business logic / dynamic content; heavy CPU and
  RAM, large hybrid storage.
- **Storage servers** — large disk (up to ~120 TB each), modest RAM (~32 GB);
  hold blobs, queues, tables, and metadata.

One CPU core executes ~**1,000** simple requests/s (see the derivation in
`estimation-recipes.md`), so a 64-core box ≈ **64,000** req/s of pure compute —
before IO. Most real services are IO-bound, so the per-server *QPS* rates above
(bounded by the datastore) usually dominate.

## Availability ("nines")

| Availability | Downtime / year | Downtime / month |
|---:|---|---|
| 99% | ~3.65 days | ~7.3 hours |
| 99.9% | ~8.76 hours | ~43.8 minutes |
| 99.99% | ~52.6 minutes | ~4.4 minutes |
| 99.999% | ~5.26 minutes | ~26 seconds |

Cloud SLAs are typically 99.9%+. Each extra nine costs disproportionately more
(redundancy, multi-region, automated failover) — tie the target to the
requirement, not to ambition. → `resilience-failure`.
