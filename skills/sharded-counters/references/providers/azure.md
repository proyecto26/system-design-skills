# Sharded counters — Azure

Only the contention/atomicity differences that change the recipe. Default to the
generic recipe; this maps it to Azure services.

## Service mapping
- **Cosmos DB atomic increment** — a patch/partial-update `Increment` on a numeric
  property updates one item atomically within its logical partition. The
  single-counter option.
- **Cosmos DB + write sharding** — spread the count across N logical partition
  keys (`id#shard{rand(0..N-1)}`), increment a random shard, and sum the N items
  on read. The striped-counter recipe and the fix for a hot logical partition.
- **Azure Cache for Redis** — managed Redis for the fast path: `INCR`,
  HyperLogLog, key sharding. Use for microsecond tallies and built-in HLL.

## When to pick which
Cosmos DB atomic increment when the item is durable system-of-record and the
count fits one logical partition's throughput; Cosmos write-sharding when one
partition key goes hot; Azure Cache for Redis when the count is a fast/ephemeral
tally or needs HLL.

## Limits / things that bite (verify against current docs)
- A Cosmos DB **logical partition** has a throughput ceiling (provisioned RU/s per
  partition, plus a per-logical-partition cap) — concentrating increments on one
  partition key creates a hot partition that throttles (429s) regardless of total
  RU/s. Write-sharding the key is the fix.
- Every increment consumes RU/s; a high-write counter's cost scales with write
  rate, and the N-shard read consumes RU/s per item read.
- Cross-partition reads (summing N shards) fan out and cost more RU/s than a
  single-partition read.
- Multi-region writes use conflict resolution; concurrent increments across
  regions need last-writer-wins care or a custom merge — prefer per-region shards
  summed centrally.

## Pitfalls
- Leaving a viral counter on one partition key and hitting 429 throttling — shard
  the key across logical partitions.
- Under-provisioning RU/s for the write spike on the hottest counter.
- Assuming multi-region writes simply add increments — they can conflict; design
  per-region shards.
- Lock-in: Cosmos partition-key layout and RU model don't port directly to other
  clouds.
