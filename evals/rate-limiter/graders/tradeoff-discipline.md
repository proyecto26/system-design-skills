---
type: llm
weight: 2
---

Grade reasoning discipline, not domain correctness (another grader covers that).

PASS only if BOTH hold:
1. At least THREE major design decisions each state all three parts explicitly: what the choice SOLVES, what it WORSENS or costs, and a concrete WHEN-TO-CHANGE trigger — the condition (ideally a number or observable signal) under which you would revisit it. A generic pros/cons list, or trade-offs given for only one or two decisions, does not count.
2. The answer contains a self-check: it names the weakest part of its own design or the first thing that breaks as load or requirements grow, and what it would do about it.

FAIL otherwise.
