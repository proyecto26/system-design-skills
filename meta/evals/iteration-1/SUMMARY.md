# Eval iteration 1 — WhatsApp exercise (with-skill vs baseline)

Method: skill-creator-style. Both agents got the same 3-round WhatsApp exercise.
The with-skill agent was pointed at the plugin and instructed to use the
`system-design` orchestrator + block skills as if installed; the baseline got the
exercise only. A judge scored both on the GUIDE rubric (0–5 per behavior).

## Scorecard

| Behavior | with-skill | baseline |
|---|---:|---:|
| Clarify first (FR/NFR/scope) | 5 | 3 |
| Quantified estimates (BOTEC) | 5 | 4 |
| Trade-off articulation (solves/worsens/when-to-change) | 5 | 3 |
| Failure design (SPOF/degradation/recovery) | 5 | 3 |
| Pivot on constraint (Round 2 scale) | 5 | 3 |
| Concrete API & data model | 5 | 4 |
| **Total** | **30/30** | **20/30** |

**Winner: with-skill.** Composition was real (`block_invocation_real: true`):
the run loaded `system-design`, `back-of-the-envelope`, `messaging-streaming`,
`data-storage`, `consistency-coordination`, `api-design`, `resilience-failure`
and reproduced distinctive skill-owned content (PACELC + fencing tokens,
polling→WebSocket push tier + idempotency contract, wide-column key + shard math,
DLQ envelope + oldest-message-age signal) — not just orchestrator framing.

## Where the skill helped most
Ranked breaks-first diagnosis, quantified shard count (1.2M/10k ≈ 120 shards,
showing the R1 partition key scales with no re-keying), solves/worsens/when-to-change
tables, and YAGNI discipline (actively rejected Kafka on the hot 1:1 path).

## Where the baseline matched or beat it (honest)
Core architecture and the Round-3 ordering choice converged. Baseline independently
raised **CRDT state convergence** (read-cursors, tombstones, LWW edits) and
**key-transparency / CONIKS**, which the with-skill run did NOT — a couple of
crypto/state-convergence specifics where baseline was richer.

## Prioritized improvement backlog (iteration 2 candidates)
1. **Media path silently dropped** — the run loaded 6 blocks but not
   `content-delivery`, though media was in scope. The orchestrator should flag
   media as an in-scope sub-design or explicitly defer it with a reason.
2. **Mutable state convergence missing** — message ordering is handled, but not how
   receipts/edits/deletes/reactions converge across devices. Add a
   state-convergence note to `consistency-coordination`'s deep-dive; have the
   orchestrator prompt for non-message state in chat/collab designs.
3. **Trust/keys gap** — no block owns key-transparency / malicious-server-injects-a-
   device. Consider a thin "trust-and-keys" reference or a pointer from `api-design`/
   `consistency-coordination`.
4. **Retention window not sized** — the delete-on-delivery + week-offline seam is
   named but not BOTEC'd. `back-of-the-envelope` should co-fire to size it.
5. **Per-conversation sequencer cap asserted, not worked** — `consistency-coordination`
   + `back-of-the-envelope` should co-fire to quantify when one hot conversation
   breaks its single sequencer.

Artifacts: `with_skill.md`, `baseline.md`, `verdict.json` in this directory.
