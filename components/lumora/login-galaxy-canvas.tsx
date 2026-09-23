'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

type RgbMap = Record<string, string>;
type Particle = {
  a0: number;
  r: number;
  col: string;
  size: number;
  node: boolean;
  base: number;
  tw: number;
  tws: number;
  layer: number;
};
type Star = {
  x: number;
  y: number;
  r: number;
  ph: number;
  sp: number;
  col: string;
};

const ARMS = 4;
const TURNS = 2.15;
const ASPY = 0.6;
const TILT = -0.16;

function readRgbVar(
  styles: CSSStyleDeclaration,
  name: string,
  fallback: string
) {
  const value = styles.getPropertyValue(name).trim();
  return value || fallback;
}

function makeSprite(rgb: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, `rgba(${rgb},0.95)`);
  gradient.addColorStop(0.4, `rgba(${rgb},0.32)`);
  gradient.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return canvas;
}

export function LoginGalaxyCanvas({
  className,
  logoDiameter,
}: {
  className?: string;
  logoDiameter: number;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rootStyles = getComputedStyle(document.documentElement);
    const colors: RgbMap = {
      gold: readRgbVar(rootStyles, '--vk-auth-galaxy-gold-rgb', '246,208,120'),
      warm: readRgbVar(rootStyles, '--vk-auth-galaxy-warm-rgb', '236,168,72'),
      ivory: readRgbVar(
        rootStyles,
        '--vk-auth-galaxy-ivory-rgb',
        '255,238,205'
      ),
      steel: readRgbVar(
        rootStyles,
        '--vk-auth-galaxy-steel-rgb',
        '126,158,196'
      ),
      violet: readRgbVar(
        rootStyles,
        '--vk-auth-galaxy-violet-rgb',
        '150,126,196'
      ),
      indigo: readRgbVar(
        rootStyles,
        '--vk-auth-galaxy-indigo-rgb',
        '104,110,190'
      ),
      navy: readRgbVar(rootStyles, '--vk-auth-galaxy-navy-rgb', '66,84,138'),
    };

    const sprites = Object.fromEntries(
      Object.entries(colors).map(([key, value]) => [key, makeSprite(value)])
    ) as Record<string, HTMLCanvasElement>;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let cx = 0;
    let cy = 0;
    let unit = 0;
    let clearRadius = 140;
    let parts: Particle[] = [];
    let stars: Star[] = [];
    let animationFrame = 0;
    let last = performance.now();
    let rotation = 0;
    let wave = 0;

    const random = (min: number, max: number) =>
      min + Math.random() * (max - min);
    const randomBell = () =>
      ((Math.random() + Math.random() + Math.random()) / 3 - 0.5) * 2;

    const armColor = (t: number) => {
      const roll = Math.random();
      if (t < 0.3) {
        return roll < 0.66
          ? colors.gold
          : roll < 0.9
            ? colors.ivory
            : colors.warm;
      }
      if (t < 0.6) {
        return roll < 0.32
          ? colors.gold
          : roll < 0.7
            ? colors.steel
            : colors.violet;
      }
      return roll < 0.5
        ? colors.steel
        : roll < 0.82
          ? colors.violet
          : colors.indigo;
    };

    const build = () => {
      clearRadius = logoDiameter * 0.53 + Math.min(width, height) * 0.015;
      const maxRadius = Math.max(
        clearRadius * 1.35,
        Math.min(cx * 0.94, (cy * 0.9) / ASPY)
      );
      const density = width < 560 ? 0.42 : width < 1100 ? 0.72 : 1;
      const armCount = Math.round(560 * density);
      const dustCount = Math.round(140 * density);
      const coreCount = Math.round(80 * density);
      const starCount = Math.round(80 * density);

      parts = [];

      for (let index = 0; index < armCount; index += 1) {
        const arm = index % ARMS;
        const t = Math.pow(Math.random(), 0.92);
        const angle =
          arm * ((Math.PI * 2) / ARMS) +
          t * TURNS * Math.PI * 2 +
          randomBell() * 0.2 * (0.4 + t) +
          TILT;
        const radius =
          clearRadius +
          t * (maxRadius - clearRadius) +
          randomBell() * 9 * (0.5 + t);

        parts.push({
          a0: angle,
          r: radius,
          col: armColor(t),
          size:
            (t < 0.3 ? random(0.7, 1.7) : random(0.5, 1.4)) *
            (Math.random() < 0.05 ? 2.3 : 1),
          node: Math.random() < 0.05,
          base: 0.26 + 0.5 * (1 - t),
          tw: Math.random() * Math.PI * 2,
          tws: random(0.3, 0.9),
          layer: 1,
        });
      }

      for (let index = 0; index < dustCount; index += 1) {
        const arm = index % ARMS;
        const t = Math.pow(Math.random(), 0.7);
        const angle =
          arm * ((Math.PI * 2) / ARMS) +
          t * TURNS * Math.PI * 2 +
          randomBell() * 0.5 +
          TILT;
        const radius =
          clearRadius * 1.08 +
          t * (maxRadius - clearRadius) +
          randomBell() * 20;
        const roll = Math.random();

        parts.push({
          a0: angle,
          r: radius,
          col:
            roll < 0.5
              ? colors.navy
              : roll < 0.8
                ? colors.indigo
                : colors.violet,
          size: random(7, 17),
          node: false,
          base: random(0.028, 0.075),
          tw: Math.random() * Math.PI * 2,
          tws: random(0.1, 0.35),
          layer: 0,
        });
      }

      for (let index = 0; index < coreCount; index += 1) {
        const roll = Math.random();
        parts.push({
          a0: Math.random() * Math.PI * 2,
          r: clearRadius * random(1.0, 1.55),
          col:
            roll < 0.6 ? colors.gold : roll < 0.85 ? colors.ivory : colors.warm,
          size: random(0.7, 1.9),
          node: Math.random() < 0.12,
          base: random(0.4, 0.72),
          tw: Math.random() * Math.PI * 2,
          tws: random(0.4, 1.0),
          layer: 2,
        });
      }

      stars = [];

      for (let index = 0; index < starCount; index += 1) {
        const x = random(-0.5, 0.5);
        const y = random(-0.5, 0.5);
        if (Math.hypot(x * width, y * height) < clearRadius * 1.15) {
          index -= 1;
          continue;
        }
        stars.push({
          x,
          y,
          r: random(0.4, 1.4),
          ph: Math.random() * Math.PI * 2,
          sp: random(0.25, 0.8),
          col: Math.random() < 0.2 ? colors.steel : colors.ivory,
        });
      }

      parts.sort((left, right) => left.layer - right.layer);
    };

    const layout = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = width / 2;
      cy = height / 2;
      unit = Math.min(width, height);
      build();
    };

    const frame = (now: number) => {
      animationFrame = window.requestAnimationFrame(frame);

      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const time = now / 1000;

      rotation += dt * 0.032 * (reducedMotion ? 0 : 1);
      wave += dt * 0.5 * (reducedMotion ? 0 : 1);

      ctx.clearRect(0, 0, width, height);

      const haloRadius = unit * (0.3 + 0.02 * Math.sin(time * 0.6));
      const halo = ctx.createRadialGradient(
        cx,
        cy,
        haloRadius * 0.06,
        cx,
        cy,
        haloRadius
      );
      halo.addColorStop(0, 'rgba(70,66,58,0.12)');
      halo.addColorStop(0.34, 'rgba(255,214,150,0.17)');
      halo.addColorStop(0.7, 'rgba(242,193,78,0.06)');
      halo.addColorStop(1, 'rgba(242,193,78,0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, haloRadius, 0, Math.PI * 2);
      ctx.fill();

      for (const star of stars) {
        const x = cx + star.x * width;
        const y = cy + star.y * height;
        const opacity = 0.1 + 0.14 * Math.sin(time * star.sp + star.ph);
        ctx.fillStyle = `rgba(${star.col},${opacity.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const part of parts) {
        const angle = part.a0 + rotation;
        const x = cx + Math.cos(angle) * part.r;
        const y = cy + Math.sin(angle) * part.r * ASPY;
        let opacity =
          part.base * (0.6 + 0.4 * Math.sin(time * part.tws + part.tw));
        const band = Math.abs(
          ((((angle - wave) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) -
            Math.PI
        );
        opacity *= 1 + 0.55 * Math.max(0, 1 - Math.abs(band - Math.PI) / 0.7);

        if (part.layer === 0) {
          const sprite =
            part.col === colors.navy
              ? sprites.navy
              : part.col === colors.indigo
                ? sprites.indigo
                : sprites.violet;
          ctx.globalAlpha = Math.min(0.5, opacity);
          ctx.drawImage(
            sprite,
            x - part.size,
            y - part.size,
            part.size * 2,
            part.size * 2
          );
          ctx.globalAlpha = 1;
          continue;
        }

        if (part.node) {
          const sprite =
            part.col === colors.gold
              ? sprites.gold
              : part.col === colors.ivory
                ? sprites.ivory
                : part.col === colors.warm
                  ? sprites.warm
                  : part.col === colors.steel
                    ? sprites.steel
                    : sprites.violet;
          const glow = part.size * 3.4;
          ctx.globalAlpha = Math.min(0.85, opacity * 0.9);
          ctx.drawImage(sprite, x - glow, y - glow, glow * 2, glow * 2);
          ctx.globalAlpha = 1;
        }

        ctx.fillStyle = `rgba(${part.col},${Math.min(0.95, opacity).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, part.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    };

    layout();
    const resizeObserver = new ResizeObserver(layout);
    resizeObserver.observe(canvas);
    animationFrame = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
    };
  }, [logoDiameter]);

  return (
    <canvas ref={canvasRef} aria-hidden="true" className={cn(className)} />
  );
}
