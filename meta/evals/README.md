# Evals — capturing realistic evals for this plugin

How we measure whether the skills actually make Claude design better, and how to
keep those measurements *realistic* (not exam-question theater).

## What we measure (one rubric, reused everywhere)

The **6 behaviors** the GUIDE rewards, scored 0–5 each (total /30). Defined once in
`whatsapp-eval.workflow.js` and referenced by `evals.json` — never re-authored:

`clarify_first` · `quantified_estimates` · `tradeoff_articulation` ·
`failure_design` · `pivot_on_constraint` · `concrete_api_data`

Plus a **composition check**: did the orchestrator actually *invoke* the owning
building-block skills (not paraphrase from memory)? This is the plugin's thesis,
so it's graded explicitly.

## What makes an eval realistic (the principles)

1. **Multi-turn, not single-shot.** Deliver the rounds sequentially — answer
   Round 1, *then* inject Round 2's constraint. Single-shot lets the model
   pre-plan the pivot, so `pivot_on_constraint` and collaboration can't be told
   from memorization. `evals.json` exercises are structured as `turns[]` for this.
2. **Broad block coverage.** Each exercise *leads with* different blocks
   (`leads_with`) so the suite exercises the catalog, not just one design. One
   exercise touched ~30% of the library; the set targets the rest.
3. **Realistic phrasing.** Mix polished prompts with casual/under-specified ones
   ("help me design the backend for my chat app, maybe a few hundred k users").
4. **Trigger realism.** `trigger-evals.json` tests that the right skill *fires
   from a query* (the descriptions are the real routing mechanism) — including
   sibling near-misses, with the ownership map as the oracle.
5. **Variance.** Run each config ≥3× and report mean ± stddev; n=1 deltas are
   noise.
6. **Regression baseline.** Across iterations, use the *prior skill version* (not
   just no-skill) as a baseline for ≥1 exercise, and turn each iteration's gap
   list into fail→pass assertions.
7. **Deterministic where possible.** The only objectively-scriptable surface is
   `back-of-the-envelope` — its calculator + golden fixture
   (`skills/back-of-the-envelope/scripts/`) are checked by diff, not judged.

## Artifacts

- **`evals.json`** — the realistic, multi-turn exercise set (the single home;
  the content eval reads from here).
- **`trigger-evals.json`** — ~20 should/should-not routing queries.
- **`iteration-1/`** — the first run: `with_skill.md`, `baseline.md`,
  `verdict.json` (with-skill 30/30 vs baseline 20/30, composition real),
  `SUMMARY.md` (scorecard + gap backlog). Kept as the regression baseline.
- Workflows: `../whatsapp-eval.workflow.js` (with-skill vs baseline + judge),
  `../research-validate.workflow.js` (feature-migration + eval + workflow audit).

## How to run another iteration

1. Pick exercises from `evals.json`; deliver them multi-turn (with-skill vs
   baseline subagents), ≥3× each.
2. Judge each on the 6 behaviors + composition; for objective behaviors prefer a
   script/assertion over a judgment.
3. Diff `verdict.json` against the prior iteration; assert no behavior regresses
   and the prior gap list improves.
4. Record the scorecard + new gaps in `iteration-N/SUMMARY.md`.
