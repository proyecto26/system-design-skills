---
name: api-design
description: This skill should be used when the user needs to "design the API", do "endpoint design", pin down a "request/response shape", choose a "pagination" strategy (cursor vs offset), add an "idempotency key" to a write, plan "API versioning", an "error contract", or pick between "REST vs gRPC vs GraphQL" or "WebSocket vs polling". Use it whenever a design has reached the interface — the concrete request, response, primary access path, and how clients page, retry, and version — even if the user only said "the boxes talk to each other".
---

# API Design

Define the contract between clients and a service: the exact request and response
shapes, how callers page through data, how retried writes stay safe, how errors
are reported, and how the contract evolves. Get this vague and the rest of the
diagram is guesswork (GUIDE #8) — a "NoSQL box" or "user service" solves nothing
until you can write the request, the response, and the key it hits.

## When to reach for this
The design has named services and a datastore, and you now need the *interface*:
what a client sends, what it gets back, how it fetches the next page, how it
retries a payment without double-charging, and how a v1 client survives a v2
deploy. Reach here the moment someone says "fetch the feed" or "store the post"
without a shape.

## When NOT to
Before requirements and scale are pinned — the protocol choice depends on
read/write ratio and latency target, not taste (→ `requirements-scoping`,
`back-of-the-envelope`). Don't reach for gRPC, GraphQL, or streaming because they
sound modern; a plain REST/JSON endpoint is the cheapest contract that meets most
constraints, and naming a fancier protocol you don't need is a YAGNI red flag.
Internal data-access keys and partition design live in `data-storage`; this skill
designs the *external* contract that mirrors them.

## Clarify first
- **Call shape** — request/response (CRUD), bidirectional/real-time, or one
  request → many results (streaming)? This picks the protocol.
- **Read/write ratio and result-set size** — drives pagination and whether reads
  need their own optimized path (→ `back-of-the-envelope`).
- **Retry safety** — can a write be safely repeated? Which operations are
  naturally idempotent (PUT/DELETE) vs not (POST that creates/charges)?
- **Client diversity & churn** — public third parties (slow to upgrade, need
  strict versioning) vs your own apps (ship together)?
- **Latency & payload budget** — mobile/high-latency links favor compact binary
  and fewer round trips; browsers favor cacheable HTTP.

## The options

**Protocol / style** (pick per call shape)
- **REST over HTTP/JSON** — resource CRUD over standard verbs. Use as the default
  for public, cacheable, browser-friendly APIs.
- **RPC / gRPC (HTTP/2, protobuf)** — typed method calls, compact binary,
  streaming. Use for internal service-to-service traffic where latency and schema
  contracts matter.
- **GraphQL** — client specifies exactly the fields it wants in one query. Use
  when many clients need different shapes of the same graph and over/under-fetching
  on REST hurts.
- **WebSocket / SSE (streaming)** — persistent server→client push. Use when the
  server must push updates (chat, presence, live feeds) — see the polling tier below.
- **Webhooks** — server calls *the client's* URL on an event. Use for async,
  third-party event delivery.

**Server-push tier** (when clients need fresh data)
- **Polling** → **long-polling** → **SSE** → **WebSocket**, in increasing
  efficiency for push and increasing connection cost. Start at polling; escalate
  only when a number (update frequency, fanout) forces it.

**Pagination**
- **Cursor (keyset)** — opaque token over a stable sort key. Default for large or
  changing datasets.
- **Offset/limit** — `?offset=40&limit=20`. Use only for small, mostly-static,
  jump-to-page lists.

**Idempotency** — client sends an `Idempotency-Key` on unsafe writes; the server
dedupes retries. This skill owns the key contract (see Interface sketch).

**Versioning** — URI (`/v2/...`), header (`Accept: application/vnd.x.v2+json`), or
additive/never-break. Prefer additive; reserve a new version for breaking changes.

## Trade-offs

| Option | What it solves | What it worsens | Change it when |
|---|---|---|---|
| REST/JSON | Universal, cacheable, simple, tooling everywhere | Over/under-fetch; chatty for graphs; weak typing | Field-shaping pain → GraphQL; internal latency → gRPC |
| gRPC/RPC | Compact, typed, fast, native streaming | Not browser-native; needs proxy; opaque to HTTP caches | Public/browser clients need it → REST gateway |
| GraphQL | One round trip, client picks fields | Caching/rate-limiting hard; expensive queries (N+1); server complexity | Few fixed shapes (REST simpler) or query cost unbounded |
| WebSocket/SSE | True server push, low-latency updates | Stateful connections, harder to scale/LB, reconnection logic | Updates are infrequent → long-poll; one-way only → SSE |
| Cursor pagination | Stable under inserts; O(1) per page at any depth | Opaque token; no random page jump; needs sort key | Users must jump to page N of a static set → offset |
| Offset pagination | Trivial; arbitrary page jumps | Drift/dupes on insert; deep offsets scan & slow | Set grows or mutates → cursor |
| Idempotency keys | Safe retries; no double-charge | Server must store keys + dedupe; key TTL/scope to define | Op is naturally idempotent (PUT/DELETE) → may skip |
| URI versioning | Explicit, cache/log-visible, easy to route | Version sprawl; clients pinned forever | Changes are additive → no new version needed |

## Behavior under stress
The contract decides how badly a client *amplifies* an incident.

- **Retry storms.** A timed-out write that isn't idempotent gets retried and may
  double-execute; clients retrying in lockstep stampede a recovering service.
  Idempotency keys make retries safe; the backoff/jitter that *paces* them is owned
  by `resilience-failure`. Surface `429` + `Retry-After` so well-behaved clients slow down.
- **Deep pagination.** Offset pagination at large offsets forces the store to scan
  and discard rows — a cheap-looking endpoint becomes a full-table scan under a
  crawler. Cursor pagination keeps every page O(page-size).
- **Unbounded responses.** No default page size, no max payload, or a GraphQL query
  that fans out → one request exhausts memory/CPU. Cap page size, depth, and
  complexity at the contract.
- **Connection exhaustion.** WebSocket/SSE hold a connection per client; a
  reconnect storm after a deploy can exhaust file descriptors and load-balancer
  slots. Plan reconnect with jitter and connection limits.
- **Versioning breakage.** A non-additive change to a shared shape breaks every
  client at once — the loudest self-inflicted outage. Make changes additive;
  deprecate behind a version.

**Monitor:** error-rate by status class (4xx vs 5xx), p99 latency per endpoint,
retry/idempotency-replay rate, page-depth distribution, open connection count, and
per-version traffic (to know when an old version can be retired).

## How to apply
1. **Clarify the inputs.** Pin call shape, read/write ratio, result-set size,
   retry safety, client diversity, and latency/payload budget (see *Clarify
   first*). No contract before these are known.
2. **Pick the protocol and pagination from the trade-off table.** Default to
   REST/JSON; escalate to gRPC (internal latency/typing), GraphQL (many field
   shapes), or a push tier (server must push) only when an input forces it.
   Default pagination to cursor; reserve offset for small, static, jump-to-page sets.
3. **Set the key knobs.** Choose idempotent verbs by safety (GET/PUT/DELETE safe
   to retry, POST not), define the `Idempotency-Key` contract and its TTL, fix a
   stable error envelope, and pick a versioning policy (additive by default).
4. **Stress-test the contract.** Cap default and max page size, GraphQL
   depth/complexity, and payload size; plan reconnect-with-jitter and connection
   limits for push; surface `429` + `Retry-After`. Confirm a v1 client survives a
   v2 deploy.
5. **Size it with numbers.** Estimate requests/s per endpoint, response size,
   pages-per-session, and update-frequency × fanout; use these to confirm the
   protocol and poll-vs-push choice (→ `back-of-the-envelope`).
6. **Pick a provider.** Keep the generic recipe unless the user names a cloud,
   then map to its managed gateway (see *Choosing a provider*).

## Dos and don'ts
**Do**
- Default to REST/JSON and cursor pagination; escalate only when a number forces it.
- Choose verbs by retry safety so retries are correct by construction.
- Require an `Idempotency-Key` on every non-idempotent write and bound its TTL.
- Cap page size, query depth/complexity, and payload so worst-case cost is bounded.
- Keep one stable error envelope (code, message, request_id, retryable) across every endpoint.

**Don't**
- Reach for gRPC, GraphQL, or streaming because they sound modern (YAGNI red flag).
- Use offset pagination on growing or mutating sets — deep offsets scan the store.
- Ship a non-additive change to a shared shape without a new version.
- Leave responses unbounded (no default page size, no max payload).
- Re-teach retries/backoff or sharding here — link to `resilience-failure` / `data-storage`.

## Numbers that matter
Estimate before choosing: requests/s per endpoint, average and max response size,
page size × pages-per-session (drives read load), and update frequency × fanout
(decides poll vs push). A few rules of thumb that flip a decision: a binary
protocol (protobuf) commonly cuts payload several-fold over JSON, and compression
helps again before the wire — both matter most on mobile/high-latency links where
round trips dominate. Polling at interval `T` for `N` clients is `N/T` requests/s
of mostly-empty answers; once that approaches the push tier's connection budget,
switch to SSE/WebSocket. Cap page size (and GraphQL depth/complexity) so worst-case
response cost is bounded, and keep an idempotency key's stored window bounded
(e.g. 24h) so the dedupe table doesn't grow without limit. For the canonical
latency/QPS/payload reference figures, go to `back-of-the-envelope` — don't restate
its tables here.

## Interface sketch
Make the contract concrete. A read with cursor pagination and an error envelope:

```
GET /v1/users/{id}/posts?limit=20&cursor=eyJ0cyI6MTciLCJpZCI6Ijk5In0
200 OK
{ "data": [ { "id": "p_881", "created_at": "...", "text": "..." } ],
  "next_cursor": "eyJ0cyI6...",          // null when no more pages
  "has_more": true }

# error envelope — stable shape across every endpoint
4xx/5xx
{ "error": { "code": "rate_limited", "message": "…", "request_id": "req_…",
             "retryable": true } }
```

An idempotent write (this skill's owned contract):

```
POST /v1/payments
Idempotency-Key: 9f1c-… (client-generated UUID, unique per logical operation)
{ "amount": 4200, "currency": "usd", "source": "card_…" }

# Server: first request with a key → execute, store (key → response) for a TTL.
# Retry with same key → return the stored response, do NOT re-execute.
# Same key + different body → 422 (key reuse conflict).
```

Mirror the response shape to the access pattern: cursor encodes the partition/sort
key the store pages on (PK/SK design is owned by `data-storage`). Pick verbs by
safety — GET (safe), PUT/DELETE (idempotent), POST (not), so retries are correct
by construction.

## Choosing a provider
Default to the generic recipe above. If the user names a cloud, read
`references/providers/<provider>.md` for the managed-service mapping,
quotas/limits, and provider-specific trade-offs. If no file exists for that
provider, the generic recipe is the answer.

## Diagram
To visualize the request/response path, the cursor-paging loop, or an
idempotent-retry sequence (client → gateway → service → store, with the replay
branch), use the in-plugin `architecture-diagram` skill — do not embed Mermaid
here. A one-line ASCII sketch inline is fine for quick reasoning.

## Related building blocks
- `data-storage` — *depends on* it: the request/response and cursor shapes mirror its primary key and access patterns (sharding/partitioning lives there); design them together.
- `resilience-failure` — *pairs with* it: it owns retries/backoff/jitter, timeouts, and rate limiting, while idempotency keys (owned here) are what make those retries safe.
- `consistency-coordination` — *pairs with* it when a retried or concurrent write must not violate an invariant; CAP/quorum theory lives there.
- `messaging-streaming` — *alternative to* synchronous request/response when the contract is async events or webhooks.
- `system-design` — *feeds into* this: the orchestrator routes here at the interface step.

## References
- **`references/deep-dive.md`** — protocol mechanics (HTTP verbs/status discipline, gRPC streaming modes, GraphQL query-cost limits), cursor-token construction, the full idempotency-key state machine, versioning/deprecation strategy, and error-contract design. Read when designing the contract in detail.
- **`references/providers/{generic,aws,azure,gcp}.md`** — API-gateway / managed-endpoint mappings, limits that change a decision, and pitfalls per environment.
