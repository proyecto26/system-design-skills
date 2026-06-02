# Eval iteration 2 — testing the post-audit changes

Run after the alignment audit + fixes: the 4 confirmed-error fixes, the new
`service-decomposition` block, the "Common compositions as falsifiable
hypotheses" + constraint-cascade synthesis surface, and `docs/study-path.md`.
Method: same as iteration-1 (with-skill vs baseline + a judge on the 6 GUIDE
behaviors, 0–5 each / 30). Two designs: WhatsApp (regression vs iteration-1) and a
decomposition-heavy food-delivery design (exercises the new block + synthesis).

## Scorecard

| Run | clarify | quant | trade-off | failure | pivot | API/data | **Total** |
|---|--:|--:|--:|--:|--:|--:|--:|
| WhatsApp — with-skill | 5 | 5 | 5 | 5 | 5 | 5 | **30/30** |
| Food-delivery — with-skill | 5 | 5 | 5 | 5 | 5 | 5 | **30/30** |
| Food-delivery — baseline (no skill) | 4 | 5 | 5 | 5 | 5 | 4 | **28/30** |

## WhatsApp — regression: SAME score, materially stronger (both iter-1 gaps closed)
- Composition real — 11 skills consulted (`system-design`, `requirements-scoping`,
  `back-of-the-envelope`, `data-storage`, `api-design`, `messaging-streaming`,
  `consistency-coordination`, `scaling-evolution`, **`blob-store`**,
  **`content-delivery`**, **`sequencer`**).
- **Iteration-1 gap #1 (media) → CLOSED:** media routed off the message store to an
  S3-style `blob-store` (pre-signed upload + pointer-in-message + signed download),
  fronted by a pull CDN with immutable long-TTL URLs (`content-delivery`) — kills
  the egress-storm failure mode.
- **Iteration-1 gap #3 (unique IDs) → CLOSED:** routed to `sequencer` with a
  concrete Snowflake layout (41 ts | 10 node | 12 seq), node-ID leasing,
  clock-rewind refusal, and the key insight that the monotonic ID is the **sort**
  key (shard by `conversation_id`) to avoid a hot shard.

## Food-delivery — exercises the new capabilities
- Composition: `requirements-scoping`, `back-of-the-envelope`, `api-design`,
  `data-storage`, `messaging-streaming`, `consistency-coordination`,
  `resilience-failure`, `scaling-evolution` (+ service-decomposition reasoning).
- **`service-decomposition` invoked AND right-sized ✅** — weighed the
  over-decomposition / "service per noun" **counter-force** and landed on ~4
  services driven by real seams (team independence + the ~100× location-write
  asymmetry), *not* microservices-by-default.
- **Constraint-cascade synthesis fired ✅** — Round-3 "payments must be exactly
  correct" traced as a five-ripple cascade: `api-design` (idempotency key) →
  `data-storage` (atomic key + append-only ledger) → `consistency-coordination`
  (strong + saga, not 2PC) → `messaging-streaming` (outbox + at-least-once + DLQ)
  → `resilience-failure` (fail-closed + reconciliation backstop).

## A/B read (the skill's measurable lift)
The baseline (no skill) is already strong (**28/30**) — the model reaches most
load-bearing insights unaided. The skills add **+2**, concentrated in **sharper
up-front clarification** and **more concrete, explicitly-shaped API contracts**
(cursor signatures, request/response bodies). Conclusion: the skills add
*precision and completeness on top of already-solid reasoning*, rather than
rescuing a weak answer — and they reliably drive composition + the
counter-force/cascade behaviors the GUIDE rewards.

## Verdict
Changes **validated, no regression.** WhatsApp holds 30/30 with both iteration-1
gaps closed; the new `service-decomposition` block and the synthesis surface both
demonstrably work (right-sized decomposition + a real cross-block cascade). The
full transcripts are not committed (kept out of the repo for self-containment);
this summary is the durable record.
