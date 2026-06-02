# Evals — capturing realistic evals for this plugin

How we measure whether the skills actually make Claude design better, and how to
keep those measurements *realistic* (not exam-question theater).

## What we measure (one rubric, reused everywhere)

The **7 behaviors** the failure-mode guide (`../../docs/GUIDE.md`) rewards, scored
0–5 each (total /35). Defined once here and in `evals.json` — never re-authored:

`clarify_first` · `quantified_estimates` · `tradeoff_articulation` ·
`failure_design` · `pivot_on_constraint` · `concrete_api_data` · `composition`

**`composition`** asks: did the orchestrator actually *invoke* the owning
building-block skills — citing their `SKILL.md` content — rather than paraphrase
from memory? This is the plugin's thesis. It was scored *off-total* through
iteration-3, but that **understated the skill's lift** (with-skill landed 5 every
run, baseline 0–1 by construction), so it is now **folded into the /35 total**. A
no-skill baseline scores low here by design — which is the point: it's the
dimension where the plugin's distinctive value shows up.

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

It runs these checks and exits non-zero on failure (CI-friendly):
1. **BOTEC golden fixture** — the calculator matches `expected_outputs/twitter_scale.json`.
2. **Eval data integrity** — `evals.json` + `trigger-evals.json` parse and keep the
   7-behavior rubric and exercise/query shape; the trigger near-misses that
   disambiguate `service-decomposition` / `messaging-streaming` / `api-design`
   are present; and `judge-controls.json` carries both polarities with disjoint
   score bands (see *Judge calibration* below).
3. **Self-containment invariant** — *no committed file contains a machine-specific
   absolute home path* (a macOS `Users`, Linux `home`, or Windows `C:\Users`
   directory prefix). The "references nothing
   outside the plugin" rule, enforced as a test.
4. **Regression guards** — principle #6 made executable. Each defect a review has
   caught once is frozen as a fail→pass assertion so it can't silently return:
   the catalog-count invariant (the number `/design` advertises **==** the count
   of building-block skills on disk, i.e. `skills/` minus `system-design` and
   `architecture-diagram`), `/design` routing to `service-decomposition`,
   `study-path` keeping that block *conditional* (not an always-needed
   foundation), and the corrected `service-decomposition` latency math (10 serial
   same-DC hops are ~5 ms of *network*, not a 200 ms budget "on network alone").
   When you fix a future audit finding, add its guard here.

## Judge calibration — the negative control (`judge-controls.json`)

A rubric that scores every answer at the ceiling measures nothing — and earlier
iterations pinned at the top, which is exactly when a regression would hide. Before
trusting a judged iteration, run the two controls (one **strong**, one
deliberately **weak**, same prompt) through the *same* judge + rubric used on
`evals.json`. The judge passes calibration only if the strong control lands in its
expected band (≥28/35) and the weak one in its disjoint lower band (≤14/35). If the
judge can't separate them, its scores on the real exercises are noise and the
iteration is **void**. `run_checks.py` validates the data shape; the ranking itself
is graded in the agent-driven harness.

> **Breaking the ceiling.** The `over-decomposition-trap` exercise in `evals.json`
> is built so the *impressive-looking* answer (microservices-by-default + Kafka
> everywhere at 2k orders/day) should **lose** points — the GUIDE #7 counter-force
> is the load-bearing behavior. An exercise where a top score is not automatic is what
> lets the suite measure regression rather than just confirm competence.

> Why a self-locating stdlib script (not a workflow with absolute paths): bundled
> code must resolve from its own location (`__file__` / `dirname`) or
> `${CLAUDE_PLUGIN_ROOT}` — never a user-specific path — so it's portable across
> clones and machines. `botec.py` / `test_botec.py` follow the same rule.

## Artifacts

- **`evals.json`** — the realistic, multi-turn exercise set (the single home),
  including the `over-decomposition-trap` ceiling-breaker.
- **`trigger-evals.json`** — should/should-not routing queries, with the
  decomposition vs messaging-streaming vs api-design near-misses.
- **`judge-controls.json`** — the strong/weak judge calibration pair.
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

0. **Calibrate the judge** (principle: a judge that can't fail can't grade). Run
   `judge-controls.json` first; if the strong/weak bands aren't cleanly separated,
   stop — fix the judge before grading anything real.
1. Pick exercises from `evals.json`; deliver them multi-turn (with-skill vs
   baseline subagents), **≥3× each** (principle #5 — n=1 deltas are noise).
2. Judge each on the 7 behaviors (composition included in the /35 total); for
   objective behaviors prefer a script/assertion over a judgment.
3. Diff `verdict.json` against the prior iteration; assert no behavior regresses
   and the prior gap list improves.
4. Record the scorecard + new gaps in `iteration-N/SUMMARY.md`, **and add any
   newly-fixed gap as a guard in `run_checks.py`** (principle #6).

### `verdict.json` — record variance, not point estimates

The ≥3× rule only bites if the recorded numbers carry it. For each config, store
the per-run totals and their aggregate so a reader can tell signal from noise:

```json
{
  "exercise": "over-decomposition-trap",
  "config": "with_skill",
  "runs": [27, 29, 28],
  "mean": 28.0,
  "stddev": 0.82,
  "n": 3
}
```

A delta between two configs is only reportable when it clears the combined
stddev — otherwise label it "within noise". Earlier iterations recorded a single
run (`n=1`); treat those scorecards as directional, not as measured deltas.
