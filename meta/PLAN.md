# Creation plan — system-design-skills plugin

> **Status (current):** This plan has been executed and extended. The plugin now
> ships **21 skills** (orchestrator + diagram engine + 3 method + 16 component
> blocks — the full bottom-up catalog), a **`system-design-orchestrator` agent**,
> and a **`/design` command**, plus eval realism artifacts under `meta/evals/`.
> The canonical, always-current inventory is the ownership map in
> `SKILL-CONTRACT.md` and the building-blocks index in the `system-design` skill —
> trust those over the original counts below, which are kept for history.



A plan/spec for independent review **before** mass-authoring the remaining
building-block skills. It is self-contained: it summarizes the structure,
contract, and decisions so a reviewer needs only this file (plus the four
authored skills and `SKILL-CONTRACT.md`) to judge it.

## 1. Goal & philosophy

A Claude Code plugin that helps Claude approach **system-design problems by
reasoning, not by recalling memorized architectures.** Grounded in a guide (the
project's `GUIDE.md`) cataloging the ten ways strong engineers fail design
discussions — almost always *signal* failures (naming tools without trade-offs,
no numbers, ignoring failure modes, defending a memorized diagram), not "wrong
answers."

Core decision: **do not ship full-architecture templates.** Ship **composable
building blocks** — one skill per part of a system — each a reusable recipe with
explicit trade-offs, behavior under stress, the numbers that matter, and
cloud-provider variants. Claude composes blocks to fit the problem and can
justify every choice. "Divide and conquer," not "fill in the WhatsApp template."

## 2. Hard constraints

- **Self-contained.** No skill may reference a file outside the plugin. The
  diagram engine is bundled *inside* the plugin (no dependency on any external
  skill). Sibling skills are referenced only by bare name (they ship together).
- **DRY** — one home per fact. Latency/QPS numbers live only in
  `back-of-the-envelope`; the trade-off method and failure-mode list live only in
  the `system-design` orchestrator; CAP theory only in `consistency-coordination`.
  Everyone else links.
- **KISS** — lean SKILL.md bodies (~1,500–2,000 words target; depth in
  `references/`).
- **YAGNI** — include an option/number/provider detail only if it changes a
  decision. No exhaustive service catalogs, no irrelevant filler.

## 3. Taxonomy — 13 skills, 2 archetypes

**Orchestrator (1):**
- `system-design` — the reasoning loop (clarify → estimate → high-level →
  trade-offs → failure modes → iterate), the ten failure-mode guardrails, the
  collaboration/pivot playbook, the trade-off framework, a building-blocks routing
  index, and design-doc/requirements templates. Routes to the blocks.

**Component blocks (8)** — a part you pick an implementation for; full structure
incl. options + a solves/worsens/when-to-change trade-off table + behavior under
stress + provider files:
- `api-design`, `data-storage`, `caching`, `load-balancing`,
  `messaging-streaming`, `consistency-coordination`, `resilience-failure`,
  `content-delivery`.

**Method blocks (3)** — a technique, not a component; recipes + pitfalls instead
of a trade-off table; providers only where a cloud detail changes the technique:
- `requirements-scoping`, `back-of-the-envelope`, `scaling-evolution`.

**Diagram engine (1):**
- `architecture-diagram` — self-contained dark-theme HTML+SVG generator (bundles
  its own `assets/template.html` with a pinned+SRI export toolbar). Replaces
  Mermaid. Documents an optional interactive/commentable mode; a live
  "send-to-Claude" transport is optional and never required.

Each block maps to a GUIDE failure mode it defends against (e.g. caching → #2
opaque primitives; back-of-the-envelope → #5 no numbers; api-design → #8 weak
interfaces; resilience-failure → #6 ignoring failure).

## 4. The authoring contract (summary; full text in SKILL-CONTRACT.md)

Every block: third-person pushy-but-distinct `description` with concrete triggers;
imperative body; sections — purpose · when-to / when-not · **clarify first** ·
options (or method recipes) · **trade-offs table** (or pitfalls) · **behavior
under stress** · numbers that matter · interface sketch (where applicable) ·
provider selection · diagram pointer · related blocks · references. Component
blocks carry `references/deep-dive.md` + `references/providers/{generic,aws,azure,gcp}.md`
(+ `temporal.md` for messaging/resilience). The structure *is* the guardrail —
it forces clarify-before-design, trade-off articulation, and failure analysis.

## 5. Provider modularity

Default to the **generic, vendor-neutral recipe**. When a cloud is named, read
`references/providers/<provider>.md` for the managed-service mapping, key
limits/quotas, provider-specific trade-offs, and pitfalls. If no provider file
exists, the generic recipe is the answer — stated explicitly, never invent a
service.

## 6. Source material

Authoring mines the project's corpus (the System Design Primer, "Scale from Zero
to Millions", `SYSTEM_CAPACITY.md` for BOTEC numbers, the deep design docs for
chat/rate-limiter/consistent-hashing/leaderboard/etc., and `GUIDE.md`), plus
Claude's own distributed-systems knowledge (the GUIDE explicitly wants reasoning
beyond the docs).

## 7. Build approach

**Done (hand-authored as exemplars):** `system-design` (orchestrator +
7 references + 2 templates), `back-of-the-envelope` (method exemplar, from
`SYSTEM_CAPACITY.md` + provided BOTEC content), `caching` (component exemplar +
deep-dive + 4 provider files), `architecture-diagram` (engine + design-system +
interactive references + bundled template).

**Remaining (9 skills) via a `Workflow`:** a research→author→verify **pipeline**,
one item per skill, each agent writing its own disjoint skill directory:
1. *research* — mine the relevant corpus sections → structured knowledge pack
   (options, trade-offs, stress behavior, numbers, provider mappings, citations,
   cross-links).
2. *author* — write SKILL.md + references following the contract and matching the
   `caching` (component) / `back-of-the-envelope` (method) exemplars.
3. *verify* — check against the contract (sections present, trade-off table,
   stress section), DRY (no duplicated numbers/definitions — link instead),
   self-containment (no external paths), cross-link validity, frontmatter, word
   count; apply fixes.
Followed by an inline normalization + `plugin-validator` pass.

## 8. Validation status

`plugin-dev:create-plugin` Phase 6 run: `plugin-validator` agent verdict **PASS**,
scoped to **the 4 authored skills** — valid manifest, correct structure, clean
self-containment, security clean, all 4 conform to the contract. The other **9
skill directories exist as empty scaffolding (no SKILL.md/references yet)**; their
frontmatter, reference/provider shape, cross-links, and DRY compliance will be
produced *and validated* in the workflow's verify stage + a final
`plugin-validator` pass. Cosmetic Mermaid-wording leftovers fixed.

Post-`/seldon` revisions applied: (a) removed the Google-Fonts web-font fetch from
the diagram template so it renders fully offline (export scripts remain optional +
pinned+SRI); (b) made orchestrator→block routing an explicit Skill-tool invocation
instruction, not prose; (c) resolved the method-block provider contradiction in
the contract; (d) added an authoritative cross-cutting **ownership map** to the
contract; (e) added a provider-file freshness/scope rule.

## 9. Evaluation strategy (the finish line)

Use `skill-creator` evals with a realistic exercise — the project's
`system-design-exercises/WHATSAPP_EXERCISE.md` (a 3-round prompt: core design →
scale to 1B users/100B msgs/day → a hard deep-dive). Run with-skill vs baseline
subagents and judge on two axes:
1. **Reasoning behaviors** the GUIDE rewards — clarifies first, quantifies,
   articulates trade-offs (solves/worsens/when-to-change), designs for failure,
   pivots on constraint changes.
2. **Composition actually happens** — inspect the with-skill transcript to confirm
   the orchestrator *invoked* the relevant block skills (e.g. `messaging-streaming`,
   `data-storage`, `consistency-coordination`) via the Skill tool, rather than
   paraphrasing recipes from memory. This directly tests the routing mechanism
   `/seldon` flagged, not just the final wording.
Iterate descriptions/content from the results.

## 10. Questions for the reviewer

1. Is 13 skills the right granularity, or should any blocks merge/split (e.g.
   `content-delivery` into `caching`; `consistency-coordination` vs `data-storage`
   boundary)?
2. Does the component/method archetype split hold for all 11 blocks?
3. Is the trade-off-table-per-option the right forcing function, or too rigid?
4. Any DRY risk where two blocks will inevitably duplicate (e.g. consistent
   hashing appears in `caching`, `data-storage`, and `consistency-coordination` —
   currently homed in `consistency-coordination` with links)?
5. Is bundling the diagram engine (vs depending on an external skill) the right
   self-containment call?
