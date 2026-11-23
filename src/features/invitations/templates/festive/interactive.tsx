"use client";

import { useState } from "react";
import { s } from "./styles";

/**
 * Bản đồ nhúng Google Maps. Chỉ tải khi khách bấm, vì khung bản đồ nặng (vài trăm KB tới hơn 1 MB)
 * và làm chậm thiệp trên máy yếu. Nút "Chỉ đường" bên dưới luôn dùng được.
 */
export function MapEmbed({ query }: { query: string }) {
  const [on, setOn] = useState(false);
  const src = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`;
  return (
    <div className={`${s.map} mt-4`}>
      {on ? (
        <iframe title={`Bản đồ: ${query}`} src={src} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-full w-full border-0" />
      ) : (
        <button type="button" onClick={() => setOn(true)} className={s.mapPlaceholder}>
          <span className={s.mapPin} aria-hidden>
            📍
          </span>
          <span className="font-semibold">Chạm để xem bản đồ</span>
        </button>
      )}
    </div>
  );
}

/** Hộp quà: chạm để mở nắp, ánh sáng tỏa ra và hiện lời chúc. */
export function GiftBox({ message, h }: { message: string; h: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        className={`${s.gift} ${open ? s.giftOpen : ""}`}
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-label={open ? "Hộp quà đã mở" : "Chạm để mở quà"}
      >
        <span className={s.giftGlow} aria-hidden />
        <span className={s.giftLid} aria-hidden />
        <span className={s.giftBox} aria-hidden />
      </button>
      {!open && <p className={`${s.pulseText} mt-4 text-xs uppercase tracking-[0.3em]`}>Chạm để mở quà</p>}
      <p className={`${s.giftMsg} ${open ? s.giftMsgOn : ""} ${h} mx-auto mt-5 max-w-xs text-xl leading-relaxed`} style={{ color: "var(--inv-accent)" }} aria-live="polite">
        {open ? message : ""}
      </p>
    </div>
  );
}
