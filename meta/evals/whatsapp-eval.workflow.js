export const meta = {
  name: 'whatsapp-skill-eval',
  description: 'skill-creator-style eval: run the WhatsApp 3-round exercise with-skill vs baseline, then judge on the GUIDE reasoning rubric + whether the orchestrator invoked block skills.',
  phases: [
    { title: 'Run', detail: 'with-skill and baseline agents work the exercise in parallel' },
    { title: 'Judge', detail: 'score both on the GUIDE rubric + block-invocation check' },
  ],
}

const PLUGIN = '/Users/jdnichollsc/dev/ai/openai/system-design-skills'

const EXERCISE = `SYSTEM DESIGN EXERCISE — WhatsApp (3 rounds; treat as a collaborative interview).

Round 1 — Core Design: Design the backend for a WhatsApp-like messaging system.
  - Data model: how do you store messages, conversations, users?
  - Delivery: how does message delivery work end-to-end (sender -> server -> recipient)?
  - Offline: how do you handle online vs offline recipients?

Round 2 — Scale It: Now 1B users, 100B messages/day (~1.15M msg/sec peak).
  - Bottlenecks: where does your Round 1 design break first?
  - Fan-out: how do you handle group chats with 1,000 members?

Round 3 — Hard Problems: pick ONE and go deep:
  - Exactly-once delivery guarantees
  - Message ordering across devices (multi-device sync)
  - End-to-end encryption key distribution at scale`

const WITH_SKILL = `You are an engineer in a system-design interview. You have the "system-design-skills" plugin available as a skill library at ${PLUGIN}/skills/. Treat it as installed skills.

HOW TO USE IT (this mirrors how the skills would trigger if installed):
1. START by reading ${PLUGIN}/skills/system-design/SKILL.md and follow its reasoning loop and guardrails. Read its references/ as it directs.
2. When the orchestrator routes a concern to a building-block skill (e.g. messaging-streaming, data-storage, consistency-coordination, caching, resilience-failure, back-of-the-envelope, api-design), READ that skill's SKILL.md (and the relevant references/ or providers/ files) and APPLY it before deciding. Do not paraphrase from memory — load the skill.

Then work through the exercise below as a collaborative design discussion: clarify, estimate with numbers, propose a high-level design, articulate trade-offs (solves/worsens/when-to-change), stress-test failure modes, and pivot when Round 2 changes the constraints.

At the very END of your answer, add a section "SKILLS CONSULTED:" listing exactly which building-block skills (by name) you actually read and used.

${EXERCISE}`

const BASELINE = `You are an engineer in a system-design interview. Work through the exercise below as a collaborative design discussion.

${EXERCISE}`

const VERDICT = {
  type: 'object',
  required: ['scores', 'blocks_consulted', 'block_invocation_real', 'winner', 'per_behavior_delta', 'top_gaps', 'verdict'],
  properties: {
    scores: {
      type: 'object',
      required: ['with_skill', 'baseline'],
      properties: {
        with_skill: { $ref: '#/$defs/rubric' },
        baseline: { $ref: '#/$defs/rubric' },
      },
    },
    blocks_consulted: { type: 'array', items: { type: 'string' }, description: 'building-block skills the with-skill run actually read/used' },
    block_invocation_real: { type: 'boolean', description: 'true if the with-skill run genuinely loaded block skills rather than only the orchestrator' },
    winner: { type: 'string', enum: ['with_skill', 'baseline', 'tie'] },
    per_behavior_delta: { type: 'string', description: 'where the skill helped most and least' },
    top_gaps: { type: 'array', items: { type: 'string' }, description: 'concrete improvements to the skills, prioritized' },
    verdict: { type: 'string', description: '2-3 sentence overall judgment' },
  },
  $defs: {
    rubric: {
      type: 'object',
      required: ['clarify_first', 'quantified_estimates', 'tradeoff_articulation', 'failure_design', 'pivot_on_constraint', 'concrete_api_data', 'total'],
      properties: {
        clarify_first: { type: 'number', description: '0-5: clarified FR/NFR/scope before designing' },
        quantified_estimates: { type: 'number', description: '0-5: back-of-envelope numbers drove choices' },
        tradeoff_articulation: { type: 'number', description: '0-5: solves/worsens/when-to-change per major choice' },
        failure_design: { type: 'number', description: '0-5: SPOF, degradation, recovery, no retry storms' },
        pivot_on_constraint: { type: 'number', description: '0-5: redesigned the affected part when Round 2 changed scale' },
        concrete_api_data: { type: 'number', description: '0-5: concrete data model, keys, delivery contract' },
        total: { type: 'number', description: 'sum, 0-30' },
      },
    },
  },
}

phase('Run')
const [withSkill, baseline] = await parallel([
  () => agent(WITH_SKILL, { label: 'run:with-skill', phase: 'Run', agentType: 'general-purpose' }),
  () => agent(BASELINE, { label: 'run:baseline', phase: 'Run', agentType: 'general-purpose' }),
])

phase('Judge')
const judgePrompt = `You are grading two system-design interview answers to the SAME WhatsApp exercise. One was produced WITH a system-design skill library, one WITHOUT (baseline). Grade strictly and independently on the rubric the skills are meant to instill (from the project's failure-mode GUIDE).

Rubric (score each 0-5 for EACH answer): clarify_first, quantified_estimates, tradeoff_articulation (solves/worsens/when-to-change), failure_design, pivot_on_constraint (did Round 2's 1B-user/1.15M-msg-sec change drive a real redesign of the affected part?), concrete_api_data (data model, keys, delivery/offline contract). Sum to total (0-30).

Also: from the WITH-SKILL answer's "SKILLS CONSULTED" section and its content, list which building-block skills were actually used (blocks_consulted), and judge whether composition genuinely happened (block_invocation_real) — i.e. it loaded blocks like messaging-streaming / data-storage / consistency-coordination, not just the orchestrator. Name the top_gaps: concrete, prioritized improvements to the skills based on what the with-skill answer still did poorly.

=== WITH-SKILL ANSWER ===
${withSkill || '(failed)'}

=== BASELINE ANSWER ===
${baseline || '(failed)'}`

const verdict = await agent(judgePrompt, { label: 'judge', phase: 'Judge', schema: VERDICT, agentType: 'general-purpose' })

return { withSkill, baseline, verdict }
