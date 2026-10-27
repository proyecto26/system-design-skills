import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { C, F, TL, prog, sp, envelope, easeIn, easeInOut, POP, HEAVY } from "./lib.js";
import { Background, Grain, Label, Mask, Roll, Spark } from "./primitives.jsx";

export const FILM = { width: 1920, height: 1080, fps: TL.fps, durationInFrames: Math.round(TL.duration * TL.fps) };

const Scene = ({ env, children }) => (
  <AbsoluteFill style={{ opacity: env.opacity, transform: `translateY(${env.y}px)` }}>{children}</AbsoluteFill>
);

const Center = ({ top, children, style }) => (
  <div style={{ position: "absolute", left: 0, right: 0, top, display: "flex", flexDirection: "column", alignItems: "center", ...style }}>{children}</div>
);

/* ---------- 1. A prompt: "/design WhatsApp for 1B users" ---------- */
const PROMPT = "/design WhatsApp for 1B users";

const PromptScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const s = TL.s1;
  // The bar is on screen from frame 0 (frame 0 is the thumbnail); only its exit animates.
  const out = prog(frame, fps, s.exit, s.exit + 0.4, easeIn);
  const typed = Math.max(0, Math.min(PROMPT.length, Math.floor((t - s.typeStart) / ((s.typeEnd - s.typeStart) / PROMPT.length))));
  const typing = t >= s.typeStart && t < s.typeEnd;
  const caretOn = typing || Math.floor(t * 2.4 * 2) % 2 === 0;
  const enter = sp(frame, fps, s.submit, POP);
  return (
    <AbsoluteFill style={{ opacity: 1 - out, transform: `translateY(${-out * 60}px) scale(${1 - out * 0.06})` }}>
      <Center top={330}>
        <Label>system design · one part at a time</Label>
      </Center>
      <Center top={450}>
        <div
          style={{
            width: 1180, height: 132, borderRadius: 66, background: C.white, border: `2px solid ${C.hairline}`,
            boxShadow: "0 24px 60px rgba(20,20,19,0.08)", display: "flex", alignItems: "center", padding: "0 30px 0 44px", gap: 28,
          }}
        >
          <Spark size={46} rotate={t * 20} />
          <div style={{ flex: 1, fontFamily: F.mono, fontSize: 44, color: C.ink, whiteSpace: "pre" }}>
            {typed === 0 ? <span style={{ color: C.mutedSoft }}>Design a system with Claude…</span> : PROMPT.slice(0, typed)}
            <span style={{ display: "inline-block", width: 4, height: 50, marginLeft: 4, verticalAlign: "-8px", background: C.coral, opacity: caretOn ? 1 : 0 }} />
          </div>
          <div
            style={{
              width: 76, height: 76, borderRadius: 38, display: "flex", alignItems: "center", justifyContent: "center",
              background: interpolate(enter, [0, 1], [0, 1]) > 0.5 ? C.coral : C.card,
              color: C.white, fontFamily: F.sans, fontSize: 34, transform: `scale(${1 + 0.12 * Math.sin(Math.min(1, enter) * Math.PI)})`,
            }}
          >
            ↵
          </div>
        </div>
      </Center>
    </AbsoluteFill>
  );
};

/* ---------- 2. The memorized diagram breaks under a real constraint ---------- */
const MEMO = [
  { label: "Client", x: 560 },
  { label: "App server", x: 960 },
  { label: "Database", x: 1360 },
];

const BreakScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = TL.s2;
  const env = envelope(frame, fps, s.in, s.exit);
  const crack = prog(frame, fps, s.crack, s.crack + 0.5);
  const dim = 1 - crack * 0.55;
  const drop = sp(frame, fps, s.constraint, POP);
  const shakeT = frame / fps - s.crack;
  const shake = shakeT > 0 ? Math.sin(shakeT * 48) * 10 * Math.exp(-shakeT * 5) : 0;
  return (
    <Scene env={env}>
      <Center top={150}><Mask at={s.in + 0.1} size={112} words={["Memorized", "diagrams", { t: "break.", accent: true }]} /></Center>
      <svg width="1920" height="1080" style={{ position: "absolute", inset: 0 }}>
        {[0, 1].map((i) => {
          const p = prog(frame, fps, s.drawOn + 0.35 + i * 0.25, s.drawOn + 0.85 + i * 0.25);
          const x1 = MEMO[i].x + 150, x2 = MEMO[i + 1].x - 150;
          return (
            <g key={i} opacity={dim}>
              <line x1={x1} y1={640} x2={x1 + (x2 - x1) * p} y2={640} stroke={C.muted} strokeWidth={3} />
              {p > 0.98 && <path d={`M${x2 - 14} 630 L${x2} 640 L${x2 - 14} 650`} fill="none" stroke={C.muted} strokeWidth={3} />}
            </g>
          );
        })}
        <path
          d="M1318 582 L1346 622 L1330 646 L1372 676 L1356 702"
          fill="none" stroke={C.coral} strokeWidth={4} strokeLinecap="round"
          strokeDasharray={200} strokeDashoffset={200 * (1 - crack)}
        />
      </svg>
      {MEMO.map((b, i) => {
        const inP = sp(frame, fps, s.drawOn + i * 0.2);
        const isDb = i === 2;
        return (
          <div
            key={b.label}
            style={{
              position: "absolute", left: b.x - 150, top: 580, width: 300, height: 120, borderRadius: 14,
              background: C.card, border: `2px ${isDb && crack > 0 ? "dashed" : "solid"} ${isDb && crack > 0 ? C.coral : C.cardStrong}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: F.sans, fontWeight: 600, fontSize: 32, color: C.ink,
              opacity: inP * (isDb ? 1 : dim),
              transform: `translateY(${(1 - inP) * 30}px) translateX(${isDb ? shake : 0}px) rotate(${isDb ? crack * 5 : 0}deg)`,
            }}
          >
            {b.label}
          </div>
        );
      })}
      <div
        style={{
          position: "absolute", left: 1360 - 190, top: 440, width: 380, textAlign: "center",
          opacity: Math.min(1, drop * 1.4), transform: `translateY(${(1 - drop) * -80}px)`,
        }}
      >
        <span style={{ background: C.coral, color: C.white, borderRadius: 999, padding: "14px 28px", fontFamily: F.mono, fontSize: 28 }}>
          100B messages / day
        </span>
      </div>
      <Center top={790} style={{ opacity: prog(frame, fps, s.crack + 0.35, s.crack + 0.9) }}>
        <Label size={24}>a constraint changed — nothing underneath to rebuild it</Label>
      </Center>
    </Scene>
  );
};

/* ---------- 3. The reasoning loop, with a real number ---------- */
const STEPS = ["Clarify", "Estimate", "Compose", "Trade-offs", "Stress-test"];
const RING = { cx: 960, cy: 670, r: 330 };

const LoopScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const s = TL.s3;
  const env = envelope(frame, fps, s.in, s.exit);
  const reached = interpolate(t, s.steps, [0, 1, 2, 3, 4], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeInOut });
  const arc = prog(frame, fps, s.steps[0] - 0.2, s.steps[0]) * (reached + 0.0001) / 5;
  const circ = 2 * Math.PI * RING.r;
  const active = s.steps.reduce((a, st, i) => (t >= st ? i : a), -1);
  return (
    <Scene env={env}>
      <Center top={120}><Mask at={s.in + 0.1} size={104} words={["So", "reason", "it", { t: "out loud.", accent: true }]} /></Center>
      <svg width="1920" height="1080" style={{ position: "absolute", inset: 0 }}>
        <circle cx={RING.cx} cy={RING.cy} r={RING.r} fill="none" stroke={C.hairline} strokeWidth={3} />
        <circle
          cx={RING.cx} cy={RING.cy} r={RING.r} fill="none" stroke={C.coral} strokeWidth={5} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - Math.min(1, arc + 0.0))}
          transform={`rotate(-90 ${RING.cx} ${RING.cy})`}
        />
      </svg>
      {STEPS.map((name, i) => {
        const a = (-90 + i * 72) * (Math.PI / 180);
        const x = RING.cx + RING.r * Math.cos(a), y = RING.cy + RING.r * Math.sin(a);
        const pop = sp(frame, fps, s.steps[i], POP);
        const isActive = i === active;
        const done = i < active;
        return (
          <div
            key={name}
            style={{
              position: "absolute", left: x - 130, top: y - 36, width: 260, height: 72, borderRadius: 36,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
              background: isActive ? C.coral : done ? C.ink : C.white,
              color: isActive || done ? C.white : C.muted,
              border: `2px solid ${isActive ? C.coral : done ? C.ink : C.hairline}`,
              fontFamily: F.sans, fontWeight: 600, fontSize: 30,
              transform: `scale(${0.9 + 0.1 * Math.min(1, pop) + (isActive ? 0.06 * Math.sin(Math.min(1, pop) * Math.PI) : 0)})`,
              opacity: 0.55 + 0.45 * Math.min(1, pop),
            }}
          >
            <span style={{ fontFamily: F.mono, fontSize: 20, opacity: 0.7 }}>{String(i + 1).padStart(2, "0")}</span>
            {name}
          </div>
        );
      })}
      <div
        style={{
          position: "absolute", left: RING.cx - 260, top: RING.cy - 40, width: 520, textAlign: "center",
          opacity: prog(frame, fps, s.steps[1], s.steps[1] + 0.4),
        }}
      >
        <div style={{ fontFamily: F.serif, fontWeight: 600, fontSize: 112, color: C.ink, lineHeight: 1, letterSpacing: "-0.02em", fontVariantNumeric: "lining-nums tabular-nums" }}>
          <Roll to={1.157} t0={s.steps[1]} t1={s.steps[1] + 1.1} format={(v) => `${v.toFixed(2)}M`} />
        </div>
        <Label size={20} style={{ marginTop: 14 }}>msg / sec · 100B ÷ 86,400 s</Label>
      </div>
    </Scene>
  );
};

/* ---------- 4. Twenty building blocks; eight compose into an architecture (hero moment) ---------- */
const BLOCKS = [
  "requirements-scoping", "back-of-the-envelope", "api-design", "data-storage", "caching",
  "load-balancing", "messaging-streaming", "consistency-coordination", "resilience-failure", "content-delivery",
  "scaling-evolution", "service-decomposition", "dns", "sequencer", "blob-store",
  "observability", "distributed-logging", "distributed-search", "task-scheduling", "sharded-counters",
];
// Where the picked blocks land: a left-to-right request path for a messaging backend.
const LAYOUT = {
  dns: [250, 560],
  "load-balancing": [600, 560],
  "api-design": [950, 560],
  caching: [1300, 400],
  "messaging-streaming": [1300, 560],
  sequencer: [1300, 720],
  "data-storage": [1650, 480],
  "blob-store": [1650, 660],
};
const WIRES = [
  ["dns", "load-balancing"], ["load-balancing", "api-design"], ["api-design", "caching"],
  ["api-design", "messaging-streaming"], ["api-design", "sequencer"], ["messaging-streaming", "data-storage"],
  ["caching", "data-storage"], ["messaging-streaming", "blob-store"],
];
const TILE = { w: 300, h: 64 };
const gridPos = (i) => [162 + TILE.w / 2 + (i % 5) * 324, 400 + Math.floor(i / 5) * 86];

const ComposeScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = TL.s4;
  const env = envelope(frame, fps, s.in, s.exit);
  const pick = prog(frame, fps, s.pick, s.pick + 0.45);
  const fadeRest = prog(frame, fps, s.pick + 0.15, s.assemble + 0.1, easeIn);
  const picked = Object.keys(LAYOUT);
  return (
    <Scene env={env}>
      <Center top={130}>
        <Mask at={s.in + 0.1} size={92} words={["20", "building", "blocks.", { t: "Composed,", accent: true }, "not", "copied."]} />
      </Center>
      <svg width="1920" height="1080" style={{ position: "absolute", inset: 0 }}>
        {WIRES.map(([a, b], k) => {
          const [x1, y1] = LAYOUT[a], [x2, y2] = LAYOUT[b];
          const p = prog(frame, fps, s.wires + k * 0.07, s.wires + k * 0.07 + 0.45);
          const sx = x1 + TILE.w / 2, ex = x2 - TILE.w / 2;
          const mx = (sx + ex) / 2;
          const d = `M${sx} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${ex} ${y2}`;
          return <path key={k} d={d} fill="none" stroke={C.coral} strokeWidth={3} strokeDasharray={600} strokeDashoffset={600 * (1 - p)} opacity={0.85} />;
        })}
      </svg>
      {BLOCKS.map((name, i) => {
        const isPicked = picked.includes(name);
        const k = picked.indexOf(name);
        const inP = sp(frame, fps, s.tiles + i * 0.035);
        const fly = isPicked ? sp(frame, fps, s.assemble + k * 0.05, HEAVY) : 0;
        const [gx, gy] = gridPos(i);
        const [lx, ly] = isPicked ? LAYOUT[name] : [gx, gy];
        const x = gx + (lx - gx) * fly, y = gy + (ly - gy) * fly;
        const hot = isPicked ? pick : 0;
        const opacity = isPicked ? Math.min(1, inP) : Math.min(1, inP) * (1 - pick * 0.7) * (1 - fadeRest);
        const filled = isPicked && fly > 0.5;
        return (
          <div
            key={name}
            style={{
              position: "absolute", left: x - TILE.w / 2, top: y - TILE.h / 2, width: TILE.w, height: TILE.h, borderRadius: 12,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: filled ? C.coral : C.card,
              border: `2px solid ${hot > 0.5 ? C.coral : C.cardStrong}`,
              color: filled ? C.white : hot > 0.5 ? C.coralDeep : C.body,
              fontFamily: F.mono, fontSize: 22, fontWeight: 500,
              opacity, transform: `translateY(${(1 - Math.min(1, inP)) * 26}px) scale(${1 + hot * 0.04})`,
              boxShadow: filled ? "0 14px 30px rgba(204,120,92,0.28)" : "none",
            }}
          >
            {name}
          </div>
        );
      })}
    </Scene>
  );
};

/* ---------- 5. End card ---------- */
const EndScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = TL.s5;
  const env = envelope(frame, fps, s.in, TL.duration - 0.45, 0.8);
  const spark = sp(frame, fps, s.spark, { damping: 8, stiffness: 200 });
  return (
    <Scene env={env}>
      <Center top={250}>
        <Spark size={84} rotate={(1 - Math.min(1, spark)) * -120 + (frame / fps) * 8} style={{ transform: `scale(${spark})` }} />
      </Center>
      <Center top={380}><Mask at={s.line1} size={116} words={["Design", "systems", "by", { t: "reasoning,", accent: true }]} /></Center>
      <Center top={520}><Mask at={s.line2} size={116} words={["not", "by", "memorizing", "diagrams."]} /></Center>
      <Center top={720} style={{ opacity: prog(frame, fps, s.meta, s.meta + 0.6) }}>
        <Label size={24} color={C.body}>22 skills · Claude Code · Codex · Agent Plugins</Label>
      </Center>
      <Center top={790} style={{ opacity: prog(frame, fps, s.url, s.url + 0.6) }}>
        <div style={{ fontFamily: F.sans, fontWeight: 500, fontSize: 34, color: C.ink }}>github.com/proyecto26/system-design-skills</div>
      </Center>
    </Scene>
  );
};

// `grain` is off for the README GIF: animated noise defeats GIF compression (~20 MB vs a few MB).
export const HeroFilm = ({ grain = true }) => (
  <AbsoluteFill style={{ background: C.canvas, overflow: "hidden" }}>
    <Background />
    <PromptScene />
    <BreakScene />
    <LoopScene />
    <ComposeScene />
    <EndScene />
    {grain && <Grain />}
  </AbsoluteFill>
);

