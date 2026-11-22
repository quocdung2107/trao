"use client";

import { useEffect, useRef } from "react";
import type { ParticleKind } from "./presets";
import { s } from "./styles";

type P = { x: number; y: number; r: number; vx: number; vy: number; a: number; phase: number; rot: number };

/** Máy yếu: ít hạt hơn. Các API này không có ở mọi trình duyệt (Safari), nên mặc định là máy khỏe vừa. */
function budget() {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const weak = (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) || (nav.hardwareConcurrency ?? 8) <= 4;
  return weak ? 15 : 36;
}

/**
 * Một canvas duy nhất cho tuyết/sao/kim tuyến. Dừng vẽ khi khuất màn hình, khi tab ẩn,
 * và không chạy khi bật giảm chuyển động.
 */
export function Particles({ kind, color }: { kind: ParticleKind; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || kind === "none") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = 0;
    let h = 0;
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const n = kind === "stars" ? Math.round(budget() * 0.8) : budget();
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const make = (initial: boolean): P => ({
      x: rand(0, w),
      y: kind === "stars" || initial ? rand(0, h) : rand(-40, -5),
      r: kind === "snow" ? rand(1.2, 3.4) : kind === "stars" ? rand(0.6, 1.8) : rand(1.5, 3),
      vx: kind === "snow" ? rand(-0.15, 0.15) : kind === "glitter" ? rand(-0.1, 0.1) : 0,
      vy: kind === "snow" ? rand(0.35, 0.9) : kind === "glitter" ? rand(0.25, 0.6) : 0,
      a: kind === "snow" ? rand(0.5, 0.95) : rand(0.4, 1),
      phase: rand(0, Math.PI * 2),
      rot: rand(0, Math.PI),
    });
    const ps = Array.from({ length: n }, () => make(true));

    let raf = 0;
    let visible = true;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(3, (now - last) / 16.7);
      last = now;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = color;
      for (const p of ps) {
        p.phase += 0.02 * dt;
        if (kind === "stars") {
          ctx.globalAlpha = p.a * (0.35 + 0.65 * Math.abs(Math.sin(p.phase)));
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }
        p.x += (p.vx + Math.sin(p.phase) * 0.25) * dt;
        p.y += p.vy * dt;
        if (p.y > h + 10) Object.assign(p, make(false));
        if (kind === "snow") {
          ctx.globalAlpha = p.a;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Kim tuyến: hình chữ nhật nhỏ lật mặt (đổi chiều rộng) để lấp lánh.
          p.rot += 0.04 * dt;
          ctx.globalAlpha = p.a;
          const ww = p.r * 2 * Math.abs(Math.cos(p.rot));
          ctx.fillRect(p.x - ww / 2, p.y - p.r, ww + 0.3, p.r * 2);
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (raf || !visible || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) start();
      else stop();
    });
    io.observe(canvas);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    start();
    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [kind, color]);

  if (kind === "none") return null;
  return <canvas ref={ref} className={s.particles} aria-hidden />;
}
