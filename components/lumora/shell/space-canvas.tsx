'use client';

import * as React from 'react';

/** Lumora gold — the tone the field returns to when no world is hovered. */
const GOLD: [number, number, number] = [242, 193, 78];

/** How fast the field eases toward a new mood, per frame. */
const MOOD_EASE = 0.04;

type Star = {
  x: number;
  y: number;
  /** Depth, 0.2–1: scales drift speed and brightness. */
  z: number;
  /** Core radius; the drawn glow is 3× this. */
  r: number;
  /** Twinkle phase offset, so the field never pulses in unison. */
  phase: number;
  /** Twinkle speed. */
  speed: number;
  vx: number;
  vy: number;
};

function parseHex(color: string | null): [number, number, number] {
  if (!color) return GOLD;
  const hex = color.trim().replace('#', '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  if (full.length !== 6) return GOLD;
  const value = Number.parseInt(full, 16);
  if (Number.isNaN(value)) return GOLD;
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function SpaceCanvas({ mood }: { mood: string | null }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  // The render loop reads the mood through a ref so a new tone eases in
  // without tearing down the field and re-seeding every star.
  const moodRef = React.useRef(mood);
  React.useEffect(() => {
    moodRef.current = mood;
  }, [mood]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let stars: Star[] = [];
    // Eased colour, chasing the mood target. Starts at gold.
    const current: [number, number, number] = [...GOLD];

    const build = () => {
      const count = Math.min(150, Math.floor(window.innerWidth / 9));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        z: Math.random() * 0.8 + 0.2,
        r: Math.random() * 1.4 + 0.3,
        phase: Math.random() * Math.PI * 2,
        speed: 0.2 + Math.random() * 0.6,
        vx: (Math.random() - 0.5) * 0.06,
        vy: (Math.random() - 0.5) * 0.06,
      }));
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    };

    /** One frame. `elapsed` drives the twinkle; `drift` advances positions. */
    const paint = (elapsed: number, drift: boolean) => {
      const { innerWidth: w, innerHeight: h } = window;
      ctx.clearRect(0, 0, w, h);

      const target = parseHex(moodRef.current);
      for (let i = 0; i < 3; i++) {
        current[i] += (target[i] - current[i]) * MOOD_EASE;
      }
      const rgb = `${current[0] | 0},${current[1] | 0},${current[2] | 0}`;

      // Additive blending: overlapping glows brighten rather than occlude.
      ctx.globalCompositeOperation = 'lighter';
      for (const s of stars) {
        if (drift) {
          s.x += s.vx * s.z;
          s.y += s.vy * s.z;
          // Wrap at the edges so the field never thins out.
          if (s.x < 0) s.x += w;
          if (s.x > w) s.x -= w;
          if (s.y < 0) s.y += h;
          if (s.y > h) s.y -= h;
        }
        const alpha =
          (0.25 + 0.35 * Math.sin(elapsed * s.speed + s.phase)) * s.z;
        const glow = s.r * 3;
        const gradient = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, glow);
        gradient.addColorStop(0, `rgba(${rgb},${alpha})`);
        gradient.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(s.x, s.y, glow, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    };

    resize();
    window.addEventListener('resize', resize);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;

    const start = performance.now();
    const loop = (now: number) => {
      paint((now - start) / 1000, true);
      frame = requestAnimationFrame(loop);
    };

    const run = () => {
      cancelAnimationFrame(frame);
      if (reduced.matches) {
        // Still, but not blank: one frame keeps the depth behind the app.
        paint(0, false);
        return;
      }
      frame = requestAnimationFrame(loop);
    };

    run();
    reduced.addEventListener('change', run);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      reduced.removeEventListener('change', run);
    };
  }, []);

  return <canvas ref={canvasRef} className="vk-space" aria-hidden="true" />;
}
