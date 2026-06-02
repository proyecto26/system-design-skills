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
     expected shape (the 6-behavior rubric, exercises, trigger queries).
  3. Self-containment invariant — no committed text file contains a machine-
     specific absolute path (/Users/…, /home/…, C:\\Users\\…). This is the rule
     "each skill/file references nothing outside the plugin" turned into a test.

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
                    "failure_design", "pivot_on_constraint", "concrete_api_data"}
        assert set(rubric) == expected, f"rubric behaviors != the 6 expected: {rubric}"
        assert len(ev["evals"]) >= 1, "no exercises in evals.json"
        for e in ev["evals"]:
            assert e.get("turns"), f"exercise {e.get('id')} has no turns"
            assert e.get("should_compose"), f"exercise {e.get('id')} lists no should_compose blocks"
        ok(f"evals.json — {len(ev['evals'])} exercises, 6-behavior rubric intact")
    except Exception as e:
        failures.append(f"evals.json: {e}")
        fail(f"evals.json shape ({e})")
    try:
        tg = json.load(open(trig_p))
        assert len(tg["queries"]) >= 10, "too few trigger queries"
        ok(f"trigger-evals.json — {len(tg['queries'])} routing queries")
    except Exception as e:
        failures.append(f"trigger-evals.json: {e}")
        fail(f"trigger-evals.json shape ({e})")


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


def main():
    print(f"{DIM}repo root: {ROOT}{RESET}\n")
    check_botec()
    check_eval_data()
    check_self_contained()
    print()
    if failures:
        print(f"{RED}{len(failures)} check(s) FAILED{RESET}")
        sys.exit(1)
    print(f"{GREEN}all checks passed{RESET}")


if __name__ == "__main__":
    main()
