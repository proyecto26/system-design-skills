# `claude plugin eval` suite

With-vs-without ablation for this plugin: every case runs with the plugin loaded and again
without it, so the score delta (Δ) is the value the skills add. Complements the
multi-turn, judge-driven study in `meta/evals/` and the deterministic `run_checks.py`.

```bash
claude plugin eval . --runs 1                        # pilot (~$1.50)
claude plugin eval . --judge-model sonnet            # full: 6 cases × 3 runs × 2 arms (~$8–9)
claude plugin eval . --tag design                    # just the three open-ended designs
```

Results land in `evals/results/` (gitignored): `aggregate-result.json` + a self-contained `report.html`.

## Cases

| Case | Probes | Scored graders |
|---|---|---|
| `url-shortener` | open-ended design → orchestrator loop | design quality, trade-off discipline |
| `rate-limiter` | hot-key problem; `resilience-failure` + `sharded-counters` + `api-design` | design quality, 429 + `Retry-After` (regex), trade-off discipline |
| `over-decomposition-trap` | the "impressive" microservices answer must lose | right-sized (modular monolith), trade-off discipline |
| `capacity-estimate` | BOTEC numbers with accepted ranges | numbers |
| `focused-component` | single-block question must stay focused | answer |
| `out-of-scope` | negative: no plugin skill may fire (`arm: both`) | correct, no-design-skill |

Every positive case also has a `skill-fired` indicator (`tool_used: Skill`, unscored in two-arm runs).
`tradeoff-discipline` asks for ≥3 decisions with solves / worsens / when-to-change + a self-check — the
plugin's own trade-off framework, made observable.

## Findings (2026-10-27, judge: sonnet, 3 runs/arm, plugin = skills as of `8ecd972`)

Per-run scores (each run is the weighted fraction of scored graders that passed):

| Case | With (runs) | Without (runs) | Δ | Notes |
|---|---|---|---|---|
| url-shortener | 1, 1, 1 | 0, 0, 0 | **+1.00** | baseline fails design quality and discipline every run |
| over-decomposition-trap | 1, 0.6, 1 | 0.6, 0.6, 0.6 | **+0.27** | one with-run unanimously failed trade-off discipline (a real 1-in-3 miss) |
| rate-limiter | 0.5, 1, 1 | 0.67 ×3 | **+0.17** | one with-run lost design quality on a 1–2 judge split |
| focused-component | 1, 1, 1 | 1, 1, 1 | 0 | value here is routing only: `caching` fires 3/3 |
| capacity-estimate | 1, 1, 1 | 1, 1, 1 | 0 | baseline arithmetic already correct |
| out-of-scope | 1, 1, 1 | 1, 1, 1 | 0 | negative case: no plugin skill fired |

Targeted re-runs of rate-limiter and over-decomposition (same skills) scored 1, 1, 1 with the plugin
(Δ +0.33 / +0.40). With 3 runs per arm, a single miss moves a case by a third of a point, so read these
as a range (rate-limiter +0.17 to +0.33, over-decomposition +0.27 to +0.40), not a point estimate.

**Judge errors invalidate a run; they are not answer failures.** An earlier focused-component run showed
Δ +0.33 only because one baseline judgment failed with `529 Overloaded` and scored 0; the re-run (rubric as
committed) is 1.00 vs 1.00. Before citing a result, check every `llm` grader has `judgeVotes`.

What the suite changed in the plugin:
1. **Pilot: Δ = 0 everywhere, skills fired in only 2/5 positive cases.** Sharpened the `caching`,
   `service-decomposition` and `back-of-the-envelope` descriptions → caching and service-decomposition
   now fire 3/3.
2. **Trade-off discipline failed in both arms** — the method said "solves / worsens / when-to-change"
   but answers didn't show it. Added the `system-design` **Answer contract** (decisions table + weakest
   point) and a closing "show the trade-off in the answer" step to every component block's *How to apply*;
   `run_checks.py` guards both. Discipline now passes with the plugin and fails without it.

Open: `back-of-the-envelope` still rarely fires for a self-contained arithmetic question — the baseline
gets those numbers right anyway, so there is no score at stake there.
