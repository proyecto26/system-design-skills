export const meta = {
  name: 'validate-and-improve-skills',
  description: 'Sub-agent team: validate each skill vs skill-creator/skill-development/create-plugin + the 3 example skills, then apply Steps + Dos/Don\'ts + explicit relations while keeping DRY/self-contained/YAGNI.',
  phases: [{ title: 'Improve', detail: 'one agent per skill: validate then apply v2 sections' }],
}

const PLUGIN = '/Users/jdnichollsc/dev/ai/openai/system-design-skills'
const CONTRACT = `${PLUGIN}/meta/SKILL-CONTRACT.md`
const EXAMPLES = '/Users/jdnichollsc/dev/ai/openai/skills' // user-provided reference skills

// 8 component + 3 method + 1 engine = 12 (orchestrator system-design handled separately)
const SKILLS = [
  { name: 'api-design', kind: 'component' },
  { name: 'data-storage', kind: 'component' },
  { name: 'caching', kind: 'component' },
  { name: 'load-balancing', kind: 'component' },
  { name: 'messaging-streaming', kind: 'component' },
  { name: 'consistency-coordination', kind: 'component' },
  { name: 'resilience-failure', kind: 'component' },
  { name: 'content-delivery', kind: 'component' },
  { name: 'requirements-scoping', kind: 'method' },
  { name: 'back-of-the-envelope', kind: 'method' },
  { name: 'scaling-evolution', kind: 'method' },
  { name: 'architecture-diagram', kind: 'engine' },
]

const REPORT = {
  type: 'object',
  required: ['skill', 'validation', 'changes_applied', 'pass'],
  properties: {
    skill: { type: 'string' },
    validation: {
      type: 'object',
      required: ['description_third_person_pushy', 'body_imperative_lean', 'progressive_disclosure', 'dos_donts_present', 'steps_or_recipe_present', 'relations_explicit', 'self_contained', 'dry_ok'],
      properties: {
        description_third_person_pushy: { type: 'boolean' },
        body_imperative_lean: { type: 'boolean' },
        progressive_disclosure: { type: 'boolean' },
        dos_donts_present: { type: 'boolean' },
        steps_or_recipe_present: { type: 'boolean' },
        relations_explicit: { type: 'boolean' },
        self_contained: { type: 'boolean' },
        dry_ok: { type: 'boolean' },
        issues_found: { type: 'array', items: { type: 'string' } },
      },
    },
    changes_applied: { type: 'array', items: { type: 'string' } },
    final_word_count: { type: 'number' },
    pass: { type: 'boolean' },
  },
}

function prompt(s) {
  const kindRules = s.kind === 'component'
    ? `COMPONENT block. Ensure these sections exist in contract order; ADD the missing v2 ones:
   - "## How to apply" — a numbered 4-6 step process (clarify inputs -> pick from the options via the trade-off table -> set key knobs -> stress-test -> size with numbers -> pick provider). Concrete, skimmable. Place AFTER "Behavior under stress", BEFORE "Numbers that matter".
   - "## Dos and don'ts" — compact Do.../Don't... lists (4-6 each), distilled from THIS skill (no new concepts). Place right after "How to apply".
   - "## Related building blocks" — make each link state the RELATION verb (depends on / feeds into / alternative to / pairs with / owned-concept lives in). Keep the back-link to \`system-design\`.`
    : s.kind === 'method'
    ? `METHOD block. It already has method recipes (= the step-by-step) and a Pitfalls section (= don'ts). ADD/ENSURE:
   - "## Dos and don'ts" — a compact Do.../Don't... pair distilled from the skill; if it would just duplicate Pitfalls, merge: rename to "## Dos and don'ts" and keep both sides. Do NOT add a separate "How to apply" (the recipe IS the process).
   - "## Related building blocks" — relation verbs as above; keep the \`system-design\` back-link.`
    : `ENGINE/utility skill (architecture-diagram). It is exempt from the component/method archetype. Just ensure it follows skill-creator/skill-development best practices: pushy third-person description, imperative lean body, a clear numbered "How to build" process (it has one), a "Dos and don'ts" (add if missing, distilled), and that Related links use relation verbs. Do not force a trade-off table.`

  return `You are validating and IMPROVING one skill in the self-contained "system-design-skills" plugin, to match Anthropic's skill-design best practices and the project's reference skills. Edit files in place. Touch ONLY ${PLUGIN}/skills/${s.name}/.

SKILL: \`${s.name}\` (${s.kind})

STEP 1 — READ:
- The authoring contract (obey it, incl. the "Required sections v2" + DRY ownership map): ${CONTRACT}
- The three reference skills the user wants us to match in shape/quality (study their structure: clear step-by-step process, Common Mistakes / Anti-Patterns / Dos & Don'ts, Quick Diagnostic, explicit Integration-with-other-skills):
  - ${EXAMPLES}/system-design/SKILL.md  (framework shape: Core Principle, Key insights, Common Mistakes table, Quick Diagnostic)
  - ${EXAMPLES}/architecture_system-design/SKILL.md  (Anti-Patterns, "What you do NOT do", Integration tables)
  - ${EXAMPLES}/interview-system-designer/SKILL.md  (Recommended Workflow steps, Common Pitfalls + Best Practices)
- The skill you're improving: ${PLUGIN}/skills/${s.name}/SKILL.md (and its references/)

STEP 2 — VALIDATE against the Anthropic skill rules and record findings:
- description: third-person, starts "This skill should be used when…", concrete + slightly pushy triggers, distinct from sibling skills (no poaching).
- body: imperative/infinitive (not second person), lean (~1500-2200 words), progressive disclosure (depth in references/, SKILL.md skimmable).
- self-contained: no file paths outside the plugin; siblings by bare backticked name; no Mermaid.
- DRY: per the contract's ownership map, owned-elsewhere concepts are summarized in <=3 sentences + linked, never re-taught.

STEP 3 — IMPROVE (apply edits):
${kindRules}
Keep it lean and YAGNI: distill from existing content, do not invent new options or pad. Do not break DRY/self-containment. Do not exceed ~2200 words in SKILL.md (move depth to references/ if needed).

STEP 4 — RETURN the report object (StructuredOutput): validation booleans + issues_found, the concrete changes_applied, final SKILL.md word count, and pass (true if it now meets the contract + Anthropic rules).`
}

phase('Improve')
const results = await parallel(SKILLS.map(s => () =>
  agent(prompt(s), { label: `improve:${s.name}`, phase: 'Improve', schema: REPORT, agentType: 'general-purpose' })
))

const ok = results.filter(Boolean)
log(`Validated + improved ${ok.length}/${SKILLS.length} skills`)
return { reports: ok, passed: ok.filter(r => r.pass).length, total: SKILLS.length }
