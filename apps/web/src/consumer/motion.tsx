import { useEffect, useRef, useState } from "react";

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* deterministic pseudo-random so visuals keep their shape across renders */
export function seeded(index: number): number {
  const x = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** static ink skyline — Suspense fallback and no-WebGL stand-in for the 3D city */
export function CitySkyline() {
  return (
    <div className="city-motif" aria-hidden="true">
      <svg viewBox="0 0 180 74"><path d="M3 66h174M18 66V42h22v24M28 42V28h18v38M58 66V21h30v45M70 34h6M70 44h6M70 54h6M101 66V40h22v26M134 66V31h25v35M141 41h5M141 51h5"/><path d="M9 66V52m0 0c-8-6-8-14 0-18 8 4 8 12 0 18Zm113 14V54m0 0c-7-5-7-12 0-16 7 4 7 11 0 16Zm45 12V48m0 0c-8-6-8-14 0-18 8 4 8 12 0 18Z"/></svg>
    </div>
  );
}

/** serif ledger count-up for point balances */
export function useCountUp(value: number, durationMs = 700): number {
  const [display, setDisplay] = useState(value);
  const previousRef = useRef(value);
  useEffect(() => {
    const from = previousRef.current;
    previousRef.current = value;
    if (from === value || prefersReducedMotion()) { setDisplay(value); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (time: number) => {
      const progress = Math.min((time - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);
  return display;
}

/** one-shot ink-leaf burst for the stamped success screen */
export function InkBurst() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || prefersReducedMotion()) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const parent = canvas.parentElement;
    const width = (canvas.width = (parent?.clientWidth ?? 360) * 2);
    const height = (canvas.height = (parent?.clientHeight ?? 480) * 2);
    const colors = ["#1c2a21", "#1e5b41", "#b4541f", "#8a6100"];
    const particles = Array.from({ length: 26 }, (_, index) => ({
      x: width / 2,
      y: height * 0.34,
      vx: (seeded(index * 3) - 0.5) * 14,
      vy: -6 - seeded(index * 7) * 9,
      size: 5 + seeded(index * 11) * 8,
      rotation: seeded(index * 13) * Math.PI,
      spin: (seeded(index * 17) - 0.5) * 0.22,
      color: colors[index % colors.length]!,
    }));
    let raf = 0;
    const start = performance.now();
    const tick = (time: number) => {
      const elapsed = (time - start) / 1000;
      context.clearRect(0, 0, width, height);
      if (elapsed > 1.7) return;
      const fade = elapsed < 1.2 ? 1 : 1 - (elapsed - 1.2) / 0.5;
      for (const particle of particles) {
        particle.vy += 0.32;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.rotation += particle.spin;
        context.save();
        context.globalAlpha = Math.max(fade, 0) * 0.85;
        context.translate(particle.x, particle.y);
        context.rotate(particle.rotation);
        context.fillStyle = particle.color;
        context.beginPath();
        context.ellipse(0, 0, particle.size, particle.size * 0.45, 0, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={canvasRef} className="ink-burst" aria-hidden="true" style={{ width: "100%", height: "100%" }} />;
}
