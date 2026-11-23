import type { CSSProperties } from "react";
import { s } from "./styles";

/**
 * Họa tiết Giáng sinh vẽ bằng SVG nội tuyến (nhẹ, không tải thêm file). Mỗi lớp có lớp CSS riêng
 * để chuyển động độc lập: cành thông lay nhẹ, bóng đèn nhấp nháy lệch nhịp, quả châu đung đưa, nơ bồng bềnh,
 * đèn lồng lập lòe. Mọi chuyển động dùng transform/opacity và tắt khi giảm chuyển động.
 */

/** Số giả ngẫu nhiên cố định (máy chủ và trình duyệt ra cùng kết quả). */
function rng(seed: number) {
  let x = seed;
  return () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
}

const BULBS = ["#ffcf6b", "#e8473f", "#7fd17a", "#6fb7ff", "#ffcf6b"];

/** Dây cành thông võng xuống, có đèn và quả châu treo. */
export function Garland({ ornaments = true, className = "" }: { ornaments?: boolean; className?: string }) {
  const r = rng(7);
  const pt = (t: number) => ({ x: t * 400, y: 18 + Math.sin(t * Math.PI) * 34 });
  const needles = Array.from({ length: 150 }, (_, i) => {
    const t = i / 149;
    const p = pt(t);
    const a = r() * Math.PI * 2;
    const l = 9 + r() * 9;
    return { x1: p.x, y1: p.y, x2: p.x + Math.cos(a) * l, y2: p.y + Math.sin(a) * l * 0.7, c: r() > 0.5 ? "#1f5a3d" : "#2c7150" };
  });
  const bulbs = Array.from({ length: 13 }, (_, i) => ({ ...pt((i + 0.5) / 13), c: BULBS[i % BULBS.length], d: Math.round(r() * 2400) }));
  const balls = ornaments
    ? [0.18, 0.39, 0.61, 0.82].map((t, i) => ({ ...pt(t), len: 18 + (i % 2) * 14, c: i % 2 ? "#c5a15a" : "#8b2028", d: -i * 700 }))
    : [];
  return (
    <svg viewBox="0 0 400 110" className={`${s.garland} ${className}`} aria-hidden>
      <g className={s.sway}>
        {needles.map((n, i) => (
          <line key={i} {...n} stroke={n.c} strokeWidth="2.2" strokeLinecap="round" />
        ))}
        {balls.map((b, i) => (
          <g key={i} className={s.ornament} style={{ transformOrigin: `${b.x}px ${b.y}px`, animationDelay: `${b.d}ms` } as CSSProperties}>
            <line x1={b.x} y1={b.y} x2={b.x} y2={b.y + b.len} stroke="#c5a15a" strokeWidth="1" />
            <rect x={b.x - 3} y={b.y + b.len - 2} width="6" height="4" rx="1" fill="#c5a15a" />
            <circle cx={b.x} cy={b.y + b.len + 9} r="9" fill={b.c} />
            <ellipse cx={b.x - 3} cy={b.y + b.len + 5.5} rx="3" ry="2" fill="#fff" opacity="0.55" />
          </g>
        ))}
        {bulbs.map((b, i) => (
          <g key={i}>
            <circle cx={b.x} cy={b.y + 4} r="7" fill={b.c} opacity="0.35" className={s.bulbGlow} style={{ animationDelay: `${b.d}ms` }} />
            <circle cx={b.x} cy={b.y + 4} r="3" fill={b.c} className={s.bulb} style={{ animationDelay: `${b.d}ms` }} />
          </g>
        ))}
      </g>
    </svg>
  );
}

/** Nơ nhung đỏ lớn. */
export function Bow({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 110" className={`${s.bow} ${className}`} aria-hidden>
      <defs>
        <linearGradient id="fx-velvet" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b2333c" />
          <stop offset="1" stopColor="#6e151c" />
        </linearGradient>
      </defs>
      <path d="M72 46 L40 104 L54 100 L60 110 L78 52 Z" fill="url(#fx-velvet)" />
      <path d="M88 46 L120 104 L106 100 L100 110 L82 52 Z" fill="url(#fx-velvet)" />
      <path d="M78 42 C50 6 8 14 14 40 C20 64 60 56 78 46 Z" fill="url(#fx-velvet)" />
      <path d="M82 42 C110 6 152 14 146 40 C140 64 100 56 82 46 Z" fill="url(#fx-velvet)" />
      <path d="M30 34 C42 26 58 30 70 40" stroke="#d65a62" strokeWidth="2" fill="none" opacity="0.6" />
      <path d="M130 34 C118 26 102 30 90 40" stroke="#d65a62" strokeWidth="2" fill="none" opacity="0.6" />
      <rect x="68" y="34" width="24" height="20" rx="7" fill="#8b2028" />
      <rect x="72" y="37" width="7" height="4" rx="2" fill="#fff" opacity="0.25" />
    </svg>
  );
}

/** Nhánh nhựa ruồi có quả đỏ. */
export function Holly({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 50" className={`h-10 w-28 ${className}`} aria-hidden>
      <path d="M58 26 C44 6 22 10 10 20 C20 22 24 30 22 38 C32 30 44 34 58 26Z" fill="#1f5a3d" />
      <path d="M62 26 C76 6 98 10 110 20 C100 22 96 30 98 38 C88 30 76 34 62 26Z" fill="#2c7150" />
      <circle cx="54" cy="30" r="6" fill="#a3242d" />
      <circle cx="66" cy="30" r="6" fill="#8b2028" />
      <circle cx="60" cy="21" r="6" fill="#b8323b" />
      <circle cx="58" cy="19" r="1.8" fill="#fff" opacity="0.6" />
    </svg>
  );
}

/** Đèn lồng có quầng sáng lập lòe. */
export function Lantern({ className = "", delay = 0 }: { className?: string; delay?: number }) {
  return (
    <svg viewBox="0 0 60 110" className={`h-24 w-14 ${className}`} aria-hidden>
      <circle cx="30" cy="66" r="28" fill="#ffcf6b" opacity="0.35" className={s.flicker} style={{ animationDelay: `${delay}ms` }} />
      <path d="M30 0 V14" stroke="#3a2d1d" strokeWidth="2" />
      <path d="M18 18 H42 L38 26 H22 Z" fill="#2b2117" />
      <rect x="18" y="26" width="24" height="56" rx="3" fill="#fff1c9" opacity="0.9" />
      <rect x="22" y="30" width="16" height="48" rx="2" fill="#ffd77e" className={s.flame} style={{ animationDelay: `${delay}ms` }} />
      <path d="M18 26 H42 M18 82 H42 M30 26 V82" stroke="#2b2117" strokeWidth="2.5" />
      <path d="M16 82 H44 L40 90 H20 Z" fill="#2b2117" />
    </svg>
  );
}

/** Cây thông vẽ dần lên (các tầng hiện nối tiếp), đèn nhấp nháy, ngôi sao tỏa sáng. */
export function Tree({ className = "" }: { className?: string }) {
  const r = rng(3);
  const tiers = [
    { y: 34, w: 30, h: 40 },
    { y: 56, w: 46, h: 46 },
    { y: 82, w: 62, h: 50 },
    { y: 110, w: 78, h: 54 },
  ];
  const lights = Array.from({ length: 18 }, () => {
    const t = 0.15 + r() * 0.85;
    const y = 40 + t * 120;
    const half = t * 70;
    return { x: 100 + (r() * 2 - 1) * half * 0.8, y, c: BULBS[Math.floor(r() * BULBS.length)], d: Math.round(r() * 2000) };
  });
  return (
    <svg viewBox="0 0 200 200" className={`${s.tree} ${className}`} aria-hidden>
      {tiers.map((t, i) => (
        <path
          key={i}
          className={s.tier}
          style={{ animationDelay: `${(tiers.length - i) * 180}ms` }}
          d={`M100 ${t.y - t.h + 8} L${100 + t.w} ${t.y + 30} Q100 ${t.y + 40} ${100 - t.w} ${t.y + 30} Z`}
          fill={i % 2 ? "#1f5a3d" : "#2c7150"}
        />
      ))}
      <rect x="92" y="168" width="16" height="18" rx="2" fill="#6b4a2b" />
      {lights.map((l, i) => (
        <circle key={i} cx={l.x} cy={l.y} r="3" fill={l.c} className={s.bulb} style={{ animationDelay: `${l.d}ms` }} />
      ))}
      <g className={s.treeStar}>
        <circle cx="100" cy="10" r="16" fill="#ffe29a" opacity="0.35" />
        <path d="M100 -2 L104 7 L114 8 L106 14 L109 24 L100 18 L91 24 L94 14 L86 8 L96 7 Z" fill="#f2cf7a" />
      </g>
    </svg>
  );
}

/** Hộp quà nhỏ trang trí góc. */
export function MiniGifts({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 90 60" className={`h-14 w-20 ${className}`} aria-hidden>
      <rect x="4" y="22" width="40" height="36" rx="3" fill="#8b2028" />
      <rect x="21" y="22" width="6" height="36" fill="#c5a15a" />
      <rect x="4" y="34" width="40" height="5" fill="#c5a15a" />
      <rect x="48" y="32" width="38" height="26" rx="3" fill="#1f5a3d" />
      <rect x="64" y="32" width="5" height="26" fill="#f4ebd8" />
      <path d="M24 22 C14 10 8 18 24 22 C40 18 34 10 24 22" stroke="#c5a15a" strokeWidth="3" fill="none" />
    </svg>
  );
}
