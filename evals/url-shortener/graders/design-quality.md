---
type: llm
weight: 3
---

Judge the final answer as a senior system-design interviewer.

PASS only if ALL of these hold:
1. States explicit assumptions or clarifying questions about requirements (read:write ratio, latency target, link expiry/retention, custom aliases) before or alongside the design.
2. Does back-of-the-envelope math with actual numbers: write QPS (~10k/s), read QPS (billions/day ≈ tens of thousands/s average, higher at peak), storage over a stated retention, and key space (e.g. base62 length needed).
3. Picks a key-generation approach (counter/range allocation + base62, hash + collision handling, or Snowflake-style IDs) AND names what it costs or when it would change, not just the choice.
4. Addresses at least one concrete failure mode (cache stampede / hot link, ID-allocator outage, DB partition loss, region failure) with a mitigation.
5. Gives a concrete API or data model (e.g. POST /links → 201 with short code; GET /{code} → 301/302 with the 301-vs-302 trade-off; a links table/key schema).

FAIL if any item is missing or hand-waved (e.g. "use a cache" with no reasoning, no numbers at all).
