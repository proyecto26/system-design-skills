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

## Findings (2026-10-27, judge: sonnet, 3 runs/arm)

| Case | With | Without | Δ |
|---|---|---|---|
| url-shortener | 1.00 | 0.00 | **+1.00** |
| over-decomposition-trap | 0.87–1.00 | 0.60 | **+0.27 … +0.40** |
| rate-limiter | 0.83–1.00 | 0.67 | **+0.17 … +0.33** |
| focused-component | 1.00 | 0.67 | **+0.33** |
| capacity-estimate | 1.00 | 1.00 | 0 |
| out-of-scope | 1.00 | 1.00 | 0 (correctly never fires) |

Ranges span the two final runs; single disagreeing judge votes account for the spread.

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
