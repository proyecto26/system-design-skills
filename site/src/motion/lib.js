import { Easing, getRemotionEnvironment, interpolate, spring } from "remotion";
import { loadFont as loadSerif } from "@remotion/google-fonts/CormorantGaramond";
import { loadFont as loadSans } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import TL from "./timeline.json";

export { TL };

// Palette: the site's editorial tokens (theme.css), one accent (coral) that always means "the answer".
export const C = {
  canvas: "#faf9f5",
  soft: "#f5f0e8",
  card: "#efe9de",
  cardStrong: "#e8e0d2",
  dark: "#181715",
  darkElevated: "#252320",
  hairline: "#e6dfd8",
  ink: "#141413",
  body: "#3d3d3a",
  muted: "#6c6a64",
  mutedSoft: "#8e8b82",
  coral: "#cc785c",
  coralDeep: "#a9583e",
  teal: "#5db8a6",
  white: "#ffffff",
};

// Fonts: the CLI/Studio fetch them (delayRender blocks each frame until they load). The site's
// <Player> skips this: the page already loads the same families from Google Fonts (index.html).
const env = getRemotionEnvironment();
if (env.isRendering || env.isStudio) {
  loadSerif("normal", { weights: ["500", "600"], subsets: ["latin"] });
  loadSerif("italic", { weights: ["500"], subsets: ["latin"] });
  loadSans("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });
  loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] });
}

export const F = {
  serif: `"Cormorant Garamond", Garamond, serif`,
  sans: `"Inter", -apple-system, sans-serif`,
  mono: `"JetBrains Mono", ui-monospace, Menlo, monospace`,
};

// Easing defaults (claude-motion taste rules): arrive with easeOut, leave with easeIn.
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeIn = Easing.bezier(0.6, 0, 0.9, 0.35);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

/** 0→1 tween between two timestamps (seconds). */
export const prog = (frame, fps, t0, t1, ease = easeOut) =>
  interpolate(frame / fps, [t0, t1], [0, 1], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });

/** Spring that starts at a timestamp (seconds). */
export const sp = (frame, fps, t, config = { damping: 14, stiffness: 140, mass: 0.8 }) =>
  spring({ frame: frame - Math.round(t * fps), fps, config });

export const POP = { damping: 10, stiffness: 220, mass: 0.7 };
export const HEAVY = { damping: 18, stiffness: 180, mass: 0.9 };

/** Scene envelope: enter over `inDur`, leave over half that (exits are ~half an entrance). */
export const envelope = (frame, fps, tIn, tExit, inDur = 0.7) => {
  const a = prog(frame, fps, tIn, tIn + inDur);
  const b = tExit == null ? 0 : prog(frame, fps, tExit, tExit + inDur / 2, easeIn);
  return { opacity: a * (1 - b), y: (1 - a) * 24 - b * 18 };
};

/** Deterministic pseudo-random in [0,1). */
export const rand = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
