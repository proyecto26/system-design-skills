export const meta = {
  name: 'author-new-building-blocks',
  description: 'Author the 8 remaining catalog building blocks (research+author, then adversarial verify) against the v2 contract, the caching exemplar, and the ownership map.',
  phases: [
    { title: 'Author', detail: 'one agent per block: research corpus + contract, write all files' },
    { title: 'Verify', detail: 'adversarial check vs v2 contract / DRY / self-containment, apply fixes' },
  ],
}

const PLUGIN = '/Users/jdnichollsc/dev/ai/openai/system-design-skills'
const CONTRACT = `${PLUGIN}/meta/SKILL-CONTRACT.md`
const GUIDE = '/Users/jdnichollsc/dev/ai/openai/GUIDE.md'
const EX = `${PLUGIN}/skills/caching`             // v2 component exemplar (has How to apply + Dos/Don'ts)
const SRC = '/Users/jdnichollsc/dev/ai/openai'

const SKILLS = [
  {
    name: 'dns', triggers: '"DNS", "domain resolution", "GeoDNS / geo routing", "latency-based routing", "weighted / failover routing", "Route 53 / Cloud DNS", "A/CNAME/ALIAS record", "anycast", "DNS TTL / propagation"',
    owns: 'DNS resolution hierarchy (recursive/authoritative), record types, routing policies (simple/weighted/latency/geo/failover/multivalue), TTL and propagation, anycast, health-checked DNS failover',
    sources: [`${SRC}/system-design-solutions/README.md (Domain name system)`, `${SRC}/system-design-interview/SCALE_SYSTEM.md`, `${GUIDE}`],
    links: 'load-balancing — *complements* (DNS spreads across regions/endpoints; an LB spreads within a region); content-delivery — *pairs with* (CDNs route via anycast/DNS); resilience-failure — *feeds into* (DNS health-check failover); system-design — *feeds into*',
    providers: 'generic (BIND/PowerDNS, anycast), aws (Route 53 + routing policies + health checks), azure (Azure DNS + Traffic Manager), gcp (Cloud DNS + Cloud Load Balancing geo)',
    defends: '#2 opaque primitives',
  },
  {
    name: 'sequencer', triggers: '"unique ID generator", "distributed IDs", "Snowflake ID", "UUID vs auto-increment", "time-sortable ID", "monotonic sequence", "ticket server", "ID generation at scale"',
    owns: 'unique-ID generation methods (UUID/ULID, Snowflake-style timestamp+node+seq, DB ticket/range allocation), causality & monotonicity, clock-skew handling, ID size/encoding trade-offs',
    sources: [`${SRC}/system-design-solutions/README.md (unique id / common designs)`, `${GUIDE}`, 'plus standard knowledge: Twitter Snowflake, Flickr ticket servers, ULID'],
    links: 'data-storage — *feeds into* (IDs are primary/sort keys; sharding lives there); consistency-coordination — *depends on* for causality/ordering theory (link, do not re-teach); messaging-streaming — *pairs with* (message ordering); system-design — *feeds into*',
    providers: 'generic REQUIRED (Snowflake libraries, ticket server on a SQL row, ULID/UUIDv7). Cloud files only where a managed service changes the recipe (e.g. brief notes: DynamoDB/Spanner sequence patterns, no dedicated ID service) — keep minimal per the freshness rule.',
    defends: '#1 fundamentals, #8 keys',
  },
  {
    name: 'observability', triggers: '"monitoring", "observability", "metrics / logs / traces", "health checks", "alerting", "SLO / SLI", "error budget", "Prometheus / Grafana / Datadog", "dashboards", "on-call", "RED / USE method"',
    owns: 'the three pillars (metrics/logs/traces) CONCEPTUALLY, health checks (liveness/readiness), alerting, SLO/SLI + error budgets, RED & USE methods, server-side vs client-side monitoring. NOTE: owns WHAT to measure + alert; the high-volume LOG PIPELINE is owned by distributed-logging — summarize + link.',
    sources: [`${SRC}/system-design-solutions/README.md`, `${SRC}/skills/system-design/references/reliability-operations.md`, `${GUIDE} (monitor growth to know when to evolve)`],
    links: 'distributed-logging — *owned-concept lives in* (the log pipeline); resilience-failure — *pairs with* (alerts trigger degradation; health checks shared with load-balancing); scaling-evolution — *feeds into* (metrics reveal the next bottleneck); system-design — *feeds into*',
    providers: 'generic (Prometheus + Grafana + Loki + Jaeger + OpenTelemetry), aws (CloudWatch + X-Ray), azure (Azure Monitor + Application Insights), gcp (Cloud Monitoring + Trace)',
    defends: '#6 ignoring failure',
  },
  {
    name: 'blob-store', triggers: '"blob store", "object storage", "S3", "store images / video / files", "multipart upload", "signed / presigned URL", "media storage", "unstructured data at scale", "erasure coding"',
    owns: 'object/blob storage design, chunking, the metadata index, durability via replication vs erasure coding, storage tiering (hot/cold/archive), signed URLs, multipart/resumable upload, versioning',
    sources: [`${SRC}/system-design-solutions/README.md`, `${SRC}/system-design-interview/SCALE_SYSTEM.md`, `${GUIDE}`, 'plus standard knowledge: S3/Ceph/MinIO, erasure coding'],
    links: 'content-delivery — *pairs with* (CDN fronts the blob origin); data-storage — *alternative to* for large unstructured objects (store the blob, keep a pointer in the DB); back-of-the-envelope — *depends on* for storage/egress sizing; system-design — *feeds into*',
    providers: 'generic (MinIO/Ceph/SeaweedFS), aws (S3 + storage classes + Glacier), azure (Blob Storage + tiers), gcp (Cloud Storage + classes)',
    defends: '#2 opaque primitives',
  },
  {
    name: 'distributed-search', triggers: '"search system", "full-text search", "inverted index", "Elasticsearch / OpenSearch", "relevance ranking", "search autocomplete / typeahead", "indexing pipeline", "faceted search"',
    owns: 'inverted index, the crawl/index/search pipeline, index sharding + replication, relevance ranking (TF-IDF/BM25 at a high level), autocomplete (trie / top-k), near-real-time indexing',
    sources: [`${SRC}/system-design-solutions/README.md`, `${SRC}/system-design-interview/designs/WEB_CRAWLER.md`, `${GUIDE}`],
    links: 'data-storage — *alternative to* DB LIKE/scan for text (search owns the inverted index; sharding theory lives in data-storage — link); messaging-streaming — *depends on* (the index-update pipeline); caching — *pairs with* (cache hot queries); system-design — *feeds into*',
    providers: 'generic (Elasticsearch/OpenSearch, Lucene, Solr), aws (OpenSearch Service), azure (AI Search), gcp (Vertex AI Search / self-managed OpenSearch)',
    defends: '#2 opaque primitives',
  },
  {
    name: 'distributed-logging', triggers: '"distributed logging", "log aggregation", "centralized logs", "ELK / EFK", "log shipping", "structured logging", "correlation / trace ID", "log retention", "high-volume log ingest"',
    owns: 'the high-volume LOG PIPELINE (collect → buffer → ship → index → store → retain), structured logging, correlation/trace IDs, sampling, ordering, retention + tiering to cold storage. NOTE: WHAT to alert on / SLOs is owned by observability — link, do not re-teach.',
    sources: [`${SRC}/system-design-solutions/README.md`, `${GUIDE}`, 'plus standard knowledge: ELK/EFK, Fluentd/Vector, Kafka as log bus'],
    links: 'observability — *owned-concept lives in* (metrics/traces/alerting/SLOs; logs are one pillar conceptually); messaging-streaming — *depends on* (log transport + backpressure + DLQ); blob-store — *feeds into* (cold log archival); system-design — *feeds into*',
    providers: 'generic (ELK/EFK, Loki, Fluentd/Vector, Kafka bus), aws (CloudWatch Logs + Kinesis Data Firehose), azure (Monitor Logs / Log Analytics), gcp (Cloud Logging)',
    defends: '#6 ignoring failure',
  },
  {
    name: 'task-scheduling', triggers: '"task scheduler", "job queue", "background jobs", "cron at scale", "delayed / scheduled / recurring tasks", "worker pool", "Celery / Sidekiq / Airflow", "async job processing", "task leasing"',
    owns: 'distributed scheduling (cron/delayed/recurring), task→worker allocation, worker leasing/visibility timeout, priorities & fairness, retries + idempotency FOR TASKS, dedup. Builds ON TOP OF messaging-streaming queues (depends on them; does not reimplement delivery).',
    sources: [`${SRC}/system-design-solutions/README.md (asynchronism)`, `${GUIDE}`, 'plus standard knowledge: Celery/Sidekiq, Airflow, Quartz, leasing'],
    links: 'messaging-streaming — *depends on* (queues are the transport; this adds scheduling/leasing); resilience-failure — *pairs with* (retry policy + backoff); api-design — *depends on* for the idempotency-key contract (link); consistency-coordination — *depends on* (leader election for the scheduler); system-design — *feeds into*',
    providers: 'generic (Celery/Sidekiq/Quartz, Airflow, Temporal), aws (EventBridge Scheduler, Step Functions, SQS + Lambda), azure (Logic Apps, Durable Functions), gcp (Cloud Scheduler + Cloud Tasks + Workflows), temporal (durable workflows for reliable scheduling/retries/timeouts)',
    defends: '#2, #6',
  },
  {
    name: 'sharded-counters', triggers: '"sharded counter", "distributed counter", "count likes / views at scale", "high-write counter", "hot counter contention", "approximate counting", "real-time counts", "HyperLogLog"',
    owns: 'sharded/striped counters, write-contention avoidance (spread writes across N shards, sum on read), aggregation on read, approximate counting (HyperLogLog for uniques), exact-vs-eventual count trade-off, time-windowed counts',
    sources: [`${SRC}/system-design-solutions/README.md`, `${GUIDE}`, 'plus standard knowledge: write-sharded counters, HyperLogLog, Redis INCR'],
    links: 'data-storage — *depends on* (where shards live; partitioning theory lives there — link); caching — *pairs with* (serve the cached aggregate); consistency-coordination — *depends on* (exact vs eventual count); system-design — *feeds into*',
    providers: 'generic (Redis INCR + key sharding, Cassandra counters, HyperLogLog), aws (DynamoDB atomic counters + write sharding), azure (Cosmos DB), gcp (Bigtable / Spanner). Keep cloud files lean — only the contention/atomicity differences that change the recipe.',
    defends: '#1 fundamentals',
  },
]

const MANIFEST = {
  type: 'object',
  required: ['skill', 'files_written', 'self_check'],
  properties: {
    skill: { type: 'string' },
    files_written: { type: 'array', items: { type: 'string' } },
    self_check: {
      type: 'object',
      required: ['has_options', 'has_trade_offs_table', 'has_behavior_under_stress', 'has_how_to_apply', 'has_dos_donts', 'relations_have_verbs', 'no_external_paths', 'links_back_to_orchestrator', 'word_count'],
      properties: {
        has_options: { type: 'boolean' },
        has_trade_offs_table: { type: 'boolean' },
        has_behavior_under_stress: { type: 'boolean' },
        has_how_to_apply: { type: 'boolean' },
        has_dos_donts: { type: 'boolean' },
        relations_have_verbs: { type: 'boolean' },
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
    issues: { type: 'array', items: { type: 'object', required: ['severity', 'description'], properties: { severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] }, description: { type: 'string' }, file: { type: 'string' } } } },
    fixed: { type: 'array', items: { type: 'string' } },
    final_word_count: { type: 'number' },
  },
}

function authorPrompt(s) {
  return `You are authoring ONE new component building-block skill for the self-contained "system-design-skills" plugin. Write real files. Touch ONLY ${PLUGIN}/skills/${s.name}/.

SKILL: \`${s.name}\` (COMPONENT archetype)

STEP 1 — READ (full fidelity):
- The authoring contract — obey EVERY rule incl. "Required sections v2" (How to apply + Dos and don'ts + explicit relation verbs), the cross-cutting OWNERSHIP MAP, KISS/YAGNI, self-containment, provider rules: ${CONTRACT}
- The v2 component EXEMPLAR to match in shape and quality: ${EX}/SKILL.md , ${EX}/references/deep-dive.md , ${EX}/references/providers/aws.md
- The failure-mode guide: ${GUIDE}
- Your sources (mine for substance, then reason beyond them):
${s.sources.map(x => '  - ' + x).join('\n')}

THIS SKILL OWNS (explain in depth): ${s.owns}
DEFENDS: ${s.defends}
CROSS-LINKS (bare \`name\` in backticks, WITH the stated relation verb, <=3 sentences, never re-teach an owned-elsewhere concept): ${s.links}
PROVIDERS: ${s.providers}

STEP 2 — WRITE these files, COMPONENT archetype, contract section order:
- ${PLUGIN}/skills/${s.name}/SKILL.md — frontmatter (name: ${s.name}; third-person pushy-but-distinct description starting "This skill should be used when…" using triggers from: ${s.triggers}; don't poach another block's vocabulary). Body ~1500-2100 words, imperative, sections IN ORDER:
  purpose · "When to reach for this" · "When NOT to" · "Clarify first" · "The options" (each with a one-line use-when) · "Trade-offs" TABLE (Option | What it solves | What it worsens | Change it when) · "Behavior under stress" (load/failure behavior, what amplifies outages, what to monitor) · "How to apply" (numbered 4-6 steps: clarify inputs → pick from trade-off table → set key knobs → stress-test → size with numbers → pick provider) · "Dos and don'ts" (Do 4-6 / Don't 4-6, distilled) · "Numbers that matter" (link to \`back-of-the-envelope\`, don't restate its tables) · "Interface sketch" (if the part has a contract) · "Choosing a provider" (exact contract wording) · "Diagram" (one line → \`architecture-diagram\`, NO Mermaid) · "Related building blocks" (every link states its relation verb; back-link to \`system-design\`) · "References".
- references/deep-dive.md — mechanics that would bloat SKILL.md.
- references/providers/generic.md (REQUIRED) + the cloud files listed. Each: service mapping → generic options; only decision-changing limits ("verify against current docs"); provider trade-offs; pitfalls. ~one screen each, no catalogs.

HARD RULES: self-contained (no external file paths; siblings by bare backtick; no Mermaid); obey the ownership map (summarize + link owned-elsewhere concepts); lean/YAGNI.

STEP 3 — RETURN the manifest object describing what you wrote.`
}

function verifyPrompt(s) {
  return `Adversarially verify the just-authored COMPONENT block \`${s.name}\` in ${PLUGIN}/skills/${s.name}/. Read its files AND the contract ${CONTRACT}. Assume problems exist.

Check: (1) all v2 component sections present + in order, incl. Trade-offs TABLE, "Behavior under stress", "How to apply" numbered steps, "Dos and don'ts" two-list; (2) frontmatter name=="${s.name}", third-person distinct triggers, no vocabulary poaching; (3) DRY ownership map — owned-elsewhere concepts (consistent hashing, sharding, CAP, rate limiting, idempotency keys, latency/QPS numbers, log pipeline vs SLOs, queues-vs-scheduling) summarized + linked, not re-taught; (4) self-containment — no external paths, siblings by bare backtick, no Mermaid, Diagram points to \`architecture-diagram\`; (5) Related links each carry a relation verb + back-link to \`system-design\`; (6) every references/… and providers/… path mentioned exists (generic.md present); (7) lean (~1300-2200 words).

Apply MINOR fixes directly (wording, missing back-link/verb, trim a duplicated paragraph to a link, fix a broken path, remove stray Mermaid). Record structural problems you can't safely fix. Return the verdict object: pass=true only if no critical/high issues remain after fixes.`
}

phase('Author')
const results = await pipeline(
  SKILLS,
  (s) => agent(authorPrompt(s), { label: `author:${s.name}`, phase: 'Author', schema: MANIFEST, agentType: 'general-purpose' }),
  (m, s) => agent(verifyPrompt(s), { label: `verify:${s.name}`, phase: 'Verify', schema: VERDICT, agentType: 'general-purpose' }),
)

const v = results.filter(Boolean)
log(`Authored + verified ${v.length}/${SKILLS.length} new blocks`)
return { verdicts: v, passed: v.filter(x => x.pass).length, total: SKILLS.length }
