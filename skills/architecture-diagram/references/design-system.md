# Diagram design system

The styling rules behind `assets/template.html`. Adapted from the open-source
"Architecture Diagram" skill (MIT, Cocoon AI) and tuned for system-design use.
Read before drawing.

## Typography & background
- **Font:** a system **monospace** stack (`'JetBrains Mono', ui-monospace,
  'SF Mono', Menlo, Consolas, monospace`) — no web-font fetch, so rendering stays
  fully offline/self-contained. 12px component names, 9px sublabels, 8px
  annotations, 7px tiny labels.
- **Background:** `#020617` (slate-950) with a subtle grid:
  ```svg
  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" stroke-width="0.5"/>
  </pattern>
  ```

## Component boxes
Rounded rectangles (`rx="6"`), 1.5px stroke, semi-transparent fill (see the
semantic color table in SKILL.md). Pattern:
```svg
<rect x="X" y="Y" width="W" height="H" rx="6" fill="FILL" stroke="STROKE" stroke-width="1.5"/>
<text x="CX" y="Y+20" fill="white" font-size="11" font-weight="600" text-anchor="middle">LABEL</text>
<text x="CX" y="Y+36" fill="#94a3b8" font-size="9" text-anchor="middle">sublabel</text>
```

## Boundaries
- **Security groups:** dashed stroke (`stroke-dasharray="4,4"`), transparent fill,
  rose (`#fb7185`).
- **Region boundaries:** larger dashes (`stroke-dasharray="8,4"`), amber, `rx="12"`.

## Arrows (data flow)
Use a marker for arrowheads; color by meaning:
```svg
<marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
  <polygon points="0 0, 10 3.5, 0 7" fill="#64748b"/>
</marker>
```
- **Solid** arrows = happy-path / synchronous calls. **Dashed** = async,
  replication, or fallback/degradation paths. **Rose dashed** = auth/security flow.
- **Number the arrows** (`①②③`) to show request order.
- **Message bus / queue:** a small orange connector (`#fb923c` stroke,
  `rgba(251,146,60,0.3)` fill) placed *in the gap* between services.

### Z-order & masking (important)
SVG paints in document order. Draw connection arrows **early** (right after the
grid) so they render *behind* boxes. Because boxes use semi-transparent fills,
arrows would still show through — mask them by drawing an **opaque** background
rect (`fill="#0f172a"`) at the box position *before* the styled semi-transparent
rect on top.

## Spacing (avoid overlaps)
- Service box height ~60px; larger components 80–120px.
- **Minimum 40px vertical gap** between stacked components.
- Place inline connectors (buses) centered in the gap, never overlapping a box.

Example: A at y=70 h=60 (ends 130) → 40px gap (bus at y=140, 20px tall) → B at y=170.

## Legend placement
Place legends **outside** all boundary boxes. Compute where the lowest boundary
ends and put the legend ≥20px below it; extend the SVG viewBox height to fit.

## Layout structure (the template)
1. **Header** — title with pulsing dot, subtitle, export toolbar.
2. **Main SVG** — in a rounded border card (default viewBox `1000 × 680`).
3. **Summary cards** — grid of 3 cards below the diagram for key
   decisions/trade-offs (mirror the design doc).
4. **Footer** — minimal metadata.

## Export toolbar (keep intact)
A `⋯` toggle reveals 📋 Copy / 🖼️ PNG / 📄 PDF, all via `html2canvas` (and jsPDF
for PDF). Preserve in the template:
- The two pinned CDN `<script>`s in `<head>` with their **SRI hashes** (don't
  alter the hashes; if bumping versions, recompute them).
- `id="report-container"` on the outer `.container`.
- The `.toolbar` markup/CSS and the `copyAsImage()` / `downloadPNG()` /
  `downloadPDF()` functions, plus `@media print { .toolbar { display:none } }`.

Caveats: clipboard needs a user gesture + secure context (file/https/localhost).
Bump `scale: 2` → 3/4 for higher-res export.

## Info card pattern
```html
<div class="card">
  <div class="card-header"><div class="card-dot COLOR"></div><h3>Title</h3></div>
  <ul><li>• Item one</li><li>• Item two</li></ul>
</div>
```
