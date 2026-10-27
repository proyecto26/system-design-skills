---
type: llm
weight: 3
---

PASS only if ALL of these hold:
1. Chooses a limiting algorithm (token bucket, sliding-window log/counter, fixed window) and states its trade-off (burst tolerance, memory, boundary accuracy).
2. Explicitly addresses the hot-key / shared-counter problem for a single global per-key limit across 100 nodes, with a concrete technique: sharded counters, local token pre-allocation/leases synced periodically, or approximate counting with a stated accuracy bound.
3. Discusses what happens when the shared counter store is slow or down (fail-open vs fail-closed, with which it picks and why).
4. Uses at least one number from the prompt in reasoning (1M req/s, 100 nodes, 1,000 req/min) to size or justify the approach.

FAIL if it proposes one central Redis INCR per request with no discussion of the hot key at this load.
