# Collaboration playbook

A design discussion is a working session between teammates, not a lecture. The
GUIDE's failure modes #9 and #10 are both about *stance*: monologuing, and
defending a design when constraints change. This playbook is how to stay
collaborative and adaptable — which is itself a primary signal of seniority.

## Narrate the thinking loop

Think out loud. State the problem you're solving *right now*, justify the choice
under the *current* assumptions, and name the breaking point. Three sentences per
decision:

> "Right now I'm solving read latency for the feed. A read-through cache works
> because reads are ~95% and staleness of a few seconds is acceptable. I'd
> revisit this if we needed read-your-writes — then I'd add write-through for the
> author's own timeline."

This invites the user in and turns the session into a design review.

## Treat hints as collaboration, not correction

When the user asks a question or pushes back, it is usually a hint, not an attack.
Pause, ask a clarifying question, and adjust. Defending a flawed idea rigidly is a
worse signal than the flawed idea itself.

- ❌ "No, my design already handles that." (defensive)
- ✅ "Good point — let me check that path… you're right, the fan-out service is a
  SPOF there. Let me add a queue so a worker crash doesn't drop events."

## Handle curveballs as diagnosis, not patching

When the user introduces a curveball ("load just doubled"), do **not** reach for a
generic fix ("add more servers"). Diagnose first, like a production incident:

- Did the user count rise, or did per-user load rise?
- Are DB latencies climbing? Is the cache hit rate dropping?
- Is the bottleneck in compute, storage, or the network?

Narrow to the actual bottleneck before proposing a change. Suggesting sharding
when the bottleneck is the compute tier is the classic mis-diagnosis. → skills
`scaling-evolution`, `resilience-failure`.

## Pivot when constraints change

A constraint change is an invitation to show your design is driven by reasoning,
not attachment. The move:

1. **Name the invalidated assumption** explicitly: "We assumed eventual
   consistency was fine; if balances must be exact, that assumption is gone."
2. **Scope the blast radius:** which part must change, and what can stay.
3. **Redesign that part** and re-state its new trade-offs.

Examples of constraint → pivot:

| New constraint | Likely pivot |
|---|---|
| Latency must be < 50 ms | HTTP long-polling → push (WebSocket/SSE); add edge/caching |
| Lose a whole region | Single-region → multi-region; pick consistency vs availability per CAP |
| Reads go 10× | Add replicas / read-through cache; denormalize the read model |
| Writes go 10× | Add ingestion queue; shard the write path; batch |
| Celebrity / hot key | Push (fan-out-on-write) → hybrid push/pull |
| Exact correctness now required | Eventual → strong consistency; add transactions/saga |

Be willing to *erase a box you just drew*. Senior engineers discard solutions when
the problem changes; junior engineers force the old solution to fit.

## When to ask the user a real question

Narrating and adapting is the default. But when a requirement is genuinely
ambiguous **and** the answer materially changes the design (consistency model,
single- vs multi-region, sync vs async), ask a focused clarifying question rather
than guessing silently. Guessing on a load-bearing assumption and building on it
is failure mode #3 in disguise.

## Wrap-up etiquette

- Recap the design, especially if you offered alternatives — refresh the user's
  memory after a long session.
- Never say it's perfect. Name the current bottleneck and what you'd improve with
  more time. This shows critical thinking and leaves a strong final impression.
- Mention operations: how you'd monitor, what metric tells you it's time to evolve
  to the next scale curve.
