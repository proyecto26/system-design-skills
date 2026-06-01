export const meta = {
  name: 'research-and-validate',
  description: 'Research team: study the 3 example skills, audit feature-migration vs Anthropic guides, validate eval realism, and confirm the end-to-end workflow improves system-design exercises. Read-only → consolidated report.',
  phases: [
    { title: 'Research', detail: 'parallel: per-example feature/migration audit + eval-realism + workflow-coherence' },
    { title: 'Synthesize', detail: 'consolidate into a prioritized validation report' },
  ],
}

const PLUGIN = '/Users/jdnichollsc/dev/ai/openai/system-design-skills'
const EX = '/Users/jdnichollsc/dev/ai/openai/skills'
const GUIDE = '/Users/jdnichollsc/dev/ai/openai/GUIDE.md'
const SKILL_CREATOR = '/Users/jdnichollsc/.claude/plugins/marketplaces/anthropic-agent-skills/skills/skill-creator/SKILL.md'
const SKILL_DEV = '/Users/jdnichollsc/.claude/plugins/marketplaces/claude-plugins-official/plugins/plugin-dev/skills/skill-development/SKILL.md'
const EVALS = `${PLUGIN}/meta/evals/iteration-1`

const FINDING = {
  type: 'object',
  required: ['source', 'best_features', 'migration', 'gaps', 'recommendations'],
  properties: {
    source: { type: 'string' },
    best_features: { type: 'array', items: { type: 'string' }, description: 'the strongest patterns/features of this example skill' },
    migration: { type: 'array', items: { type: 'object', required: ['feature', 'status'], properties: { feature: { type: 'string' }, status: { type: 'string', enum: ['migrated', 'partial', 'missing', 'n/a'] }, evidence: { type: 'string' } } } },
    gaps: { type: 'array', items: { type: 'string' } },
    recommendations: { type: 'array', items: { type: 'string' }, description: 'concrete, DRY-respecting, prioritized' },
  },
}

const SYNTHESIS = {
  type: 'object',
  required: ['migration_summary', 'guide_compliance', 'eval_recommendations', 'workflow_validation', 'dry_issues', 'prioritized_actions', 'overall'],
  properties: {
    migration_summary: { type: 'string', description: 'which best features of the examples we migrated vs still missing' },
    guide_compliance: { type: 'string', description: 'compliance with skill-creator / skill-development / create-plugin' },
    eval_recommendations: { type: 'array', items: { type: 'string' }, description: 'how to capture REALISTIC evals (fixtures, expected_outputs, trigger evals, multi-round exercises) — concrete' },
    workflow_validation: { type: 'string', description: 'does /design + orchestrator + the reasoning loop actually improve the design+scaling exercises? evidence' },
    dry_issues: { type: 'array', items: { type: 'string' } },
    prioritized_actions: { type: 'array', items: { type: 'object', required: ['action', 'priority', 'why'], properties: { action: { type: 'string' }, priority: { type: 'string', enum: ['P0', 'P1', 'P2'] }, why: { type: 'string' } } } },
    overall: { type: 'string' },
  },
}

const COMMON = `Our plugin under audit: ${PLUGIN} (read its README, meta/SKILL-CONTRACT.md, meta/PLAN.md, agents/, commands/, and skills/*/SKILL.md). Anthropic guides: ${SKILL_CREATOR} and ${SKILL_DEV}. The design philosophy/guide: ${GUIDE}. Be specific and cite files. Respect DRY — flag any recommendation that would duplicate content the ownership map already homes. Read-only: do NOT modify files.`

phase('Research')
const research = await parallel([
  () => agent(`Study the example skill at ${EX}/system-design (Alex Xu framework). Identify its strongest features (e.g. Scoring rubric to 10/10, "Common Mistakes" table, "Quick Diagnostic" table, per-area "Code applications" tables, "Further Reading"/attribution). Then audit whether our plugin migrated each best feature (migrated/partial/missing) with evidence from our files. List gaps + concrete DRY-respecting recommendations. ${COMMON}`, { label: 'research:ex-alexxu', phase: 'Research', schema: FINDING, agentType: 'general-purpose' }),
  () => agent(`Study the example skill at ${EX}/architecture_system-design (diagnostic state-machine). Identify its strongest features (state model SD0-SD6, "Anti-Patterns" with Problem/Fix, "Health Check Questions", "What You Do NOT Do", "Integration with Other Skills" tables, "Output Persistence" to files, ADR/walking-skeleton assets). Audit whether our plugin migrated each (migrated/partial/missing) with evidence. Gaps + concrete recommendations. ${COMMON}`, { label: 'research:ex-arch', phase: 'Research', schema: FINDING, agentType: 'general-purpose' }),
  () => agent(`Study the example skill at ${EX}/interview-system-designer. Identify its strongest features — especially the AGENTIC patterns: executable scripts/ (python), expected_outputs/ fixtures, a Quick Start, a numbered "Recommended Workflow", "Common Pitfalls" + "Best Practices". Audit whether our plugin uses these patterns (migrated/partial/missing). Pay special attention to whether expected_outputs/-style fixtures and scripts would help our skills be more deterministic/testable. Gaps + concrete recommendations. ${COMMON}`, { label: 'research:ex-interview', phase: 'Research', schema: FINDING, agentType: 'general-purpose' }),
  () => agent(`Validate our EVAL approach for realism. Read our eval artifacts at ${EVALS} (with_skill.md, baseline.md, verdict.json, SUMMARY.md), our two eval/improve workflow scripts in ${PLUGIN}/meta/, the skill-creator eval methodology in ${SKILL_CREATOR}, and the interview-system-designer's expected_outputs/ pattern at ${EX}/interview-system-designer/expected_outputs. Assess: are our evals REALISTIC (real user phrasings, multi-round, measure reasoning behaviors AND skill composition)? What is missing to capture realistic evals at scale — e.g. a saved eval set (evals.json) of realistic design prompts, trigger evals for description tuning, expected_outputs fixtures, regression baselines? Give concrete, prioritized recommendations. Set source="eval-realism". Put best_features=[] if n/a. ${COMMON}`, { label: 'research:eval-realism', phase: 'Research', schema: FINDING, agentType: 'general-purpose' }),
  () => agent(`Validate that our WORKFLOW makes sense — i.e. the /design command + system-design-orchestrator agent + the reasoning loop + building-block routing actually IMPROVE the system-design exercises while designing AND scaling systems. Read ${PLUGIN}/agents/system-design-orchestrator.md, ${PLUGIN}/commands/design.md, ${PLUGIN}/skills/system-design/SKILL.md + its references (reasoning-loop, building-blocks-index, failure-modes), the bottom-up layering, and the WhatsApp eval result at ${EVALS}/verdict.json (with-skill scored 30/30 vs baseline 20/30, composition real). Judge: does the bottom-up building-block flow + the loop coherently take a vague prompt → design → scale, defending the GUIDE failure modes? Where does it break or feel redundant? Concrete recommendations. Set source="workflow-coherence". ${COMMON}`, { label: 'research:workflow', phase: 'Research', schema: FINDING, agentType: 'general-purpose' }),
])

const findings = research.filter(Boolean)

phase('Synthesize')
const synth = await agent(
  `Synthesize these research findings into one prioritized validation report for the system-design-skills plugin. Findings (JSON):\n\n${JSON.stringify(findings, null, 2)}\n\nProduce: migration_summary (best features of the 3 examples we migrated vs still missing); guide_compliance (vs skill-creator/skill-development/create-plugin); eval_recommendations (concrete ways to capture REALISTIC evals — saved eval set, expected_outputs fixtures, trigger evals, regression baselines); workflow_validation (does the design→scale workflow improve the exercises, with evidence); dry_issues (any duplication risk); prioritized_actions (P0/P1/P2 with why). Keep it decision-useful; do not invent work that violates DRY/YAGNI.`,
  { label: 'synthesize', phase: 'Synthesize', schema: SYNTHESIS, agentType: 'general-purpose' }
)

return { findings, synthesis: synth }
