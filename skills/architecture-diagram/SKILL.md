---
name: architecture-diagram
description: This skill should be used when a system design needs a diagram — "draw the architecture", "diagram this system", "show the components", "make an architecture/infrastructure/topology diagram", or visualizing boxes-and-arrows, data flow, regions, or failure paths for a design. It generates a self-contained dark-theme HTML + SVG diagram (with PNG/PDF export). Use it whenever the `system-design` orchestrator or a building block reaches the "draw it" step, even if the user doesn't say "diagram".
---

# Architecture Diagram

Turn a stabilized design — a list of components and the connections between them —
into a polished, self-contained **HTML + SVG** diagram. Components are boxes,
arrows are communication/data flow, dashed boundaries are regions or trust zones.
This is the diagramming engine for the whole plugin; the orchestrator and building
blocks hand off here when it's time to draw.

> Self-contained by design: one HTML file with inline SVG and CSS, a system
> monospace font (no web-font fetch), and **no dependency to render** — it draws
> fully offline. The *only* external calls are two pinned, SRI-protected CDN
> scripts that power the **optional** PNG/PDF export; remove them and the diagram
> still renders — only the export buttons are lost.

## When to reach for this
At step 3 (high-level design) and step 6 (deep-dive) of the reasoning loop, and
any time a design is clear enough to draw: the component list and their
connections are known. Also for failure-path diagrams (step 5) — showing a
degradation flow is part of the design.

## When NOT to
Before the design has stabilized — don't draw boxes that aren't yet justified
(that's failure mode #7). A quick ASCII sketch in the conversation is fine for
early thinking; render with this skill once the components have earned their place.

## How to build a diagram

1. **Gather the spec** from the design: the list of components (each with a type),
   the directed connections (with protocol/label), and any region/boundary
   groupings. The `system-design` design-doc already produces this.
2. **Copy the template** `assets/template.html` to a working file. It carries the
   dark theme, grid background, fonts, the export toolbar, and the summary-card
   layout — keep those intact.
3. **Map each component to a semantic type** (color) using the table below.
4. **Place boxes and draw arrows** following the layout/spacing rules in
   `references/design-system.md` (draw arrows before boxes so they sit behind;
   mask arrows behind semi-transparent fills; keep ≥40px vertical gaps; legends
   go outside boundary boxes).
5. **Label the flow** — number arrows to show request order; use dashed arrows for
   async/replication/fallback; dashed boundaries for regions and security groups.
6. **Fill the summary cards** with the key decisions/trade-offs (ties to the
   design doc), update the title/footer.
7. **Open it**: `open <file>.html` to view; the toolbar exports PNG/PDF.

## Semantic colors (map components to types)

These align with how the building blocks think about a system.

| Component type | Fill (rgba) | Stroke | Used for |
|---|---|---|---|
| Frontend / client | `rgba(8,51,68,0.4)` | `#22d3ee` | web/mobile clients, edge |
| Backend / service | `rgba(6,78,59,0.4)` | `#34d399` | app/API services, workers |
| Database / store | `rgba(76,29,149,0.4)` | `#a78bfa` | SQL/NoSQL, object store |
| Cache | `rgba(8,51,68,0.4)` | `#38bdf8` | Redis/Memcached, CDN cache |
| Message bus / queue | `rgba(251,146,60,0.3)` | `#fb923c` | Kafka, SQS, queues, streams |
| Cloud / managed | `rgba(120,53,15,0.3)` | `#fbbf24` | managed services, regions |
| Security / auth | `rgba(136,19,55,0.4)` | `#fb7185` | gateways, auth, firewalls |
| External / generic | `rgba(30,41,59,0.5)` | `#94a3b8` | third parties, DNS |

Full styling, arrow markers, masking, spacing, and legend rules are in
`references/design-system.md`.

## Output rules
- One self-contained `.html` file: inline CSS, inline SVG, no external images.
- Keep the two pinned CDN scripts (html2canvas + jsPDF) with their SRI hashes —
  they power Copy/PNG/PDF export and nothing else. The diagram renders fully
  without them; they're only needed for export.
- Avoid SVG `<foreignObject>` (renders inconsistently in html2canvas) — use plain
  `<rect>`/`<text>`.
- Keep it to ~8–15 components for a high-level view; zoom into one subsystem for a
  deep-dive rather than cramming everything into one picture.

## Dos and don'ts

**Do:**
- Draw only after the design stabilizes; render the component list and connections the design doc already produced.
- Map every box to a semantic type from the color table so the diagram reads at a glance.
- Draw arrows before boxes (so they sit behind), number them for request order, and reserve dashed arrows for async/replication/fallback.
- Keep it to ~8–15 components; zoom into one subsystem for a deep-dive instead of one crowded picture.
- Keep the file self-contained — inline CSS/SVG, system monospace font, no external images — so it renders offline.

**Don't:**
- Don't embed Mermaid or invent a second diagram convention; this skill is the one engine.
- Don't use SVG `<foreignObject>` (html2canvas renders it inconsistently) — use plain `<rect>`/`<text>`.
- Don't strip or rewrite the pinned CDN scripts' SRI hashes; recompute them only when bumping versions.
- Don't place legends inside boundary boxes or stack components with under-40px gaps — both cause overlaps.
- Don't add a hard dependency on any send-to-Claude transport; the Copy-Prompt button is the self-contained default.

## Interactive / collaborative mode (optional)
For iterating *with* the user, an interactive variant adds layer toggles,
connection-type filters, zoom, and click-to-comment that builds a feedback prompt
with a Copy button. See `references/interactive.md`. It degrades gracefully: the
Copy-Prompt button always works. A live "Send to Claude" button is possible only
if a separate prompt-transport plugin (e.g. playground-sync) is installed — this
plugin does **not** require or bundle one.

## Related building blocks
- `system-design` — *invoked by* the orchestrator at the "draw it" steps; its diagramming notes feed what to draw at each step.
- Any building block — *invoked by* a block whose "Diagram" section says "render with `architecture-diagram`". This skill *renders for* all of them; it owns diagram generation and they point here rather than ship their own.

## References
- **`references/design-system.md`** — colors, arrow markers, z-order/masking, spacing, legend placement, the export toolbar internals. Read before drawing.
- **`references/interactive.md`** — the optional interactive/commentable diagram pattern and the (optional) send-to-Claude transport. Read only if building an interactive map.

## Assets
- **`assets/template.html`** — the self-contained dark-theme HTML+SVG starting point with the export toolbar. Copy and customize it.
