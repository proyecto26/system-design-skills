# Evals — capturing realistic evals for this plugin

How we measure whether the skills actually make Claude design better, and how to
keep those measurements *realistic* (not exam-question theater).

## What we measure (one rubric, reused everywhere)

The **6 behaviors** the failure-mode guide (`../../docs/GUIDE.md`) rewards, scored
0–5 each (total /30). Defined once here and in `evals.json` — never re-authored:

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

## Portable checks — `run_checks.py` (runs on any machine)

The deterministic, unattended part of the suite ships in the repo and is
**machine-independent**: it resolves the repo root from its own location
(`__file__`), so there are **no hardcoded paths**.

```bash
python3 meta/evals/run_checks.py     # from a clone, any machine, any cwd
```

It runs three checks and exits non-zero on failure (CI-friendly):
1. **BOTEC golden fixture** — the calculator matches `expected_outputs/twitter_scale.json`.
2. **Eval data integrity** — `evals.json` + `trigger-evals.json` parse and keep the
   6-behavior rubric and exercise/query shape.
3. **Self-containment invariant** — *no committed file contains a machine-specific
   absolute home path* (a macOS `Users`, Linux `home`, or Windows `C:\Users`
   directory prefix). The "references nothing
   outside the plugin" rule, enforced as a test.

> Why a self-locating stdlib script (not a workflow with absolute paths): bundled
> code must resolve from its own location (`__file__` / `dirname`) or
> `${CLAUDE_PLUGIN_ROOT}` — never a user-specific path — so it's portable across
> clones and machines. `botec.py` / `test_botec.py` follow the same rule.

## Artifacts

- **`evals.json`** — the realistic, multi-turn exercise set (the single home).
- **`trigger-evals.json`** — should/should-not routing queries.
- **`iteration-1/`, `iteration-2/`** — recorded runs (`SUMMARY.md` scorecards;
  iteration-1 also keeps the `with_skill.md`/`baseline.md`/`verdict.json`
  regression baseline). Transcripts are kept lean and path-free.
- **LLM-judge harness** (the with-skill-vs-baseline + judge grading) is an
  *agent-driven method*, documented below — it needs an agent runtime, so it ships
  as a portable **procedure**, not a machine-specific script. When it needs the
  plugin's own files, reference them via **`${CLAUDE_PLUGIN_ROOT}`** (installed
  plugin) or a path **discovered at runtime** from the repo — never a hardcoded
  home-directory path.

## How to run another iteration

1. Pick exercises from `evals.json`; deliver them multi-turn (with-skill vs
   baseline subagents), ≥3× each.
2. Judge each on the 6 behaviors + composition; for objective behaviors prefer a
   script/assertion over a judgment.
3. Diff `verdict.json` against the prior iteration; assert no behavior regresses
   and the prior gap list improves.
4. Record the scorecard + new gaps in `iteration-N/SUMMARY.md`.
