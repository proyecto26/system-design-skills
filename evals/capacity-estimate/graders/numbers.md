---
type: llm
weight: 3
---

Ground truth: 100M × 40 = 4B messages/day. 4e9 / 86,400 ≈ 46k writes/sec average (accept 40k–50k); peak 3× ≈ 139k/s (accept 120k–150k). Storage 4B × 1 KB ≈ 4 TB/day (accept 3.7–4.1 TB, binary or decimal); 5 years ≈ 7.3 PB (accept 6.5–7.5 PB) before replication.

PASS only if ALL of these hold:
1. Average and peak write QPS fall in the accepted ranges.
2. Daily and 5-year storage fall in the accepted ranges, AND it applies replication explicitly with a number (e.g. RF=3 → ~22 PB), not just a mention.
3. Shows the arithmetic (not just final numbers).
4. States its assumptions (e.g. uniform distribution, metadata included, no compression) and draws a database implication from the numbers (e.g. needs horizontal partitioning / a write-optimized wide-column or LSM store; a single relational node won't hold petabytes), not a generic list.

FAIL if any number is outside its range or the answer gives numbers with no derivation.
