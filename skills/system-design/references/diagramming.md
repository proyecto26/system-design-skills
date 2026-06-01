# Diagramming a design

Diagrams represent components as boxes and communication/data flow as arrows. Use
them to *think*, not just to present.

**The diagram engine for this plugin is the in-plugin `architecture-diagram`
skill** — it generates a self-contained dark-theme HTML+SVG diagram (with optional
PNG/PDF export) from a component list and their connections. It ships inside this
plugin, so there is no external dependency. Hand off to it once the design is
clear enough to draw.

For *early* thinking in the conversation, a quick ASCII sketch is fine — it's
disposable and keeps momentum. Render properly with `architecture-diagram` once
the components have earned their place (drawing boxes you can't justify is failure
mode #7).

## What to draw at each loop step

- **Step 3 (high-level):** one diagram of the whole system — clients, load
  balancer, stateless services, stores, caches, queues, CDN — with the API entry.
  Keep it to ~8–15 components; this is the buy-in artifact.
- **Step 6 (deep-dive):** zoom into one subsystem (the critical request path or a
  data-partitioning view), with the concrete API/keys from `api-design` /
  `data-storage`. Don't cram the whole system into the deep-dive picture.
- **Step 5 (failure):** draw the degradation path — e.g. gateway → fallback cache
  when a service times out. A design's failure behavior is part of the design.

## Conventions (handled by the architecture-diagram skill)

The `architecture-diagram` skill encodes these; summarized here so the orchestrator
can specify a diagram precisely:

- **Semantic colors by component type:** frontend/client, backend/service,
  database/store, cache, message-bus/queue, cloud/managed, security/auth,
  external/generic. (Full palette in that skill's `references/design-system.md`.)
- **Boxes** = components; **cylinders/dashed groups** = stores and
  regions/trust-boundaries.
- **Arrows** = protocol + data flow, **numbered** to show request order. **Solid**
  = sync/happy path; **dashed** = async, replication, or fallback.
- **Legends outside boundaries; ≥40px gaps; arrows behind boxes.**

## Specifying a diagram to the skill

Hand the `architecture-diagram` skill three things from the design doc:
1. **Components** — each with a name and a semantic type (→ color).
2. **Connections** — directed, with a protocol/label and order number; mark async
   vs sync.
3. **Groupings** — regions, trust boundaries, or tiers to enclose.

That is exactly what the design-doc template's "High-level design" section
captures, so the handoff is mechanical.

## Optional collaborative mode
For iterating *with* the user, the `architecture-diagram` skill also documents an
interactive variant (layer toggles, click-to-comment → feedback prompt). Use it
when the design is contested and you want the user to mark up components directly.
It falls back to a Copy-Prompt button and needs nothing external.
