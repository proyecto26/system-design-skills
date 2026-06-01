export const meta = {
  name: 'author-system-design-blocks',
  description: 'Author the 9 remaining system-design building-block skills (research+author, then adversarial verify) against the contract, exemplars, and ownership map.',
  phases: [
    { title: 'Author', detail: 'one agent per skill: read corpus + contract + exemplars, write all files' },
    { title: 'Verify', detail: 'adversarial check vs contract/DRY/self-containment, apply fixes' },
  ],
}

// ---- shared paths (absolute; agents read these for full fidelity) ----
const PLUGIN = '/Users/jdnichollsc/dev/ai/openai/system-design-skills'
const CONTRACT = `${PLUGIN}/meta/SKILL-CONTRACT.md`
const GUIDE = '/Users/jdnichollsc/dev/ai/openai/GUIDE.md'
const EX_COMPONENT = `${PLUGIN}/skills/caching`            // component exemplar
const EX_METHOD = `${PLUGIN}/skills/back-of-the-envelope`  // method exemplar
const SRC = '/Users/jdnichollsc/dev/ai/openai'             // corpus root

// ---- the 9 skills with their full spec ----
const SKILLS = [
  {
    name: 'requirements-scoping', archetype: 'method',
    triggers: '"clarify requirements", "functional vs non-functional requirements", "scope the problem", "what questions should I ask", "requirements for <X>", scoping a design before building',
    owns: 'the clarify step: turning a vague prompt into functional requirements, non-functional constraints, and an explicit out-of-scope; the clarifying-question catalog; defining core features and deferring the rest',
    sources: [`${SRC}/system-design-interview/SYSTEM_DESIGN_INTERVIEW.md (Step 1)`, `${SRC}/system-design-solutions/README.md (Step 1: outline use cases/constraints/assumptions)`, `${GUIDE} (failure mode #3)`],
    links: 'back-of-the-envelope (it consumes these requirements as estimation inputs); system-design (the orchestrator runs this at step 1)',
    providers: 'NONE (method block — omit references/providers/ and the Choosing-a-provider section)',
    defends: 'GUIDE #3 rushing to design without clarifying',
  },
  {
    name: 'api-design', archetype: 'component',
    triggers: '"design the API", "endpoint design", "request/response shape", "pagination", "idempotency key", "API versioning", "REST vs gRPC vs GraphQL", "WebSocket vs polling"',
    owns: 'API contracts (request/response shapes), pagination (cursor vs offset), idempotency keys, versioning, error contracts; choosing REST vs RPC/gRPC vs GraphQL vs streaming',
    sources: [`${GUIDE} (failure mode #8 weak API/data-model thinking)`, `${SRC}/system-design-interview/designs/RATE_LIMITER.md`, `${SRC}/system-design-interview/designs/CHAT_SYSTEM.md`, `${SRC}/system-design-solutions/README.md (Application layer)`],
    links: 'data-storage (the API shapes mirror access patterns and keys); resilience-failure + consistency-coordination (idempotency keys protect retried writes — api-design OWNS the idempotency-key contract, those link to it)',
    providers: 'generic (REST/gRPC/GraphQL/WebSocket, OpenAPI), aws (API Gateway, AppSync, ALB), azure (API Management, Application Gateway), gcp (API Gateway, Apigee, Cloud Endpoints)',
    defends: 'GUIDE #8 weak API/data-model thinking',
  },
  {
    name: 'data-storage', archetype: 'component',
    triggers: '"SQL or NoSQL", "which database", "data model", "schema design", "indexing", "sharding", "partitioning", "replication", "primary/sort key", "denormalize", "polyglot persistence"',
    owns: 'SQL vs NoSQL choice, data modeling, indexing strategies, sharding/partitioning (it OWNS sharding — others link here), replication (leader-follower/multi-leader), denormalization, connection pooling',
    sources: [`${SRC}/system-design-solutions/README.md (Database: RDBMS, NoSQL, SQL-or-NoSQL, replication, federation, sharding, denormalization)`, `${SRC}/system-design-interview/SCALE_SYSTEM.md (Database + Database scaling sections)`, `${SRC}/system-design-interview/designs/CONSISTENT_HASHING.md`, `${GUIDE} (failure modes #1, #8)`],
    links: 'consistency-coordination (CAP, consistent-hashing theory, distributed transactions — link, do not re-teach); caching (reads it offloads); back-of-the-envelope (storage/shard counts)',
    providers: 'generic (Postgres/MySQL, MongoDB/Cassandra, key-value stores), aws (RDS, Aurora, DynamoDB), azure (Azure SQL Database, Cosmos DB), gcp (Cloud SQL, Spanner, Bigtable, Firestore)',
    defends: 'GUIDE #1 distributed fundamentals, #8 data model',
  },
  {
    name: 'load-balancing', archetype: 'component',
    triggers: '"load balancer", "L4 vs L7", "health checks", "traffic distribution", "round robin / least connections", "sticky sessions", "reverse proxy", "autoscaling group"',
    owns: 'L4 vs L7 balancing, balancing algorithms, health checks (and how they can DDoS a recovering service), sticky sessions, reverse proxy, how LBs enable the stateless tier',
    sources: [`${SRC}/system-design-solutions/README.md (Load balancer, Reverse proxy)`, `${SRC}/system-design-interview/SCALE_SYSTEM.md (Load balancer, Stateless web tier)`, `${GUIDE} (failure mode #2)`],
    links: 'resilience-failure (health-check stampede, failover — link); scaling-evolution (stateless tier, horizontal scale); content-delivery (edge/geo balancing)',
    providers: 'generic (HAProxy, Nginx, Envoy), aws (ALB, NLB, ELB), azure (Load Balancer, Application Gateway, Front Door), gcp (Cloud Load Balancing)',
    defends: 'GUIDE #2 opaque primitives',
  },
  {
    name: 'messaging-streaming', archetype: 'component',
    triggers: '"message queue", "Kafka", "event-driven", "async processing", "pub/sub", "exactly-once vs at-least-once", "dead letter queue", "backpressure", "stream processing", "durable workflow", "saga orchestration"',
    owns: 'queue vs stream vs pub/sub, delivery guarantees (at-least-once/at-most-once/exactly-once + dedup), ordering, backpressure, dead-letter queues, sync-vs-async decision, durable workflows',
    sources: [`${SRC}/system-design-solutions/README.md (Asynchronism, message queues)`, `${SRC}/system-design-interview/SCALE_SYSTEM.md (Message queue)`, `${GUIDE} (failure modes #2, #6)`],
    links: 'resilience-failure (retries, DLQ, backpressure as outage containment — link); data-storage (event sourcing/outbox); consistency-coordination (ordering, exactly-once vs idempotency)',
    providers: 'generic (Kafka, RabbitMQ, Redis Streams, NATS), aws (SQS, SNS, Kinesis, EventBridge, MSK), azure (Service Bus, Event Hubs, Event Grid), gcp (Pub/Sub, Dataflow), temporal (durable execution / workflows as an alternative to hand-rolled queue+retry+saga — when to choose it)',
    defends: 'GUIDE #2 opaque primitives, #6 failure handling',
  },
  {
    name: 'consistency-coordination', archetype: 'component',
    triggers: '"CAP theorem", "PACELC", "consistency model", "eventual vs strong consistency", "quorum", "consensus", "Raft / Paxos", "distributed transaction", "saga", "consistent hashing", "leader election", "read-your-writes"',
    owns: 'CAP/PACELC, consistency models (strong/eventual/causal/read-your-writes), quorum (R+W>N), consensus (Raft/Paxos at a high level), consistent hashing (it OWNS this — caching/data-storage link here), leader election, distributed transactions / saga / 2PC',
    sources: [`${SRC}/system-design-solutions/README.md (Availability vs consistency, CAP, Consistency patterns, Availability patterns)`, `${SRC}/system-design-interview/designs/CONSISTENT_HASHING.md`, `${GUIDE} (failure mode #1; the leader-follower-under-partition example)`],
    links: 'data-storage (replication/sharding apply this theory); messaging-streaming (ordering/exactly-once); resilience-failure (failover trade-offs)',
    providers: 'generic REQUIRED (coordination services: ZooKeeper/etcd/Consul; quorum-based stores). Cloud files ONLY where a managed service changes the recipe per the freshness rule — e.g. note Spanner external consistency / DynamoDB consistency knobs briefly; do NOT pad with a full catalog. Prefer a single generic.md plus at most short cloud notes where genuinely decision-changing.',
    defends: 'GUIDE #1 distributed-systems fundamentals',
  },
  {
    name: 'resilience-failure', archetype: 'component',
    triggers: '"fault tolerance", "circuit breaker", "graceful degradation", "retry storm", "exponential backoff with jitter", "single point of failure", "rate limiting", "bulkhead", "timeout", "resilience", "failover", "thundering herd on recovery"',
    owns: 'designing for failure: SPOF analysis, circuit breakers, retries/backoff/jitter, timeouts, bulkheads, graceful degradation (fall back to cache/partial/hidden), rate limiting (it OWNS rate-limiting algorithms — token bucket etc.), recovery without stampede',
    sources: [`${SRC}/system-design-solutions/README.md (Availability patterns: fail-over, replication)`, `${SRC}/system-design-interview/designs/RATE_LIMITER.md`, `${GUIDE} (failure mode #6)`, `${SRC}/system-design-interview/SCALE_SYSTEM.md`],
    links: 'messaging-streaming (queues + DLQ as containment); load-balancing (health checks/failover); consistency-coordination (failover consistency); api-design (idempotency keys make retries safe — link, api-design owns the key contract)',
    providers: 'generic (resilience libraries, token-bucket/leaky-bucket rate limiters, health checks), aws (multi-AZ/region, Route 53 health checks, WAF rate-based rules), azure (availability zones, Front Door/WAF rate limiting), gcp (regional/multi-region, Cloud Armor rate limiting), temporal (durable retries, timeouts, and saga compensation as workflow primitives)',
    defends: 'GUIDE #6 ignoring failure modes and degradation',
  },
  {
    name: 'content-delivery', archetype: 'component',
    triggers: '"CDN", "edge caching", "static asset delivery", "media delivery", "geo distribution / geo-routing", "push vs pull CDN", "cache-control headers", "origin shield"',
    owns: 'CDN push vs pull, edge caching, geo-routing, cache-control/TTL for static & media, origin offload',
    sources: [`${SRC}/system-design-solutions/README.md (Content delivery network)`, `${SRC}/system-design-interview/SCALE_SYSTEM.md (CDN)`, `${GUIDE} (failure mode #2)`],
    links: 'caching (CDN is the edge layer above the app/distributed cache — link to caching for invalidation/eviction theory it shares); load-balancing (geo/anycast); back-of-the-envelope (bandwidth/egress sizing)',
    providers: 'generic (CDN concepts, self-hosted edge / Varnish), aws (CloudFront), azure (Azure CDN, Front Door), gcp (Cloud CDN, Media CDN)',
    defends: 'GUIDE #2 opaque primitives',
  },
  {
    name: 'scaling-evolution', archetype: 'method',
    triggers: '"scale to millions", "how does this scale", "scaling roadmap", "where is the bottleneck", "10x growth", "vertical vs horizontal scaling", "scale from zero", "next scale curve"',
    owns: 'how a design evolves by orders of magnitude: single server -> separate tiers -> replication -> cache -> CDN -> stateless tier -> multi-DC/region -> sharding; bottleneck diagnosis (compute vs storage vs network); vertical vs horizontal; knowing the next thing to break',
    sources: [`${SRC}/system-design-interview/SCALE_SYSTEM.md (the WHOLE file — single server through millions of users)`, `${SRC}/system-design-solutions/README.md (Step 4: scale the design; Design a system that scales to millions on AWS)`, `${GUIDE} (failure mode #7; treat architecture as a hypothesis)`],
    links: 'back-of-the-envelope (numbers reveal the next ceiling); data-storage (sharding/replicas); caching; load-balancing; resilience-failure',
    providers: 'NONE (method block) — discuss multi-region/scaling patterns generically; omit references/providers/ and the Choosing-a-provider section',
    defends: 'GUIDE #7 over-indexing on one memorized architecture',
  },
]

const MANIFEST = {
  type: 'object',
  required: ['skill', 'archetype', 'files_written', 'self_check'],
  properties: {
    skill: { type: 'string' },
    archetype: { type: 'string', enum: ['component', 'method'] },
    files_written: { type: 'array', items: { type: 'string' } },
    self_check: {
      type: 'object',
      required: ['has_trade_offs_or_pitfalls', 'has_stress_section', 'has_clarify_first', 'no_external_paths', 'links_back_to_orchestrator', 'word_count'],
      properties: {
        has_trade_offs_or_pitfalls: { type: 'boolean' },
        has_stress_section: { type: 'boolean' },
        has_clarify_first: { type: 'boolean' },
        no_external_paths: { type: 'boolean' },
        links_back_to_orchestrator: { type: 'boolean' },
        providers_written: { type: 'array', items: { type: 'string' } },
        word_count: { type: 'number' },
      },
    },
    notes: { type: 'string' },
  },
}

const VERDICT = {
  type: 'object',
  required: ['skill', 'pass', 'issues', 'fixed'],
  properties: {
    skill: { type: 'string' },
    pass: { type: 'boolean' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'description'],
        properties: {
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          description: { type: 'string' },
          file: { type: 'string' },
        },
      },
    },
    fixed: { type: 'array', items: { type: 'string' } },
    final_word_count: { type: 'number' },
  },
}

function authorPrompt(s) {
  return `You are authoring ONE building-block skill for the self-contained "system-design-skills" Claude Code plugin. Write real files to disk. Do NOT touch any directory other than your own skill's.

SKILL TO AUTHOR: \`${s.name}\`  (archetype: ${s.archetype})
Target directory: ${PLUGIN}/skills/${s.name}/

STEP 1 — READ THESE FIRST (full fidelity, do not skip):
- The authoring contract: ${CONTRACT}  (obey EVERY rule, including the two archetypes, DRY ownership map, KISS/YAGNI, self-containment, frontmatter, and the exact body section order)
- The exemplars to MATCH in shape and quality:
  - component exemplar: ${EX_COMPONENT}/SKILL.md , ${EX_COMPONENT}/references/deep-dive.md , ${EX_COMPONENT}/references/providers/aws.md
  - method exemplar:    ${EX_METHOD}/SKILL.md , ${EX_METHOD}/references/numbers-to-remember.md
- The failure-mode guide: ${GUIDE}
- Your source material (mine these for substance, then reason beyond them):
${s.sources.map(x => '  - ' + x).join('\n')}

THIS SKILL OWNS (explain in depth here): ${s.owns}
IT DEFENDS AGAINST: ${s.defends}
CROSS-LINKS (reference by bare \`name\` in backticks, summarize in <=3 sentences, never re-teach an owned-elsewhere concept): ${s.links}
PROVIDERS: ${s.providers}

STEP 2 — WRITE THE FILES following the contract for the ${s.archetype} archetype:
- ${PLUGIN}/skills/${s.name}/SKILL.md
  * Frontmatter: name: ${s.name}; third-person pushy-but-distinct description starting "This skill should be used when…" with concrete trigger phrases drawn from: ${s.triggers}. Do NOT claim another block's vocabulary.
  * Body in imperative form, ~1500-2000 words, sections in the contract's order.
    - COMPONENT archetype: purpose; When to reach / When NOT to; Clarify first; The options (each with a one-line "use when"); Trade-offs TABLE (one row per option: Option | What it solves | What it worsens | Change it when); Behavior under stress (how it acts under load/failure, what amplifies outages, what to monitor); Numbers that matter (link to \`back-of-the-envelope\`, don't restate its tables); Interface sketch (if the part has a contract); Choosing a provider (the exact contract wording); Diagram (one line pointing to the \`architecture-diagram\` skill — NO Mermaid); Related building blocks; References.
    - METHOD archetype: purpose; When to reach / When NOT to; Clarify first; The method steps / recipes (replace "options"); Pitfalls / where it misleads (replace the trade-off table); Numbers that matter (where relevant); Diagram (optional, pointer only); Related building blocks; References. OMIT providers and the Choosing-a-provider section.
- references/deep-dive.md — the mechanics that would bloat SKILL.md (algorithms, protocols, edge cases). Always for component; for method, name it appropriately (e.g. recipes/checklists) and still keep SKILL.md lean.
- COMPONENT ONLY: references/providers/generic.md (REQUIRED) + the cloud files listed above. Each: service mapping -> the generic options; only decision-changing limits (mark volatile numbers "verify against current docs"); provider-specific trade-offs; pitfalls. Keep each ~one screen. Follow the freshness/scope rule — no service catalogs.

HARD RULES:
- SELF-CONTAINED: never reference a file path outside this plugin. Sibling skills are named in backticks only (not paths). Do not mention external skills/files.
- DRY: obey the contract's ownership map. If a concept is owned by another skill, give a 2-3 sentence working summary and link to that skill — never a full duplicate.
- NO Mermaid; the \`architecture-diagram\` skill is the only diagram engine. The "Diagram" line is a one-line pointer to it.
- "Related building blocks" MUST link back to \`system-design\`.

STEP 3 — RETURN the manifest object (the StructuredOutput tool) describing exactly what you wrote.`
}

function verifyPrompt(s) {
  return `Adversarially verify the just-authored building-block skill \`${s.name}\` (archetype: ${s.archetype}) in ${PLUGIN}/skills/${s.name}/. Read its files AND the contract ${CONTRACT}. Be strict; assume there are problems.

Check:
1) Contract compliance: required body sections present and in order for the ${s.archetype} archetype. Component blocks MUST have a Trade-offs table (Option|solves|worsens|change-when) AND a "Behavior under stress" section. Method blocks MUST have method steps + a Pitfalls section and MUST NOT have providers/ or a Choosing-a-provider section.
2) Frontmatter: name == "${s.name}"; description is third-person, has concrete distinct triggers, does not poach another block's vocabulary.
3) DRY / ownership map (in the contract): does it re-teach a concept owned by another skill instead of summarizing + linking? Flag any duplication of latency numbers, CAP/consistency theory, consistent hashing, sharding, rate-limiting, idempotency, etc. that belongs to its owner.
4) Self-containment: NO file path references outside the plugin; siblings referenced by bare backticked name only; no Mermaid; "Diagram" points to \`architecture-diagram\`.
5) Cross-links: links back to \`system-design\`; sibling links are real skill names from the plugin.
6) Referenced-file integrity: every references/… or providers/… file the SKILL.md mentions actually exists. Component blocks: generic.md exists.
7) KISS: SKILL.md body roughly 1200-2200 words; not bloated; no filler that doesn't change a decision (YAGNI).

Apply MINOR fixes directly with Edit/Write (wording, missing back-link, trim a duplicated paragraph to a link, fix a broken reference path, remove a stray Mermaid block). For anything structural you cannot safely fix, record it as an issue. Return the verdict object: pass=true only if no critical/high issues remain after your fixes.`
}

phase('Author')
const results = await pipeline(
  SKILLS,
  (s) => agent(authorPrompt(s), { label: `author:${s.name}`, phase: 'Author', schema: MANIFEST, agentType: 'general-purpose' }),
  (manifest, s) => agent(verifyPrompt(s), { label: `verify:${s.name}`, phase: 'Verify', schema: VERDICT, agentType: 'general-purpose' }),
)

const summary = results.filter(Boolean).map(v => ({ skill: v.skill, pass: v.pass, issues: (v.issues || []).length, fixed: (v.fixed || []).length, words: v.final_word_count }))
log(`Authored + verified ${summary.length}/${SKILLS.length} blocks`)
return { summary, verdicts: results.filter(Boolean) }
