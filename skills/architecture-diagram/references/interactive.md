# Interactive / collaborative diagram (optional)

For *iterating on* an architecture with the user — not just presenting it. An
interactive diagram lets the user toggle layers, filter connection types, zoom,
and click components to leave comments that compile into a feedback prompt. This
fits the plugin's collaborative ethos (treat the design as a dialogue, pivot on
constraints). Read this only when an interactive map is wanted; the static
diagram in SKILL.md is the default.

Adapted from the open-source "playground / code-map" pattern.

## Layout
```
+-------------------+----------------------------------+
|  Controls         |  SVG canvas (nodes + connections)|
|  • View presets   |  with zoom controls              |
|  • Layer toggles  |  Legend (bottom-left)            |
|  • Connection     +----------------------------------+
|    type filters   |  Prompt output  [ Copy Prompt ]  |
|  Comments (n)     |                                  |
+-------------------+----------------------------------+
```

## Self-contained requirements
- **Single HTML file**, inline CSS/JS, no external deps (same as the static
  diagram). Dark theme, monospace for code/labels.
- **Live render:** a single `state` object; every control writes to it, the SVG
  re-renders on every change (no "Apply" button).
- **Copy button** with brief "Copied!" feedback. This always works.

## Model
```javascript
const nodes = [
  { id:'svc', label:'Feed Service', subtitle:'stateless', x:100, y:130, w:150, h:48,
    layer:'service', color:'#34d399' },
  // ...
];
const connections = [
  { from:'lb', to:'svc', type:'data-flow', label:'① /v1/feed' },
  { from:'svc', to:'cache', type:'data-flow' },
  { from:'svc', to:'queue', type:'event' },
];
function render() {
  // draw connections first (behind), then visible nodes
  connections.filter(c => state.types[c.type]).forEach(drawConnection);
  nodes.filter(n => state.layers[n.layer]).forEach(drawNode);
}
```

## Connection types (match the static diagram's semantics)
| Type | Color | Style | Use for |
|---|---|---|---|
| `data-flow` | `#3b82f6` | solid | request/response, sync calls |
| `replication` | `#a78bfa` | dashed | DB replication, async copy |
| `event` | `#ef4444` | short dash | async events, pub/sub, queues |
| `fallback` | `#f97316` | long dash | degradation / failover paths |

Arrowheads via per-color SVG `<marker>`s (see `design-system.md`).

## Click-to-comment → prompt
1. Click a node → modal with component name + a textarea.
2. Save → add to the comments list, mark the node (colored border), regenerate the
   prompt.
3. The prompt combines context + only the user's comments:
   ```
   This is the <system> architecture (layers: <visible>).
   Feedback on specific components:
   **Feed Service** — add read-your-writes for the author's own timeline.
   **Fan-out queue** — what's the retry/DLQ policy here?
   ```

## Optional: send-to-Claude transport
The Copy-Prompt button is the self-contained default. If — and only if — a prompt
transport is available in the environment (e.g. the external `playground-sync`
MCP server on `localhost`), a "Send to Claude" button can POST the prompt so it
returns to the conversation without copy-paste. Detect availability and fall back
to Copy if absent. **This plugin neither bundles nor requires that server**; do
not add a hard dependency on it.
