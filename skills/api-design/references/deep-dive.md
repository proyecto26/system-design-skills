# API design deep-dive

Mechanics that would bloat SKILL.md. Read when designing the contract in detail.

## HTTP verb & status discipline (the REST contract)

The verb encodes retry safety; the status encodes the outcome. Get these wrong
and clients can't retry correctly.

- **GET** — safe, idempotent, cacheable. Never mutate state in a GET.
- **PUT** — idempotent replace; repeating it lands the same final state.
- **PATCH** — partial update; *not* guaranteed idempotent (depends on the patch).
- **DELETE** — idempotent (deleting twice = still deleted).
- **POST** — neither safe nor idempotent; this is the verb that *needs* an
  idempotency key (creates, charges, sends).

Status classes clients branch on: **2xx** success; **4xx** client error (don't
retry as-is — fix the request); **409** conflict; **422** validation;
**429** rate-limited (retry after backoff); **5xx** server error (retryable with
backoff). The split between "retryable" (5xx, 429) and "don't bother" (most 4xx)
is what lets a client retry without making things worse.

## Cursor (keyset) pagination mechanics

A cursor is an **opaque, encoded position** in a stable sort order — not a page
number. Construct it from the columns the query sorts on so the next page is a
range scan, not an offset scan:

```
-- page 1
SELECT ... WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 20;
-- cursor encodes the last row's (created_at, id)
-- page 2
SELECT ... WHERE user_id = ?
  AND (created_at, id) < (:cursor_ts, :cursor_id)
  ORDER BY created_at DESC, id DESC LIMIT 20;
```

Rules: include a **tiebreaker** (a unique id) in the sort so rows with equal
timestamps don't get skipped or duplicated; **base64url-encode** the cursor and
treat it as opaque so you can change its internals later; sign or version it if
clients shouldn't forge positions. Cursor pagination is stable under inserts
(new rows appear at the head, not shifting your window) and stays O(page-size) at
any depth — the reason it beats offset for feeds and logs. Its cost: no "jump to
page N" and no total count without a separate query.

Offset pagination (`LIMIT n OFFSET m`) is fine for small static lists, but at
large `m` the store scans and discards `m` rows per page, and concurrent inserts
shift every row so pages drift (duplicates/skips). Don't expose deep offsets on a
mutable, growing dataset.

## Idempotency-key state machine (owned contract)

The key turns "did my retried POST run twice?" into a guarantee. The server keeps
a table keyed by `(idempotency_key, scope)`:

1. **Request arrives with key.** Atomically insert the key in a `pending` state.
   - Insert succeeds → this is the first attempt; proceed to execute.
   - Insert fails (key exists) → a retry. If the stored entry is `complete`,
     return the **stored response** verbatim; if still `pending`, the original is
     in-flight → return `409` (or block/poll briefly).
2. **On completion**, store the response (status + body) against the key, mark
   `complete`, set a TTL (e.g. 24h — long enough to cover client retry windows,
   short enough to bound the table).
3. **Same key, different request body** → reject `422`: a key identifies one
   logical operation; reusing it for a different payload is a client bug.

Scope the key to the authenticated caller (and often the endpoint) so two clients
can't collide. Persist the key+response in a store that survives the write
(transactional with the side effect where possible) — otherwise a crash between
"did the work" and "saved the key" reopens the double-execution window. This is
why naturally idempotent verbs (PUT/DELETE) often don't need a key at all. For the
*retry/backoff/jitter* that drives clients to resend, and for distributed locks
guarding the critical section, see `resilience-failure` and
`consistency-coordination`.

## Versioning & deprecation

- **Additive, non-breaking changes** (new optional fields, new endpoints) need no
  version bump — clients ignore unknown fields. Make this the norm.
- **Breaking changes** (remove/rename a field, change a type, tighten validation)
  require a new version. Carriers: **URI** (`/v2/…`, explicit and cache/log
  visible, most common), **header/media-type** (`Accept: …v2+json`, cleaner URLs,
  harder to debug), or **query param** (`?version=2`, easy but easy to forget).
- **Deprecation lifecycle:** announce → emit a `Deprecation`/`Sunset` header and
  log usage → monitor per-version traffic → retire only when the old version's
  traffic is near zero. Never delete a version while clients still call it.

Tolerant readers (ignore unknown fields, don't depend on field order) extend the
life of a single version and are the cheapest forward-compat insurance.

## Protocol mechanics

- **gRPC streaming modes:** unary (1↔1), server-streaming (1 req → many resp),
  client-streaming (many req → 1 resp), bidirectional. Built on HTTP/2 multiplexed
  streams; protobuf gives a typed, compact, versioned schema (add fields with new
  tag numbers; never reuse a tag). Needs a proxy (e.g. grpc-web/gateway) to reach
  browsers.
- **GraphQL query cost:** a single query can fan out (N+1 resolvers, deep nesting).
  Defend with **depth limits**, **complexity/cost scoring**, **persisted queries**
  (allowlist), and per-resolver batching (dataloader). Caching is harder than REST
  because every query URL is unique — cache at the resolver/entity level.
- **Server-push ladder:** polling (simple, wasteful), long-polling (hold the
  request until data or timeout), SSE (one-way server→client over a single HTTP
  stream, auto-reconnect), WebSocket (full-duplex, stateful). Escalate only when
  update frequency/fanout justify the connection cost; the push-vs-poll line is in
  SKILL.md's stress section.

## Error contract design

Return **one error envelope shape across every endpoint** so clients write one
parser: a machine-readable `code` (stable string, not a sentence), a human
`message`, a `request_id` for support/correlation, and an explicit `retryable`
flag. Keep `code` stable across versions — clients branch on it. Don't leak stack
traces or internal identifiers. Map domain errors to the right status class so the
retry behavior above is correct.

## Common mistakes

- Mutating state in a GET (breaks caches and safe-retry assumptions).
- Offset pagination on a growing/mutable set (drift, deep-scan slowdowns).
- POST that creates/charges with no idempotency key (double-execution on retry).
- Breaking a shared response shape in place instead of versioning additively.
- No default/max page size, depth, or complexity limit (one request OOMs the box).
- Inconsistent error shapes per endpoint (every client needs a special case).
- Treating WebSocket like stateless HTTP (forgetting reconnect storms and per-
  connection memory).
