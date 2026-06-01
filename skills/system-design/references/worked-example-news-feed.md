# Worked example: a news feed (one pass of the loop)

This shows the *reasoning*, not a template to copy. The value is in how each
choice ties to a requirement or a number, and where the breaking points are.
Another problem would route the loop differently.

## 1. Clarify
- **Functional (core):** post content; view a feed of friends' posts in reverse
  chronological order. *Out of scope:* ranking/ads/notifications (stated up front).
- **Non-functional:** web + mobile; ~10M DAU; up to ~5k friends/user; media
  allowed; feed load should feel instant; eventual consistency on the feed is
  acceptable (seeing a post a few seconds late is fine).

## 2. Estimate (→ `back-of-the-envelope`)
- Read-heavy: users view far more than they post — assume ~100:1 read:write.
- 10M DAU, a handful of feed loads each → reads dominate; writes are modest.
- Implication: **optimize reads.** Caching is forced; the feed should be
  precomputed where possible, not assembled from scratch on every view.

## 3. High-level design (→ `api-design`, building blocks)
Two flows fall out of the requirements:

- **Publish:** `POST /v1/posts` → write to post store → enqueue a fan-out job.
- **Read feed:** `GET /v1/feed?cursor=…` → read a precomputed per-user feed from
  cache.

Quick ASCII sketch for thinking (render properly with `architecture-diagram`):

```
            POST /v1/posts                 GET /v1/feed
 Clients ───────────────► Load balancer ◄───────────── Clients
                               │                           ▲
                               ▼                           │ read
                          Service tier ──────► Feed cache (per-user)
                            │      │                  ▲
                  write ────┘      └─ enqueue ─► Queue │
                            ▼                     │    │
                       Post store          Fan-out workers
 Clients ─► CDN ┄┄► Media store
```

Components and why each earns its place: load balancer (spread the read traffic),
stateless service tier (scale horizontally), post store (durable source of
truth), **fan-out workers + queue** (precompute feeds off the write path so reads
are a single cache lookup), feed cache (the read path), CDN (media, → `content-delivery`).

## 4. Trade-offs (the load-bearing decision: push vs pull)
**Fan-out-on-write (push):** precompute each user's feed when a friend posts.
- *Solves:* feed reads become one fast cache read — ideal for 100:1 read-heavy.
- *Worsens:* write amplification (one post → thousands of feed inserts); wasted
  work for inactive users.
- *Change it when:* a user has millions of followers (a celebrity) — fan-out
  becomes a write storm.

So: **hybrid.** Push for normal users; for celebrities, pull their posts at read
time and merge. This is the move that separates reasoning from a memorized
"just use fan-out" answer. (→ `messaging-streaming` for the fan-out path,
`caching` for the feed cache, `consistency-coordination` for the eventual model.)

## 5. Failure modes (→ `resilience-failure`)
- **Fan-out worker down:** posts still persist; feeds rebuild when workers
  recover. Reads keep serving the last cached feed — degraded, not broken.
- **Feed cache miss/cold:** fall back to assembling the feed from the post store
  for that request (slower) rather than erroring.
- **Don't** retry fan-out indefinitely on failure — use a queue with a DLQ so a
  poison job can't amplify load.

## 6. Iterate (a curveball)
*"What if a celebrity has 50M followers?"* — Name the invalidated assumption
("push assumed bounded fan-out"), keep the rest, and switch that case to pull +
merge. *"What if reads 10×?"* — add feed-cache replicas and a read-through layer;
the write path is unaffected. The design bends locally instead of collapsing.

**Wrap:** current bottleneck is fan-out write amplification; monitor follower
distribution and feed-cache hit rate to know when to push more cases to pull.
