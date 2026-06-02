import React from "react";
import { ReactFlow, Background, Handle, Position } from "@xyflow/react";

/* A reusable node with hidden source+target handles on all four sides, so any
   edge can connect cleanly to the right side of the box (this is what fixes the
   misplaced-arrowhead / disconnected-line problem — edges attach to handles). */
function StepNode({ data }) {
  const variant = data.variant ? ` rf-node--${data.variant}` : "";
  const sides = [
    [Position.Left, "l"], [Position.Right, "r"],
    [Position.Top, "t"], [Position.Bottom, "b"],
  ];
  return (
    <div className={`rf-node${variant}`}>
      {sides.map(([pos, k]) => (
        <React.Fragment key={k}>
          <Handle id={`${k}t`} type="target" position={pos} />
          <Handle id={`${k}s`} type="source" position={pos} />
        </React.Fragment>
      ))}
      {data.step && <div className="n-step">{data.step}</div>}
      <div className="n-title">{data.title}</div>
      {data.sub && <div className="n-sub">{data.sub}</div>}
    </div>
  );
}

// nodeTypes MUST live outside any component body (prevents re-mount churn).
const nodeTypes = { step: StepNode };

const presentationProps = {
  nodeTypes,
  fitView: true,
  fitViewOptions: { padding: 0.16 },
  nodesDraggable: false,
  nodesConnectable: false,
  elementsSelectable: false,
  panOnDrag: false,
  zoomOnScroll: false,
  zoomOnPinch: false,
  zoomOnDoubleClick: false,
  panOnScroll: false,
  preventScrolling: false,
  proOptions: { hideAttribution: true },
};

/* ---------------- Reasoning loop ---------------- */
const loopNodes = [
  { id: "1", type: "step", position: { x: 0, y: 0 },   data: { step: "1", title: "Clarify", sub: "FR / NFR / scope" } },
  { id: "2", type: "step", position: { x: 250, y: 0 }, data: { step: "2", title: "Estimate", sub: "QPS · storage" } },
  { id: "3", type: "step", position: { x: 500, y: 0 }, data: { step: "3", title: "Design", sub: "compose blocks" } },
  { id: "4", type: "step", position: { x: 750, y: 0 }, data: { step: "4", title: "Trade-offs", sub: "solves / worsens" } },
  { id: "5", type: "step", position: { x: 750, y: 200 }, data: { step: "5", title: "Failure modes", sub: "SPOF · degrade" } },
  { id: "6", type: "step", position: { x: 250, y: 200 }, data: { step: "6", title: "Iterate", sub: "name the broken assumption", variant: "coral" } },
];
const loopEdges = [
  { id: "e12", source: "1", target: "2", sourceHandle: "rs", targetHandle: "lt", type: "smoothstep", animated: true },
  { id: "e23", source: "2", target: "3", sourceHandle: "rs", targetHandle: "lt", type: "smoothstep", animated: true },
  { id: "e34", source: "3", target: "4", sourceHandle: "rs", targetHandle: "lt", type: "smoothstep", animated: true },
  { id: "e45", source: "4", target: "5", sourceHandle: "bs", targetHandle: "tt", type: "smoothstep", animated: true },
  { id: "e56", source: "5", target: "6", sourceHandle: "ls", targetHandle: "rt", type: "smoothstep", animated: true },
  { id: "e61", source: "6", target: "1", sourceHandle: "ts", targetHandle: "bt", type: "smoothstep", animated: true, className: "is-loop", label: "constraint changed → re-enter" },
];

export function ReasoningLoop() {
  return (
    <div className="rf-wrap">
      <ReactFlow nodes={loopNodes} edges={loopEdges} {...presentationProps}>
        <Background variant="dots" gap={22} size={1} color="#e6dfd8" />
      </ReactFlow>
    </div>
  );
}

/* ---------------- Orchestration flow ---------------- */
const orchNodes = [
  { id: "u", type: "step", position: { x: 0, y: 120 }, data: { title: "“design X”", sub: "vague prompt", variant: "soft" } },
  { id: "cmd", type: "step", position: { x: 250, y: 120 }, data: { title: "/design", sub: "or orchestrator agent", variant: "coral" } },
  { id: "req", type: "step", position: { x: 540, y: 0 }, data: { title: "requirements-scoping", sub: "FR/NFR/scope" } },
  { id: "boe", type: "step", position: { x: 540, y: 120 }, data: { title: "back-of-the-envelope", sub: "the numbers" } },
  { id: "blk", type: "step", position: { x: 540, y: 240 }, data: { title: "building blocks", sub: "data · cache · queue · …" } },
  { id: "dia", type: "step", position: { x: 860, y: 120 }, data: { title: "architecture-diagram", sub: "HTML + SVG", variant: "dark" } },
  { id: "doc", type: "step", position: { x: 1120, y: 120 }, data: { title: "scored design doc", sub: "→ docs/design/", variant: "dark" } },
];
const orchEdges = [
  { id: "o1", source: "u", target: "cmd", sourceHandle: "rs", targetHandle: "lt", type: "smoothstep", animated: true },
  { id: "o2", source: "cmd", target: "req", sourceHandle: "rs", targetHandle: "lt", type: "smoothstep", animated: true },
  { id: "o3", source: "cmd", target: "boe", sourceHandle: "rs", targetHandle: "lt", type: "smoothstep", animated: true },
  { id: "o4", source: "cmd", target: "blk", sourceHandle: "rs", targetHandle: "lt", type: "smoothstep", animated: true },
  { id: "o5", source: "req", target: "dia", sourceHandle: "rs", targetHandle: "lt", type: "smoothstep" },
  { id: "o6", source: "boe", target: "dia", sourceHandle: "rs", targetHandle: "lt", type: "smoothstep" },
  { id: "o7", source: "blk", target: "dia", sourceHandle: "rs", targetHandle: "lt", type: "smoothstep" },
  { id: "o8", source: "dia", target: "doc", sourceHandle: "rs", targetHandle: "lt", type: "smoothstep", animated: true },
];

export function OrchestrationFlow({ onDark = false }) {
  return (
    <div className={`rf-wrap ${onDark ? "rf-on-dark" : ""}`}>
      <ReactFlow nodes={orchNodes} edges={orchEdges} {...presentationProps}>
        <Background variant="dots" gap={22} size={1} color={onDark ? "#2a2825" : "#e6dfd8"} />
      </ReactFlow>
    </div>
  );
}
