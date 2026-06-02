import React, { useState, useEffect, useCallback } from "react";
import { ReasoningLoop, OrchestrationFlow } from "./diagrams.jsx";

/* Anthropic-style 4-spoke radial spike mark */
function Spike({ className = "spike" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 1c.5 4.6 1 6.4 2.6 8 1.6 1.6 3.4 2.1 8 2.6 0 0 0 .5 0 .8-4.6.5-6.4 1-8 2.6-1.6 1.6-2.1 3.4-2.6 8-.3 0-.5 0-.8 0-.5-4.6-1-6.4-2.6-8C7 13.8 5.2 13.3.6 12.8c0-.3 0-.5 0-.8 4.6-.5 6.4-1 8-2.6C10.2 7.8 10.7 6 11.2 1.4c.3 0 .5 0 .8 0z" />
    </svg>
  );
}

const SLIDES = [
  // 1 — Title
  (
    <section className="slide slide--cream center" data-mode="cream">
      <div className="slide-inner stagger">
        <div className="badge badge--cream"><Spike /> proyecto26 / system-design-skills</div>
        <h1 className="display" style={{ marginTop: "1.2rem" }}>Design systems by <em style={{ fontStyle: "normal", color: "var(--primary)" }}>reasoning</em>,<br />not by memorizing diagrams.</h1>
        <p className="lead" style={{ marginTop: "1.2rem" }}>A divide-and-conquer wiki of <strong>22 composable building-block skills</strong> for Claude Code — clarify, size, compose, and justify every choice.</p>
        <div className="stagger" style={{ display: "flex", gap: ".75rem", justifyContent: "center", marginTop: "1.8rem", flexWrap: "wrap" }}>
          <span className="badge badge--coral">22 skills</span>
          <span className="badge badge--cream">MIT</span>
          <span className="badge badge--cream">Claude Code plugin</span>
          <span className="badge badge--cream">self-contained</span>
        </div>
      </div>
    </section>
  ),
  // 2 — The trap
  (
    <section className="slide slide--cream" data-mode="cream">
      <div className="slide-inner split">
        <div className="stagger">
          <div className="eyebrow">The trap</div>
          <h2 className="display" style={{ margin: ".6rem 0 1rem" }}>Strong engineers fail on <em style={{ fontStyle: "normal", color: "var(--primary)" }}>signals</em>, not knowledge.</h2>
          <p className="lead">They know what a load balancer does — but freeze on “design Twitter,” reach for a memorized diagram, and can’t explain the reasoning underneath. The moment a constraint changes, the diagram falls apart.</p>
          <p style={{ marginTop: "1rem" }}><a className="tlink" href="https://proyecto26.github.io/system-design-skills/">The fix: learn the forces that shape architectures.</a></p>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          {[["#3 Rushing", "design before clarifying"], ["#4 Name-dropping", "tools without trade-offs"], ["#5 No numbers", "“high traffic” means nothing"], ["#6 Ignoring failure", "“just add retries”"], ["#7 One diagram", "memorized, not reasoned"], ["#8 Vague APIs", "no keys, no contracts"]].map(([t, s]) => (
            <div className="card" key={t}><h4>{t}</h4><p className="muted">{s}</p></div>
          ))}
        </div>
      </div>
    </section>
  ),
  // 3 — Building blocks idea
  (
    <section className="slide slide--card center" data-mode="card">
      <div className="slide-inner stagger">
        <div className="eyebrow">The idea</div>
        <h2 className="display" style={{ margin: ".6rem 0 1rem" }}>Lego, not templates.</h2>
        <p className="lead" style={{ margin: "0 auto" }}>No full-solution templates. One skill per <em style={{ fontStyle: "normal" }}>part</em> of a system — each a reusable recipe with explicit trade-offs, behavior under stress, the numbers that matter, and cloud-provider variants. You compose them to fit the problem in front of you.</p>
      </div>
    </section>
  ),
  // 4 — Reasoning loop (React Flow, dark)
  (
    <section className="slide slide--dark" data-mode="dark">
      <div className="slide-inner stagger">
        <div className="eyebrow">How it works · the loop</div>
        <h2 className="display" style={{ margin: ".4rem 0 1rem" }}>Clarify → estimate → design → trade-offs → failure → iterate</h2>
        <ReasoningLoop />
        <p className="muted" style={{ marginTop: ".8rem", fontSize: ".9rem" }}>A loop, not a checklist. A constraint change re-enters at the affected phase — and only redesigns that part.</p>
      </div>
    </section>
  ),
  // 5 — Orchestration flow (React Flow)
  (
    <section className="slide slide--cream" data-mode="cream">
      <div className="slide-inner stagger">
        <div className="eyebrow">Orchestration</div>
        <h2 className="display" style={{ margin: ".4rem 0 1rem" }}>One prompt, composed across blocks</h2>
        <OrchestrationFlow />
        <p className="muted" style={{ marginTop: ".8rem", fontSize: ".9rem" }}>The orchestrator <em style={{ fontStyle: "normal" }}>invokes</em> each building-block skill (not paraphrases it), then renders + scores the design.</p>
      </div>
    </section>
  ),
  // 6 — Bottom-up catalog
  (
    <section className="slide slide--card" data-mode="card">
      <div className="slide-inner split">
        <div className="stagger">
          <div className="eyebrow">The catalog</div>
          <h2 className="display" style={{ margin: ".6rem 0 1rem" }}>Bottom-up, L0 → L7</h2>
          <p className="lead">20 building blocks arranged so each layer depends only on the ones beneath it. Assemble a design from the floor up — frame it, then edge, services, state, async, correctness, ops, growth.</p>
        </div>
        <div className="layers">
          {[["L0 Frame", "requirements-scoping · back-of-the-envelope"], ["L1 Edge", "dns · load-balancing · content-delivery"], ["L2 Services", "api-design · service-decomposition"], ["L3 State", "data-storage · caching · blob-store · sequencer · sharded-counters · search"], ["L4 Async", "messaging-streaming · task-scheduling"], ["L5 Correctness", "consistency-coordination"], ["L6 Ops", "resilience-failure · observability · distributed-logging"], ["L7 Growth", "scaling-evolution"]].map(([c, b]) => (
            <div className="layer" key={c}><span className="lcode">{c}</span><span className="lblocks">{b}</span></div>
          ))}
        </div>
      </div>
    </section>
  ),
  // 7 — Anatomy of a block (trade-off table)
  (
    <section className="slide slide--cream" data-mode="cream">
      <div className="slide-inner stagger">
        <div className="eyebrow">Every block, one shape</div>
        <h2 className="display" style={{ margin: ".4rem 0 1rem" }}>Options → trade-offs → behavior under stress</h2>
        <table className="to">
          <thead><tr><th>Caching option</th><th>Solves</th><th>Worsens</th><th>Change it when</th></tr></thead>
          <tbody>
            <tr><td>Cache-aside</td><td>simple; resilient if cache dies</td><td>first read misses; stale after write</td><td>misses too costly → read-through</td></tr>
            <tr><td>Write-through</td><td>fresh reads after write</td><td>slower writes</td><td>writes dominate → write-back</td></tr>
            <tr><td>Write-back</td><td>absorbs write bursts</td><td>data-loss window on crash</td><td>durability required</td></tr>
            <tr><td>TTL eviction</td><td>bounds staleness</td><td>mass expiry stampedes origin</td><td>add jitter / soft-TTL</td></tr>
          </tbody>
        </table>
        <p className="muted" style={{ marginTop: ".9rem", fontSize: ".9rem" }}>+ clarify-first · numbers that matter · provider variants (AWS / Azure / GCP) · dos &amp; don’ts.</p>
      </div>
    </section>
  ),
  // 8 — Three ways to use it
  (
    <section className="slide slide--soft" data-mode="soft">
      <div className="slide-inner stagger">
        <div className="eyebrow">Three ways to use it</div>
        <h2 className="display" style={{ margin: ".4rem 0 1.4rem" }}>From full design to a single question</h2>
        <div className="grid grid-3">
          <div className="card"><div className="num">1</div><h4 style={{ marginTop: ".5rem" }}>/design &lt;system&gt;</h4><p className="muted">Runs the whole loop (or dispatches to the orchestrator agent). Scores + persists the design. Best for full designs &amp; interview practice.</p></div>
          <div className="card"><div className="num">2</div><h4 style={{ marginTop: ".5rem" }}>system-design skill</h4><p className="muted">Start a design conversationally — same loop, routes to the blocks.</p></div>
          <div className="card"><div className="num">3</div><h4 style={{ marginTop: ".5rem" }}>One block, directly</h4><p className="muted">“What caching strategy here?” “SQL or NoSQL?” — the recipe + trade-offs for just that part.</p></div>
        </div>
      </div>
    </section>
  ),
  // 9 — Install (dark + code)
  (
    <section className="slide slide--dark" data-mode="dark">
      <div className="slide-inner split">
        <div className="stagger">
          <div className="eyebrow">Install</div>
          <h2 className="display" style={{ margin: ".6rem 0 1rem" }}>Two commands, no config</h2>
          <p className="lead">No runtime, server, or API keys — pure skills + one stdlib calculator. Self-contained by design.</p>
        </div>
        <div className="code-window">
          <div className="bar"><i /><i /><i /></div>
          <pre>{`# CLI (vercel-labs/skills)
$ `}<span className="c-coral">npx skills add</span>{` proyecto26/system-design-skills

# or as a Claude Code plugin
> `}<span className="c-coral">/plugin marketplace add</span>{` proyecto26/system-design-skills
> `}<span className="c-coral">/plugin install</span>{` system-design-skills

# then, in any session
> `}<span className="c-teal">/design</span>{` a URL shortener at billions of reads`}</pre>
        </div>
      </div>
    </section>
  ),
  // 10 — Worked example: WhatsApp
  (
    <section className="slide slide--cream" data-mode="cream">
      <div className="slide-inner split">
        <div className="stagger">
          <div className="eyebrow">Worked example</div>
          <h2 className="display" style={{ margin: ".6rem 0 1rem" }}>Design WhatsApp — then scale it</h2>
          <p className="lead">Round 1 clarifies + sizes (≈1.15M msg/sec peak). Round 2’s “1B users” constraint re-enters the loop: fan-out push → hybrid, media → blob-store + CDN, IDs → a Snowflake sequencer (sort key, not shard key).</p>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          {[["messaging-streaming", "delivery, fan-out, DLQ"], ["data-storage", "device-keyed outbox, sharding"], ["consistency-coordination", "ordering, multi-device"], ["sequencer", "Snowflake message IDs"], ["blob-store + content-delivery", "media off the message path"], ["resilience-failure", "degrade, don’t collapse"]].map(([t, s]) => (
            <div className="card" key={t}><h4 style={{ fontFamily: "var(--mono)", fontSize: ".9rem" }}>{t}</h4><p className="muted">{s}</p></div>
          ))}
        </div>
      </div>
    </section>
  ),
  // 11 — Eval results
  (
    <section className="slide slide--cream center" data-mode="cream">
      <div className="slide-inner stagger">
        <div className="eyebrow">Measured, not asserted</div>
        <h2 className="display" style={{ margin: ".4rem 0 1.6rem" }}>The skills make Claude design better</h2>
        <div className="grid grid-3" style={{ maxWidth: 820, margin: "0 auto" }}>
          <div className="card"><div className="num">30/30</div><h4 style={{ marginTop: ".4rem" }}>with skills</h4><p className="muted">WhatsApp eval, 6 GUIDE behaviors</p></div>
          <div className="card"><div className="num">20/30</div><h4 style={{ marginTop: ".4rem" }}>baseline</h4><p className="muted">no skills, same prompt</p></div>
          <div className="card"><div className="num">✓</div><h4 style={{ marginTop: ".4rem" }}>composition real</h4><p className="muted">blocks invoked, not paraphrased</p></div>
        </div>
        <p className="muted" style={{ marginTop: "1.2rem", fontSize: ".9rem" }}>Portable, self-locating checks ship in-repo: <code style={{ fontFamily: "var(--mono)" }}>python3 meta/evals/run_checks.py</code>.</p>
      </div>
    </section>
  ),
  // 12 — Closing CTA (coral)
  (
    <section className="slide slide--coral center" data-mode="coral">
      <div className="slide-inner stagger">
        <div className="badge" style={{ background: "rgba(255,255,255,.18)", color: "#fff" }}><Spike /> get started</div>
        <h2 className="display" style={{ margin: "1rem 0", fontSize: "clamp(2.2rem,4.6vw,3.4rem)" }}>Stop drawing boxes at random.</h2>
        <p className="lead" style={{ margin: "0 auto 1.6rem" }}>Reason about a design one part at a time — and justify every choice.</p>
        <div style={{ display: "flex", gap: ".75rem", justifyContent: "center", flexWrap: "wrap" }}>
          <a className="btn btn--primary" href="https://github.com/proyecto26/system-design-skills">github.com/proyecto26/system-design-skills</a>
        </div>
        <p style={{ marginTop: "2rem", fontSize: ".85rem", opacity: .85 }}>Made with ❤️ by Proyecto 26 · MIT</p>
      </div>
    </section>
  ),
];

export default function App() {
  const [i, setI] = useState(0);
  const n = SLIDES.length;
  const go = useCallback((d) => setI((p) => Math.min(n - 1, Math.max(0, p + d))), [n]);
  const set = useCallback((x) => setI(Math.min(n - 1, Math.max(0, x))), [n]);

  useEffect(() => {
    const onKey = (e) => {
      if (["ArrowRight", "ArrowDown", " ", "PageDown"].includes(e.key)) { e.preventDefault(); go(1); }
      else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); go(-1); }
      else if (e.key === "Home") set(0);
      else if (e.key === "End") set(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, set, n]);

  // basic touch swipe
  useEffect(() => {
    let x0 = null;
    const ts = (e) => { x0 = e.touches[0].clientX; };
    const te = (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); x0 = null; };
    window.addEventListener("touchstart", ts, { passive: true });
    window.addEventListener("touchend", te, { passive: true });
    return () => { window.removeEventListener("touchstart", ts); window.removeEventListener("touchend", te); };
  }, [go]);

  return (
    <div className="deck">
      <div className="progress" style={{ width: `${((i + 1) / n) * 100}%` }} />
      {SLIDES.map((s, idx) =>
        React.cloneElement(s, { key: idx, className: `${s.props.className}${idx === i ? " is-active" : ""}` })
      )}
      <div className="brand"><Spike /> system-design-skills</div>
      <nav className="dots" aria-label="slides">
        {SLIDES.map((_, idx) => (
          <button key={idx} className={idx === i ? "on" : ""} aria-label={`Go to slide ${idx + 1}`} onClick={() => set(idx)} />
        ))}
      </nav>
      <div className="counter">{String(i + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}</div>
      <div className="hint">← → to navigate</div>
    </div>
  );
}
