import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { C, F, prog, easeOut } from "./lib.js";

/** Anthropic-style 4-spoke spark (same path as the site's <Spike />). */
export const Spark = ({ size = 40, color = C.coral, rotate = 0, style }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} style={{ transform: `rotate(${rotate}deg)`, ...style }} aria-hidden="true">
    <path fill={color} d="M12 1c.5 4.6 1 6.4 2.6 8 1.6 1.6 3.4 2.1 8 2.6 0 0 0 .5 0 .8-4.6.5-6.4 1-8 2.6-1.6 1.6-2.1 3.4-2.6 8-.3 0-.5 0-.8 0-.5-4.6-1-6.4-2.6-8C7 13.8 5.2 13.3.6 12.8c0-.3 0-.5 0-.8 4.6-.5 6.4-1 8-2.6C10.2 7.8 10.7 6 11.2 1.4c.3 0 .5 0 .8 0z" />
  </svg>
);

/**
 * Masked word reveal: each word slides up out of a clip with a slight tilt.
 * `words` items are strings, or { t: "word", accent: true } for the one italic coral word per line.
 */
export const Mask = ({ words, at, stagger = 0.09, dur = 0.8, size = 104, color = C.ink, align = "center" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: align, columnGap: size * 0.26, lineHeight: 1 }}>
      {words.map((w, i) => {
        const word = typeof w === "string" ? { t: w } : w;
        const p = prog(frame, fps, at + i * stagger, at + i * stagger + dur);
        return (
          <span key={i} style={{ overflow: "hidden", display: "inline-block", paddingBottom: size * 0.14, marginBottom: -size * 0.14 }}>
            <span
              style={{
                display: "inline-block",
                transform: `translateY(${(1 - p) * 110}%) rotate(${(1 - p) * 4}deg)`,
                transformOrigin: "left bottom",
                fontFamily: F.serif,
                fontWeight: 500,
                fontStyle: word.accent ? "italic" : "normal",
                fontSize: size,
                letterSpacing: "-0.02em",
                fontVariantNumeric: "lining-nums",
                color: word.accent ? C.coral : color,
              }}
            >
              {word.t}
            </span>
          </span>
        );
      })}
    </div>
  );
};

/** Mono eyebrow label: uppercase, wide tracking, muted. Decoration, not content. */
export const Label = ({ children, color = C.muted, size = 22, style }) => (
  <div style={{ fontFamily: F.mono, fontSize: size, letterSpacing: "0.22em", textTransform: "uppercase", color, ...style }}>{children}</div>
);

/** Number that rolls up to `to` between t0 and t1. */
export const Roll = ({ to, t0, t1, format = (v) => v.toFixed(0), style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const v = interpolate(prog(frame, fps, t0, t1, easeOut), [0, 1], [0, to]);
  return <span style={{ fontVariantNumeric: "lining-nums tabular-nums", ...style }}>{format(v)}</span>;
};

/** Film grain, reseeded on twos so it shimmers without strobing. */
export const Grain = ({ opacity = 0.07 }) => {
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 2) % 97;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "multiply", opacity }}>
      <svg width="100%" height="100%">
        <filter id={`grain-${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};

/** Cream floor + a dot grid drifting a few px/s + soft vignette. Nothing is dead-still. */
export const Background = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drift = (frame / fps) * 6;
  return (
    <AbsoluteFill style={{ background: C.canvas }}>
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${C.cardStrong} 1.6px, transparent 1.7px)`,
          backgroundSize: "36px 36px",
          backgroundPosition: `${drift}px ${drift * 0.6}px`,
          opacity: 0.9,
        }}
      />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(232,224,210,0.85) 100%)` }} />
    </AbsoluteFill>
  );
};
