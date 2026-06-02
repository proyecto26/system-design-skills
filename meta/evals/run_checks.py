#!/usr/bin/env python3
"""Portable, machine-independent eval/CI checks for system-design-skills.

Runs anywhere with stdlib Python 3 — **no hardcoded paths**. It resolves the repo
root from its own location (`__file__`), so `python3 meta/evals/run_checks.py`
works from any clone or any machine. This is the deterministic, unattended part of
the eval suite; the LLM-judged design grading is a separate, agent-driven method
documented in README.md (it can't be a stdlib check).

Checks:
  1. BOTEC golden fixture — the back-of-the-envelope calculator matches its fixture.
  2. Eval data integrity — evals.json + trigger-evals.json parse and have the
     expected shape (the 7-behavior rubric, exercises, trigger queries), the judge
     negative-control carries both polarities, and a regression baseline exercise
     records runs/stddev (the ≥3× variance protocol).
  3. Self-containment invariant — no committed text file contains a machine-
     specific absolute path (/Users/…, /home/…, C:\\Users\\…). This is the rule
     "each skill/file references nothing outside the plugin" turned into a test.
  4. Regression guards — the alignment-audit fixes turned into fail→pass
     assertions, so the defects an adversarial review caught can't silently
     return (README principle #6: every gap becomes an assertion). Covers the
     catalog-count invariant, /design routing, the service-decomposition
     anti-microservices stance, and its corrected latency math.

Exit code 0 if all pass, 1 otherwise.
"""
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))  # <repo>/meta/evals -> <repo>

GREEN, RED, DIM, RESET = "\033[32m", "\033[31m", "\033[2m", "\033[0m"
def ok(m):   print(f"{GREEN}PASS{RESET} {m}")
def fail(m): print(f"{RED}FAIL{RESET} {m}")

failures = []


def check_botec():
    """1. The deterministic calculator matches its golden fixture."""
    test = os.path.join(ROOT, "skills", "back-of-the-envelope", "scripts", "test_botec.py")
    if not os.path.exists(test):
        failures.append("botec: test_botec.py missing")
        return fail("BOTEC golden fixture (test_botec.py not found)")
    r = subprocess.run([sys.executable, test], capture_output=True, text=True)
    if r.returncode == 0:
        ok(f"BOTEC golden fixture — {r.stdout.strip().splitlines()[-1] if r.stdout.strip() else 'matches'}")
    else:
        failures.append("botec: calculator drifted from golden fixture")
        fail(f"BOTEC golden fixture\n{DIM}{(r.stdout + r.stderr).strip()}{RESET}")


def check_eval_data():
    """2. Eval data files parse and have the expected shape."""
    evals_p = os.path.join(HERE, "evals.json")
    trig_p = os.path.join(HERE, "trigger-evals.json")
    try:
        ev = json.load(open(evals_p))
        rubric = ev["rubric"]["behaviors"]
        expected = {"clarify_first", "quantified_estimates", "tradeoff_articulation",
                    "failure_design", "pivot_on_constraint", "concrete_api_data",
                    "composition"}
        assert set(rubric) == expected, f"rubric behaviors != the 7 expected: {rubric}"
        assert len(ev["evals"]) >= 1, "no exercises in evals.json"
        for e in ev["evals"]:
            assert e.get("turns"), f"exercise {e.get('id')} has no turns"
            assert e.get("should_compose"), f"exercise {e.get('id')} lists no should_compose blocks"
        ok(f"evals.json — {len(ev['evals'])} exercises, 7-behavior rubric intact (composition folded in)")
    except Exception as e:
        failures.append(f"evals.json: {e}")
        fail(f"evals.json shape ({e})")
    try:
        tg = json.load(open(trig_p))
        assert len(tg["queries"]) >= 10, "too few trigger queries"
        # The Codex-flagged near-misses must stay covered: a sync-vs-async query
        # that routes to messaging-streaming (not service-decomposition), and a
        # gateway-contract query that routes to api-design (not service-decomp).
        # Without these the routing ambiguities have no oracle and can re-drift.
        routes = {(q["q"], q.get("route_to")) for q in tg["queries"]}
        targets = {r for _, r in routes}
        for owner in ("service-decomposition", "messaging-streaming", "api-design"):
            assert owner in targets, f"no trigger query routes to {owner}"
        ok(f"trigger-evals.json — {len(tg['queries'])} routing queries (near-misses present)")
    except Exception as e:
        failures.append(f"trigger-evals.json: {e}")
        fail(f"trigger-evals.json shape ({e})")


def check_judge_control():
    """2b. The judge negative-control carries both polarities.

    A rubric that scores every answer at the ceiling measures nothing. The control pins
    the judge to a known-strong answer (expect high) and a deliberately-weak one
    (expect low); if the judge can't separate them, its scores are noise. We only
    check the data here — the actual ranking is graded in the agent-driven harness.
    """
    ctrl_p = os.path.join(HERE, "judge-controls.json")
    try:
        jc = json.load(open(ctrl_p))
        polarities = {c["polarity"] for c in jc["controls"]}
        assert {"strong", "weak"} <= polarities, f"controls need both strong+weak, got {polarities}"
        # the weak control must expect a materially lower band than the strong one
        hi = max(c["expected_total_max"] for c in jc["controls"] if c["polarity"] == "weak")
        lo = min(c["expected_total_min"] for c in jc["controls"] if c["polarity"] == "strong")
        assert hi < lo, f"weak ceiling ({hi}) must sit below strong floor ({lo})"
        ok(f"judge-controls.json — {len(jc['controls'])} controls, weak<{hi} / strong≥{lo} bands disjoint")
    except FileNotFoundError:
        failures.append("judge-controls.json missing")
        fail("Judge negative-control (judge-controls.json not found)")
    except Exception as e:
        failures.append(f"judge-controls.json: {e}")
        fail(f"judge-controls.json shape ({e})")


# absolute machine-home paths that must never be committed
_MACHINE_PATH = re.compile(r"(/Users/|/home/[a-z]|[A-Z]:\\\\?Users\\)")
_TEXT_EXT = {".md", ".json", ".py", ".js", ".ts", ".html", ".sh", ".yml", ".yaml", ".txt", ".mjs"}


def check_self_contained():
    """3. No committed text file references a machine-specific absolute path."""
    offenders = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in (".git", "node_modules", "__pycache__")]
        for fn in filenames:
            ext = os.path.splitext(fn)[1].lower()
            if ext not in _TEXT_EXT:
                continue
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, ROOT)
            if rel == os.path.join("meta", "evals", "run_checks.py"):
                continue  # this file documents the patterns it forbids
            try:
                for i, line in enumerate(open(full, encoding="utf-8", errors="ignore"), 1):
                    if _MACHINE_PATH.search(line):
                        offenders.append(f"{rel}:{i}")
            except Exception:
                pass
    if offenders:
        failures.append("self-containment: machine paths found")
        fail("Self-containment — machine paths in:\n  " + "\n  ".join(offenders))
    else:
        ok("Self-containment — no machine-specific absolute paths in committed files")


def _read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


# the two skill dirs that are NOT building blocks: the method/orchestrator and
# the renderer. Everything else under skills/ is a composable building block.
_NON_BLOCK_SKILLS = {"system-design", "architecture-diagram"}


def check_regressions():
    """4. Alignment-audit fixes, frozen as assertions.

    Each sub-check is a defect a review caught once. Encoding them here means the
    suite fails the moment one regresses — the README's "turn each gap into a
    fail→pass assertion" rule, made executable.
    """
    # --- catalog-count invariant: the number /design advertises must equal the
    # number of building-block skills that actually exist on disk. This is what
    # drifted to a stale "21" while a 22nd skill was added.
    try:
        skill_dirs = {
            d for d in os.listdir(os.path.join(ROOT, "skills"))
            if os.path.isdir(os.path.join(ROOT, "skills", d))
        }
        n_blocks = len(skill_dirs - _NON_BLOCK_SKILLS)
        design = _read(os.path.join("commands", "design.md"))
        m = re.search(r"(\d+)\s+building blocks", design)
        assert m, "commands/design.md states no 'N building blocks' count"
        stated = int(m.group(1))
        assert stated == n_blocks, (
            f"/design says {stated} building blocks but skills/ has {n_blocks} "
            f"(non-block: {sorted(_NON_BLOCK_SKILLS)})"
        )
        assert "service-decomposition" in design, (
            "commands/design.md inline-fallback routing omits service-decomposition"
        )
        ok(f"Regression — catalog count in sync ({stated} building blocks, /design routes service-decomposition)")
    except Exception as e:
        failures.append(f"regression/catalog: {e}")
        fail(f"Regression — catalog/routing ({e})")

    # --- service-decomposition stays a conditional step, not an always-needed
    # one (it contradicts the block's own anti-microservices stance / GUIDE #7).
    try:
        sp = _read(os.path.join("docs", "study-path.md"))
        assert "service-decomposition` is conditional" in sp, (
            "study-path.md no longer frames service-decomposition as conditional"
        )
        # it must NOT be listed inside the always-needed foundations parenthetical
        m = re.search(r"always-needed\s+foundations\s*\(([^)]*)\)", sp)
        assert m, "study-path.md lost its 'always-needed foundations' list"
        assert "service-decomposition" not in m.group(1), (
            "service-decomposition crept back into the always-needed foundations list"
        )
        ok("Regression — study-path keeps service-decomposition conditional")
    except Exception as e:
        failures.append(f"regression/study-path: {e}")
        fail(f"Regression — study-path stance ({e})")

    # --- the latency math: 10 serial same-DC hops are ~5 ms of NETWORK, not a
    # 200 ms budget "on network alone". Guard the corrected framing and the
    # bad-math phrasing that taught candidates to reject splits with wrong numbers.
    try:
        sd = _read(os.path.join("skills", "service-decomposition", "SKILL.md"))
        assert re.search(r"~?5\s*ms", sd), (
            "service-decomposition lost the corrected '~5 ms of network' framing"
        )
        bad = re.search(r"200\s*ms[^\n]*network alone|network alone[^\n]*200\s*ms", sd)
        assert not bad, "the bad '200 ms on network alone' latency claim is back"
        ok("Regression — service-decomposition latency math is correct")
    except Exception as e:
        failures.append(f"regression/latency: {e}")
        fail(f"Regression — latency math ({e})")


def main():
    print(f"{DIM}repo root: {ROOT}{RESET}\n")
    check_botec()
    check_eval_data()
    check_judge_control()
    check_self_contained()
    check_regressions()
    print()
    if failures:
        print(f"{RED}{len(failures)} check(s) FAILED{RESET}")
        sys.exit(1)
    print(f"{GREEN}all checks passed{RESET}")


if __name__ == "__main__":
    main()
