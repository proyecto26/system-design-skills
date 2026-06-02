# System Design study path (interview prep)

A sequenced way to *prepare* with this plugin — learn → drill → self-test. It only
**links** material that already lives in the plugin (nothing is restated here), so
there's one home per topic. (This is a docs/ guide, not a skill — skills stay
self-contained; this is the connective tissue a candidate uses to study.)

## 1. Internalize the method (the muscle memory)
- The **reasoning loop** (clarify → estimate → design → trade-offs → failure →
  iterate) with the 45-minute time budget: the `system-design` skill →
  `references/reasoning-loop.md`. This is the 4-step interview framework, expanded.
- The **collaboration / pivot** stance: `references/collaboration-playbook.md`.

## 2. Know the mistakes (and the self-score bar)
- The ten failure modes that sink interviews, each with an antidote, plus the
  **0–5 quality bar** and the **Quick Diagnostic** (Question → which skill to
  invoke): the `system-design` skill → `references/failure-modes.md`.
- The original source narrative: `docs/GUIDE.md`.

## 3. Memorize the numbers (back-of-the-envelope)
- The cheat sheet (powers of two, latency table, per-server QPS, nines, request
  types): the `back-of-the-envelope` skill → `references/numbers-to-remember.md`.
- Worked chains + a runnable calculator: `references/estimation-recipes.md` and
  `scripts/botec.py` (+ `test_botec.py`).

## 4. Study the building blocks (bottom-up syllabus)
Work the catalog in dependency order — the L0→L7 layering in the `system-design`
skill → `references/building-blocks-index.md` is your syllabus. For each block,
read its SKILL.md (options · trade-offs · behavior-under-stress · how-to-apply ·
dos/don'ts) and its `references/deep-dive.md`. Start with the always-needed
foundations (`requirements-scoping`, `back-of-the-envelope`, `api-design`), then
the rest as topics arise. **`service-decomposition` is conditional, not a default
early step** — after scope, numbers, and API/data shape, reach for it *only* when
a real driver appears (independent deploy/scale/ownership, cross-service
consistency, gateway/discovery, or excessive chattiness); many prompts should stay
a monolith / modular monolith (GUIDE #7).

## 5. Build a clarifying-question reflex
- The reusable catalog: the `requirements-scoping` skill → its clarifying-question
  reference, plus every block's own "Clarify first" section.

## 6. Drill on practice problems, then self-score
- The practice bank: `meta/evals/evals.json` — 6 multi-turn exercises (URL
  shortener, rate limiter, news feed, observability pipeline, typeahead, WhatsApp),
  each with the building blocks it *should* compose and what-good-looks-like
  assertions. Deliver the turns one at a time (don't read ahead), design your
  answer, then **self-score with the same 6-behavior / 0–5 bar** from
  `failure-modes.md`. A fully worked reference answer + baseline lives in
  `meta/evals/iteration-1/`.
- See `meta/evals/README.md` for how to run a rigorous (with-skill vs baseline)
  comparison.

## Suggested cadence
Method (§1–2) → numbers (§3) in one sitting; then one building-block layer per
session (§4) interleaved with one drill (§6); finish each drill by running the
Quick Diagnostic and noting your weakest dimension to target next.
