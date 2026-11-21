"use client";

import { useEffect, useState } from "react";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

export function Countdown({ target, className }: { target: string; className?: string }) {
  // Chỉ tính ở client để tránh lệch giữa HTML server và client.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // Chỉ đọc giờ sau khi hydrate để HTML máy chủ và trình duyệt khớp nhau.
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  if (now === null) return <div className={className} style={{ minHeight: "4.5rem" }} />;
  const left = new Date(target).getTime() - now;
  if (left <= 0) return null;
  const p = parts(left);
  return (
    <div className={className} role="timer" aria-label="Thời gian còn lại">
      {[
        [p.d, "ngày"],
        [p.h, "giờ"],
        [p.m, "phút"],
        [p.s, "giây"],
      ].map(([v, l]) => (
        <div key={l as string} className="flex min-w-14 flex-col items-center">
          <span className="text-2xl font-semibold tabular-nums">{String(v).padStart(2, "0")}</span>
          <span className="text-xs opacity-70">{l}</span>
        </div>
      ))}
    </div>
  );
}
