# Clarifying-question catalog

The full question bank that would bloat SKILL.md, a worked vague→concrete
example, and a fill-in template. Read when scoping a real prompt, or when the five
headline questions in SKILL.md aren't enough for an unfamiliar domain.

Use these to *narrow*, not to *complete*. Ask the highest-leverage ones first
(the ones that change the architecture), record the answers, and turn the rest
into written assumptions. Three to five good questions usually move a vague prompt
to a designable one.

## How to ask

- Lead with leverage: audience and core feature, then scale, then the quality
  attributes (latency, availability, consistency). Button colors come last or
  never.
- One question at a time, then listen. A wall of twenty questions reads as a
  checklist, not a conversation.
- When there's no answer, state an assumption out loud and write it down:
  "assuming reverse-chronological, not ranked — flag me if that's wrong." Silent
  assumptions are the ones that detonate later.

## The question bank (by category)

### Functional — what the system does
- What are the one or two core user journeys? (post→fan-out→read; upload→encode→
  stream; search→rank→return)
- Web, mobile, or both? Any offline/sync expectations?
- Who are the actors (end user, admin, internal service, third party)?
- What are the inputs and outputs of each core action?
- Is ordering meaningful (reverse-chronological vs ranked vs relevance)?
- What must happen synchronously vs what can be deferred/async?

### Scale — the inputs estimation needs
- DAU/MAU, and what fraction is active concurrently at peak?
- Growth horizon — what scale in 3, 6, 12 months? (Design for the horizon, not
  just today.)
- Actions per user per day for each core action?
- Read:write ratio — which path dominates?
- Object/payload sizes — per record, per media blob?
- Retention — how long is data kept? (drives total storage)
- Peak factor — how spiky is traffic vs average?

> These are inputs only. The conversion to QPS, storage, bandwidth, and server
> counts belongs to `back-of-the-envelope`, which owns those tables and the math.

### Latency & availability
- p50/p99 latency target for each core journey? (a feed read and a payment differ)
- Availability target in nines, and tied to which journey?
- Is degraded service acceptable (stale data, partial results) over an error?
  This pre-answers many `resilience-failure` choices.

### Consistency & durability
- Must reads see their own writes? Strong vs eventual consistency per data type.
- How bad is data loss — can a small recent-write window be lost, or never?
- Are there transactional invariants (money, inventory, bookings) that can't
  diverge? Deep treatment lives in `consistency-coordination`.

### Constraints & environment
- Existing tech stack or platform mandate? Services already available to reuse?
- Cost ceiling, team size, deadline — these bound complexity as hard as scale.
- Compliance/residency (PII, regions, audit) that forces structure?
- Security/authz boundaries between actors?

## Worked example: "Design a news feed"

Vague prompt → clarifying pass → three scoped lists.

**Clarifying answers (from the conversation):** both web and mobile; core actions
are *post* and *view friends' feed*; reverse-chronological; up to ~5,000 friends;
10M DAU; feed may contain text, images, video; reads dominate; eventual
consistency acceptable; p99 < 200ms for a feed load.

**Functional requirements**
- Post a message (text + optional media).
- View a reverse-chronological feed of followed users.
- Follow / unfollow a user.

**Non-functional constraints** (raw inputs; quantify in `back-of-the-envelope`)
- 10M DAU, read-heavy (assume ~95% reads); peak ≈ 2× average.
- p99 < 200ms for feed load.
- Eventual consistency acceptable; brief staleness OK.
- Media stored as blobs; feed payload references, not embeds, large media.
- Up to ~5,000 follows per user (a fan-out hot-spot signal).

**Out of scope (explicitly excluded)**
- Feed ranking / relevance (reverse-chronological only).
- Ads, analytics, notifications, direct messaging.
- Content moderation, trending, search.
- Multi-region active-active.

That third list is as important as the first two: it keeps the design focused and
makes the boundary a decision rather than an accident. The "5,000 follows" note is
the kind of detail that later forces a hybrid push/pull fan-out — capture it now,
design it later.

## Fill-in template

```
PROMPT (restated in one sentence):
  ____________________________________________________________

FUNCTIONAL REQUIREMENTS (ranked; verb-first, user-visible):
  1. ____________________   (core)
  2. ____________________   (core)
  3. ____________________   (core)
  …deferred: __________________________________________________

NON-FUNCTIONAL CONSTRAINTS (raw numbers → back-of-the-envelope):
  Scale:        DAU/MAU __  growth horizon __  actions/user/day __
  Ratio:        read:write __
  Sizes:        per-record __  per-blob __   retention __
  Latency:      p99 __ for journey __
  Availability: __ nines; degraded mode acceptable? __
  Consistency:  strong | eventual (per data type) __
  Durability:   loss tolerance __
  Constraints:  stack __  cost/team/deadline __  compliance __

OUT OF SCOPE (explicitly excluded for focus):
  - ____________________
  - ____________________

ASSUMPTIONS (stated aloud, revisable):
  - ____________________
```

## When requirements change mid-design

A constraint change is an invitation to show the design is driven by reasoning,
not attachment. The disciplined move:

1. Name the changed constraint ("now p99 < 50ms", "now we must survive a region
   loss").
2. State which earlier assumption it invalidates ("long-polling no longer meets
   the latency budget").
3. Re-scope the affected part — update the relevant list — and let the redesign
   follow from the new requirement, rather than patching the old design to fit.

This keeps the three lists the single source of truth that every later decision,
and every `back-of-the-envelope` number, traces back to.
