"use client";

import { useEffect, useRef } from "react";
import { reducedNow, useReducedMotion } from "./motion";
import type { ParticleKind } from "./presets";
import { s } from "./styles";

type Kind = "snow" | "star" | "glint" | "ember";
type P = { k: Kind; x: number; y: number; r: number; vx: number; vy: number; a: number; phase: number; rot: number; color: string };

const SNOW = "#fffaf2";
const GOLD = "#e6c473";
const STAR = "#fff1c2";

/** Thành phần hạt của từng kiểu: [loại hạt, tỉ lệ, màu]. */
const MIX: Record<Exclude<ParticleKind, "none">, [Kind, number, string][]> = {
  snow: [["snow", 1, SNOW]],
  stars: [["star", 0.8, STAR]],
  glitter: [["glint", 1, GOLD]],
  // Vintage: tuyết rơi nhiều lớp + bụi vàng bay lên.
  snowgold: [
    ["snow", 0.7, SNOW],
    ["ember", 0.35, GOLD],
  ],
};

/** Máy yếu: ít hạt hơn. Các API này không có ở mọi trình duyệt (Safari), nên mặc định là máy khỏe vừa. */
function budget() {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const weak = (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) || (nav.hardwareConcurrency ?? 8) <= 4;
  return weak ? 15 : 36;
}

/**
 * Một canvas duy nhất cho tuyết/sao/kim tuyến/bụi vàng. Dừng vẽ khi khuất màn hình, khi tab ẩn,
 * và không chạy khi bật giảm chuyển động (hệ thống hoặc nút trên thiệp).
 */
export function Particles({ kind }: { kind: ParticleKind }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    // reducedNow(): lần chạy đầu sau hydrate, useReducedMotion vẫn trả giá trị của máy chủ (false).
    if (!canvas || kind === "none" || reduced || reducedNow()) return;
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

    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const make = (k: Kind, color: string, initial: boolean): P => {
      // Ba lớp chiều sâu cho tuyết: hạt to rơi nhanh và rõ, hạt nhỏ rơi chậm và mờ.
      const depth = Math.random();
      return {
        k,
        color,
        x: rand(0, w),
        y: k === "star" || initial ? rand(0, h) : k === "ember" ? rand(h + 5, h + 40) : rand(-40, -5),
        r: k === "snow" ? 1 + depth * 2.6 : k === "star" ? rand(0.6, 1.8) : k === "ember" ? rand(0.8, 1.8) : rand(1.5, 3),
        vx: k === "snow" ? rand(-0.1, 0.35) : k === "glint" ? rand(-0.1, 0.1) : k === "ember" ? rand(-0.08, 0.08) : 0,
        vy: k === "snow" ? 0.3 + depth * 0.7 : k === "glint" ? rand(0.25, 0.6) : k === "ember" ? -rand(0.15, 0.4) : 0,
        a: k === "snow" ? 0.35 + depth * 0.6 : rand(0.4, 1),
        phase: rand(0, Math.PI * 2),
        rot: rand(0, Math.PI),
      };
    };
    const total = budget();
    const ps: P[] = [];
    for (const [k, share, color] of MIX[kind]) for (let i = 0; i < Math.round(total * share); i++) ps.push(make(k, color, true));

    let raf = 0;
    let visible = true;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(3, (now - last) / 16.7);
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (const p of ps) {
        p.phase += 0.02 * dt;
        ctx.fillStyle = p.color;
        if (p.k === "star") {
          ctx.globalAlpha = p.a * (0.35 + 0.65 * Math.abs(Math.sin(p.phase)));
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }
        p.x += (p.vx + Math.sin(p.phase) * 0.25) * dt;
        p.y += p.vy * dt;
        if (p.y > h + 10 || p.y < -50) Object.assign(p, make(p.k, p.color, false));
        if (p.k === "snow") {
          ctx.globalAlpha = p.a;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.k === "ember") {
          // Bụi vàng: nhấp nháy nhẹ khi bay lên.
          ctx.globalAlpha = p.a * (0.4 + 0.6 * Math.abs(Math.sin(p.phase * 1.7)));
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
      ctx.clearRect(0, 0, w, h);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [kind, reduced]);

  if (kind === "none") return null;
  return <canvas ref={ref} className={s.particles} aria-hidden />;
}
