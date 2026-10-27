import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Player } from "@remotion/player";
import { HeroFilm, FILM } from "./HeroFilm.jsx";
import TL from "./timeline.json";

/** Index of the slide on screen; a clip plays only while its slide is active. */
export const ActiveSlide = createContext(0);

const sec = (s) => Math.round(s * FILM.fps);

/**
 * Named ranges of the hero film, so slides reuse a scene without re-implementing it.
 * `poster` is the settled frame shown under reduced motion: inside the range and before any
 * fade-out (the full film's last frames are an exit fade to an empty background).
 */
export const CLIPS = {
  full: { from: 0, to: FILM.durationInFrames - 1, poster: sec(TL.s5.url + 1.2) },
  compose: { from: sec(TL.s4.in), to: sec(TL.s4.exit) - 1, poster: sec(TL.s4.exit) - 1 },
  loop: { from: sec(TL.s3.in), to: sec(TL.s3.exit) - 1, poster: sec(TL.s3.exit) - 1 },
};

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const on = (e) => setReduce(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

/**
 * The same Remotion composition that renders docs/hero.mp4, played live in the page.
 * With reduced motion it holds on the clip's settled poster frame instead of playing.
 */
export function FilmClip({ slide, clip = "full", label, className = "film" }) {
  const ref = useRef(null);
  const active = useContext(ActiveSlide) === slide;
  const reduce = usePrefersReducedMotion();
  const { from, to, poster } = CLIPS[clip];

  useEffect(() => {
    const p = ref.current;
    if (!p) return;
    if (import.meta.env.DEV) (window.__films ||= {})[clip] = p;
    if (!active || reduce) {
      p.pause();
      p.seekTo(reduce ? poster : from);
      return;
    }
    // Start once the page fonts are ready and the Player has painted, so the first frames
    // don't flash fallback type.
    let cancelled = false;
    let raf = 0;
    document.fonts.ready.then(() => {
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => {
          if (cancelled) return;
          p.pause();
          p.seekTo(from);
          p.play();
        });
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [active, reduce, from, poster]);

  return (
    <div className={className} role="img" aria-label={label}>
      <Player
        ref={ref}
        component={HeroFilm}
        compositionWidth={FILM.width}
        compositionHeight={FILM.height}
        durationInFrames={FILM.durationInFrames}
        fps={FILM.fps}
        inFrame={from}
        outFrame={to}
        initialFrame={reduce ? poster : from}
        loop
        controls={false}
        clickToPlay={false}
        doubleClickToFullscreen={false}
        acknowledgeRemotionLicense
        // Silent film: no shared <audio> tags, so play() needs no user gesture (autoplay policy).
        numberOfSharedAudioTags={0}
        initiallyMuted
        style={{ width: "100%", aspectRatio: `${FILM.width} / ${FILM.height}`, display: "block" }}
      />
    </div>
  );
}
