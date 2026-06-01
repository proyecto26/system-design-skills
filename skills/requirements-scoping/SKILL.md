---
name: requirements-scoping
description: This skill should be used when the user needs to "clarify requirements", separate "functional vs non-functional requirements", "scope the problem", figure out "what questions should I ask", state the "requirements for <X>", or otherwise pin down a vague design prompt before building. It turns an ambiguous ask into functional requirements, non-functional constraints, and an explicit out-of-scope. Use it whenever a prompt is broad or under-specified ("design Twitter", "build a chat app") even if the user doesn't say "requirements".
---

# Requirements Scoping

Turn a vague prompt ("design a news feed") into three written lists: what the
system *does* (functional requirements), the numbers and qualities that *shape*
it (non-functional constraints), and what is deliberately *excluded*
(out-of-scope). Skipping this step is the most common way a design goes wrong —
it ends up solving a different problem than the one in front of it, and every
later decision rests on an unchecked assumption. The discipline is not
about being slow; it is about making the problem concrete enough that the design
choices have something to be measured against. Without it, every component is a
guess, and the first hard follow-up question collapses the whole picture.

## When to reach for this
At step 1 of any design, before drawing a single box or naming a single tool. Any
time the ask is broad ("design YouTube"), ambiguous ("a real-time system"), or
silent on scale, consistency, or audience. Reach for it again mid-design when a
new constraint appears that may invalidate an earlier assumption — a re-scope is
cheaper than a rebuild. The clearest signal is the reflex to reach for a familiar
architecture before being able to state, in one sentence, what problem it solves
here. That reflex is exactly the trap: applying a remembered solution to a prompt
no one has actually read.

## When NOT to
Don't interrogate forever. The goal is *enough* clarity to choose a first
hypothesis, not a complete spec — three to five sharp questions usually suffice,
with written assumptions for the rest. Don't gold-plate scope: every accepted
feature is one to design and defend, so push the nice-to-haves into out-of-scope
(YAGNI). And don't re-scope on every challenge; distinguish a genuine constraint
change from a clarifying nudge.

## Clarify first
The questions that change the design the most, asked in rough priority order:

- **Who uses it and how?** Audience (consumer/internal/B2B), client (mobile, web,
  both), and the one or two core user journeys. This bounds everything else.
- **What are the must-have features?** Force a ranked shortlist; the long tail is
  out-of-scope until the core works.
- **What scale?** DAU/MAU, growth horizon (3/6/12 months), read:write ratio,
  object sizes. These are the inputs `back-of-the-envelope` turns into QPS and
  storage — capture them here, quantify there.
- **What latency and availability targets?** A p99 number and a nines target,
  tied to the journey (a feed read vs a payment differ).
- **How fresh must data be, and how bad is loss?** Strong vs eventual consistency
  and durability expectations drive the hardest later trade-offs; capture the
  *requirement* (can a read be stale? can a recent write be lost?) here, and leave
  the consistency-model theory to `consistency-coordination`.

If the user can't answer, state an assumption out loud and move on ("assuming 10M
DAU, read-heavy, eventual consistency is fine") — written assumptions are
revisable; silent ones are landmines. Capture each answer in the actual words used
("up to 5,000 friends", "must survive a region loss"): a stray detail now often
turns out to be the constraint that forces a structural choice later.

## The method (recipe)
A repeatable pass from prompt to scoped problem:

1. **Restate the prompt in one sentence.** "A service where users post short
   messages and read a reverse-chronological feed of people they follow." This
   surfaces hidden assumptions immediately and gets early buy-in.
2. **List functional requirements** as user-visible capabilities, verb-first:
   *post a message, follow a user, view a feed, search.* These answer "what does
   the system *do*" — each is an action an actor can take. Keep them testable and
   free of implementation ("store in a DB" is not a requirement; "view a feed"
   is).
3. **Rank and cut to the core.** Pick the two or three that define the product.
   Explicitly defer the rest — deferral is a decision, not an omission. The core
   is what the design lives or dies by; everything else can be a follow-up.
4. **Derive non-functional constraints** from the clarifying answers. Where
   functional requirements say what the system does, non-functional ones say *how
   well* it must do it: scale (DAU, QPS inputs), latency (p99), availability
   (nines), consistency, durability, and any cost/compliance limits. These are
   the numbers a design is measured against, and the ones that force structural
   choices (sharding, caching, queues) long before any feature does.
5. **Write the out-of-scope list explicitly.** Name what is *not* being built
   (analytics, ads, moderation, multi-region) so the design stays focused and the
   boundary is visible, not accidental.
6. **Restate the three lists and confirm** before designing. This is the contract
   the rest of the work is judged against; treat it as a hypothesis to revisit if
   constraints change, not a fixed spec.

The output is three short lists, not prose. Hand the non-functional numbers to
`back-of-the-envelope` next.

## Pitfalls / where it misleads
Scoping done badly is worse than skipped, because it manufactures false
confidence. Watch for:

- **Solution-shaped requirements.** "We need Kafka / a cache / sharding" is an
  answer smuggled in as a requirement. Strip it back to the need ("absorb write
  bursts", "serve reads fast") and let the design earn the tool later.
- **Unquantified non-functionals.** "High scale", "low latency", "highly
  available" decide nothing. A requirement without a number is a wish — convert
  it via `back-of-the-envelope` before it shapes a choice.
- **Scope creep disguised as thoroughness.** Accepting every feature feels
  diligent but dilutes the design and burns the clock. The cheapest scope that
  meets the goal wins.
- **Phantom out-of-scope.** Excluding things to dodge hard parts (cutting
  consistency because it's hard) hides the real problem. Cut for focus, not to
  avoid the difficulty the prompt is actually testing.
- **Treating answers as final.** Requirements are a hypothesis. When a constraint
  changes ("now p99 < 50ms", "now we lose a region"), say which assumptions it
  invalidates and re-scope the affected part rather than patching around it.
- **Asking low-leverage questions first.** Color of the button before
  read:write ratio. Lead with the questions that move the architecture; a tidy
  list of trivia answered perfectly still leaves the real shape of the system
  unknown.
- **Monologuing the scope instead of confirming it.** Scoping is a dialogue.
  Restate the three lists and the assumptions, then pause for correction —
  treating a clarifying nudge as an attack on the scope is how a design ends up
  defending the wrong problem.

## Dos and don'ts
- **Do** restate the prompt in one sentence and lead with the highest-leverage
  questions (audience, core features, scale, latency/availability, freshness).
- **Do** write the three lists — functional, non-functional, out-of-scope —
  and treat each unanswered question as a stated, revisable assumption.
- **Do** quantify every non-functional ("p99 < 200ms", "10M DAU"), then hand the
  raw numbers to `back-of-the-envelope` to compute.
- **Do** re-scope when a genuine constraint changes, naming which assumptions it
  invalidates.
- **Don't** smuggle a solution in as a requirement ("we need Kafka"); state the
  need and let the design earn the tool.
- **Don't** accept every feature; defer the long tail to out-of-scope, and don't
  exclude hard parts just to dodge them.
- **Don't** interrogate forever or monologue the scope — get *enough* clarity for
  a first hypothesis, then confirm and move on.

## Numbers that matter
Requirements scoping *captures* the inputs; it does not compute. Pin down the raw
quantities — DAU/MAU, actions per user per day, read:write ratio, object/payload
sizes, retention, peak factor, p99 latency target, and an availability nines
target — and hand them to `back-of-the-envelope`, which owns the latency/QPS/
storage tables and the conversion math. Two figures to record verbatim because
they gate the most decisions downstream: the **read:write ratio** (a 95%-read
system invites caching; a write-burst system invites a queue) and the **scale
horizon** (a design for 1k QPS and one for 1M QPS are different systems). Keep
units and assumptions written next to each number.

## Diagram
Scoping output is three lists, not a picture — keep them as text so they stay the
editable contract everything traces back to. When the scoped requirements justify
a first high-level design, draw *that* with the in-plugin `architecture-diagram`
skill; the requirements themselves don't need a diagram.

## Related building blocks
- `back-of-the-envelope` — *feeds into* it: the non-functional numbers captured
  here (DAU, ratios, SLAs) become its QPS, storage, and server-count math. The
  next step.
- `scaling-evolution` — *feeds into* it: the growth horizon scoped here defines
  the next bottleneck to plan for, and re-scoping mid-design hands it new limits.
- `api-design` and `data-storage` — *feed into* them: the functional requirements
  and access patterns named here become concrete contracts and schemas there.
- `consistency-coordination` — *owned-concept lives there*: capture the freshness
  and durability *requirement* here; the consistency-model theory belongs to it.
- `system-design` — *called by* the orchestrator at step 1, before estimation and
  high-level design.

## References
- **`references/clarifying-question-catalog.md`** — the full question bank grouped
  by category (functional, scale, latency/availability, consistency/durability,
  constraints), a worked vague→concrete example, and a fill-in requirements
  template. Read when scoping a real prompt or when the five questions above
  aren't enough for an unfamiliar domain.
