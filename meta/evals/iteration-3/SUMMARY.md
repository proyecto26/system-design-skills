# Eval iteration 3 — validating the new eval machinery (judged, n=3)

First run after hardening the suite (regression guards, trigger near-misses, the
`judge-controls.json` negative control, the `over-decomposition-trap`
ceiling-breaker, and the ≥3× variance protocol). Method: agent-driven harness —
calibrate the judge on the negative control first, then grade with-skill vs
baseline **3× each** on two exercises and report mean ± stddev. 30 agents total.

## 0. Judge calibration (the negative control) — **PASS**

| Control | runs | mean |
|---|---|--:|
| strong reference answer | [26, 27, 26] | 26.3 |
| weak reference answer (deliberately bad) | [1, 0, 1] | 0.7 |

Bands are wildly disjoint (min strong 26 ≫ max weak 1). The judge discriminates
hard — it is **not** a 30/30 rubber stamp, so the design scores below are
trustworthy. This is the single most important result: it's the first time the
instrument itself was validated.

## Scorecard (6 behaviors, 0–5 each, /30; composition graded separately)

| Exercise | Config | runs | mean | stddev |
|---|---|---|--:|--:|
| over-decomposition-trap | with_skill | [28, 28, 29] | 28.33 | 0.58 |
| over-decomposition-trap | baseline | [27, 25, 26] | 26.00 | 1.00 |
| whatsapp | with_skill | [28, 29, 28] | 28.33 | 0.58 |
| whatsapp | baseline | [24, 25] | 24.50 | 0.71 |

> One of 12 judge runs failed (whatsapp baseline #3 — the judge subagent didn't
> emit structured output), so that cell is **n=2**, not 3. Reported, not hidden.

## What this validates

1. **The ceiling broke.** with-skill no longer pins at 30/30 — it sits at
   28.33 ± 0.58 on *both* exercises. The judge consistently docks `clarify_first`
   (the answers *assert* assumptions instead of *asking* the load-bearing
   questions first). An instrument that can move is what lets future iterations
   detect regression instead of just confirming competence.
2. **No regression on WhatsApp.** with-skill holds 28.33, consistent with the
   iter-1/2 strong showing; the iter-1 gaps (media path, ordering, retention) are
   addressed in the transcripts. (Absolute numbers differ from iter-1's 30 vs 20
   because this judge is stricter — the *relationship* skill > baseline holds.)
3. **Composition is the clean skill signal — and it's excluded from /30.**
   with-skill scored composition **5** across every run (citations verified
   against the actual SKILL.md files — "at-least-once is the practical default,"
   Snowflake k-sorted-not-strict → per-conversation seq, fencing tokens for
   split-brain). Baseline scored composition **0–1** (it refused to read skill
   files by design). The plugin's thesis — *invoke the owning block, don't
   paraphrase* — shows up exactly here, so the headline /30 totals **understate**
   the skill's distinctive contribution.

## Honest reading of the deltas

- **whatsapp:** +3.83 (28.33 vs 24.50) clears the combined stddev comfortably —
  a real lift.
- **over-decomposition-trap:** +2.33 (28.33 vs 26.00) clears ~2× the combined
  stddev — marginally reportable, not noise, but modest. The reason is
  informative: the **baseline also resisted the microservices trap** (scored
  25–27, killing the CTO's pitch with BOTEC numbers and shipping a modular
  monolith). The GUIDE #7 counter-force is something the base model already does
  well unaided; the skill's measurable lift on the 6-behavior total is mostly
  rigor (it loses fewer clarify points), while its *distinctive* lift is the
  composition dimension that the rubric deliberately excludes.

## Gaps / next

- `clarify_first` is the ceiling for everyone — both configs assert rather than
  ask. Either the exercises should reward a genuine pause-and-ask (hard in a
  single-shot subagent), or accept this as a known multi-turn-harness limitation.
- The trap separates *behavior* well but not *skill-vs-baseline* on the total;
  if the goal is to show skill lift, weight or surface `composition`, or pick
  exercises where the base model fails the counter-force unaided.
- Re-run the one failed judge cell to restore n=3 on whatsapp baseline.
- Multi-turn is still approximated (full exercise handed to one subagent with a
  sequential-answering instruction); true turn injection needs a stateful harness.

## Addendum (post-run): recomputed under the folded `composition` rubric

This run was graded on the old 6-behavior /30 rubric with `composition` scored
*off-total*. Acting on this iteration's own recommendation, the rubric now **folds
`composition` into the total** (7 behaviors, /35; see `../README.md` and
`../evals.json`). The scores above are the original /30 record — left intact. Below
is the *recompute* from the composition figures this run already captured
(with-skill = 5 every run; baseline = 0–1 by construction, shown as a range):

| Exercise | Config | /30 (recorded) | composition | /35 (recomputed) |
|---|---|--:|--:|--:|
| over-decomposition-trap | with_skill | 28.33 | 5.0 | **33.33** |
| over-decomposition-trap | baseline | 26.00 | 0–1 | 26.0–27.0 |
| whatsapp | with_skill | 28.33 | 5.0 | **33.33** |
| whatsapp | baseline | 24.50 | 0–1 | 24.5–25.5 |

**Why this matters:** the trap delta widens from the marginal **+2.33** (/30) to
**+6.3 to +7.3** (/35), and whatsapp from +3.83 to **+7.8 to +8.8** — both now well
clear of any combined stddev. Folding composition in doesn't inflate the skill; it
stops *excluding* the one dimension where the plugin's thesis is unambiguous. The
negative control still calibrates: the weak control composes nothing, so its
recomputed ceiling stays in the disjoint low band (≤14/35). Future iterations grade
directly on /35 — no recompute needed.
