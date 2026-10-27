---
type: llm
weight: 3
---

PASS only if ALL of these hold:
1. Gives a direct recommendation: TTL (e.g. 30-minute, sliding/refreshed on access) is the correctness mechanism for session expiry, and a `maxmemory` policy is the memory-pressure safety net — they are complementary, not either/or. Any reasoned policy counts: volatile-lru, volatile-ttl, allkeys-lru, or noeviction paired with memory alerting.
2. Names the risk of relying on LRU alone (an active user's session can be evicted under memory pressure → surprise logouts) or of TTL alone with noeviction (writes fail when memory is full).
3. Includes a quick sizing sanity check using ~2M sessions (e.g. per-session bytes × 2M → memory needed).
4. Stays focused: does NOT produce a full end-to-end system design (requirements phase, API design, load balancers, multi-service architecture). A short trade-off table or a "what breaks first" note about this cache is in scope, not ballooning.

FAIL if it picks only one with no mention of the other, or turns into a whole-system design.
