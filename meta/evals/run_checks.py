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
  5. Manifest consistency — the Agent Plugins root plugin.json, the Codex and
     Claude Code manifests, and both marketplace catalogs agree on name/version/
     description and install wiring; plugin.json obeys the closed 1.0.0 schema.

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
            if rel.startswith(os.path.join("evals", "results") + os.sep):
                continue  # local `claude plugin eval` output (gitignored), not committed
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

    # --- trade-off discipline must be VISIBLE in answers. `claude plugin eval`
    # (evals/*/graders/tradeoff-discipline.md) failed in BOTH arms until the
    # orchestrator carried an answer contract and every component block ended
    # its How-to-apply with "show the trade-off in the answer".
    try:
        sd = _read(os.path.join("skills", "system-design", "SKILL.md"))
        assert "## Answer contract" in sd and "Change it when" in sd, (
            "system-design lost its Answer contract (decisions table + weakest point)")
        missing = [
            d for d in sorted(os.listdir(os.path.join(ROOT, "skills")))
            if "## How to apply" in (txt := _read(os.path.join("skills", d, "SKILL.md")))
            and "Show the trade-off in the answer" not in txt
        ]
        assert not missing, f"How-to-apply lacks the 'show the trade-off' step: {missing}"
        ok("Regression — answer contract + per-block 'show the trade-off' step present")
    except Exception as e:
        failures.append(f"regression/answer-contract: {e}")
        fail(f"Regression — answer contract ({e})")


_AGENT_PLUGINS_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"
_AGENT_PLUGINS_FIELDS = {"$schema", "name", "version", "description", "author", "homepage",
                         "repository", "license", "keywords", "extensions"}
_AGENT_PLUGINS_NAME = re.compile(r"^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$")


def check_manifests():
    """5. Every host manifest agrees on plugin identity and install wiring.

    plugin.json (Agent Plugins 1.0 — Cursor, Copilot CLI), .codex-plugin/plugin.json
    (OpenAI Codex), .claude-plugin/ (Claude Code) and .agents/plugins/marketplace.json
    (Codex catalog) are hand-maintained copies; this keeps them from drifting. The
    root manifest is checked against the closed Agent Plugins 1.0.0 schema rules
    offline (no jsonschema / network), so CI stays stdlib-only.
    """
    try:
        load = lambda rel: json.loads(_read(rel))
        root = load("plugin.json")
        codex = load(os.path.join(".codex-plugin", "plugin.json"))
        claude = load(os.path.join(".claude-plugin", "plugin.json"))
        claude_mp = load(os.path.join(".claude-plugin", "marketplace.json"))
        codex_mp = load(os.path.join(".agents", "plugins", "marketplace.json"))
        name = root.get("name")

        # Agent Plugins 1.0.0: closed schema, required $schema const + name pattern
        assert root.get("$schema") == _AGENT_PLUGINS_SCHEMA, "plugin.json $schema is not Agent Plugins 1.0.0"
        extra = set(root) - _AGENT_PLUGINS_FIELDS
        assert not extra, f"plugin.json has fields outside the Agent Plugins schema: {sorted(extra)}"
        assert isinstance(name, str) and len(name) <= 64 and _AGENT_PLUGINS_NAME.match(name), (
            f"plugin.json name {name!r} violates the Agent Plugins name pattern")
        assert set(root.get("author", {})) <= {"name", "email", "url"}, "plugin.json author has extra keys"

        # identity: name + version everywhere, description across the plugin manifests
        entry = next((p for p in claude_mp.get("plugins", []) if p.get("name") == name), None)
        assert entry, f".claude-plugin/marketplace.json has no entry named {name!r}"
        for field, sources in (
            ("name", (root, codex, claude, entry)),
            ("version", (root, codex, claude, entry)),
            ("description", (root, codex, claude)),
        ):
            values = {s.get(field) for s in sources}
            assert len(values) == 1, f"'{field}' differs across manifests: {sorted(map(str, values))}"

        # install wiring: Codex reads skills from ./skills/, its catalog points at the repo root
        assert codex.get("skills") == "./skills/", ".codex-plugin/plugin.json 'skills' must be './skills/'"
        cx = [p for p in codex_mp.get("plugins", []) if p.get("name") == name]
        assert len(cx) == 1, f".agents/plugins/marketplace.json needs exactly one {name!r} entry"
        assert cx[0].get("source") == {"source": "local", "path": "./"}, (
            ".agents/plugins/marketplace.json entry must use a local './' source")
        assert entry.get("source") == "./", ".claude-plugin/marketplace.json entry source must be './'"
        assert os.path.isfile(os.path.join(ROOT, "skills", "system-design", "SKILL.md")), (
            "skills/system-design/SKILL.md missing — every host discovers skills from ./skills/")
        ok(f"Manifests — {name} {root['version']} consistent across plugin.json, .codex-plugin, .claude-plugin, .agents")
    except Exception as e:
        failures.append(f"manifests: {e}")
        fail(f"Manifests ({e})")


def main():
    print(f"{DIM}repo root: {ROOT}{RESET}\n")
    check_botec()
    check_eval_data()
    check_judge_control()
    check_self_contained()
    check_regressions()
    check_manifests()
    print()
    if failures:
        print(f"{RED}{len(failures)} check(s) FAILED{RESET}")
        sys.exit(1)
    print(f"{GREEN}all checks passed{RESET}")


if __name__ == "__main__":
    main()
