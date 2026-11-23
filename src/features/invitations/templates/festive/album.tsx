"use client";

/* eslint-disable @next/next/no-img-element -- ảnh đã nén ở client, phục vụ từ CDN của Storage */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { reducedNow } from "./motion";
import type { AlbumKind } from "./presets";
import { s } from "./styles";

const FRAME: Record<AlbumKind, string> = { polaroid: s.polaroid, arch: s.arch, film: s.film, plain: s.plain };
const RATIO: Record<AlbumKind, string> = { polaroid: "aspect-square", arch: "aspect-[3/4]", film: "aspect-[4/3]", plain: "aspect-[4/5]" };

/** Xem ảnh phóng to: vuốt/bấm để chuyển, Esc hoặc ✕ để đóng. */
function Lightbox({ photos, start, onClose }: { photos: string[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const go = (d: number) => setI((x) => (x + d + photos.length) % photos.length);
  const touchX = useRef<number | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Gắn vào body: tổ tiên có transform (hiệu ứng hiện dần) sẽ làm position: fixed lệch khung.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Ảnh ${i + 1}/${photos.length}`}
      className={s.lightbox}
      onClick={onClose}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - (touchX.current ?? e.changedTouches[0].clientX);
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      }}
    >
      <img src={photos[i]} alt="" className={s.lightboxImg} onClick={(e) => e.stopPropagation()} />
      <p className="absolute top-4 left-0 w-full text-center text-sm text-white/80 tabular-nums">
        {i + 1} / {photos.length}
      </p>
      <button type="button" aria-label="Đóng" className={`${s.lbBtn} top-3 right-3`} onClick={onClose}>
        ✕
      </button>
      {photos.length > 1 && (
        <>
          <button type="button" aria-label="Ảnh trước" className={`${s.lbBtn} top-1/2 left-2`} onClick={(e) => (e.stopPropagation(), go(-1))}>
            ‹
          </button>
          <button type="button" aria-label="Ảnh sau" className={`${s.lbBtn} top-1/2 right-2`} onClick={(e) => (e.stopPropagation(), go(1))}>
            ›
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}

/**
 * Album băng ngang: vuốt tay bằng CSS scroll-snap (chạy cả khi JS chậm).
 * JS chỉ tự chuyển ảnh khi album đang trong màn hình, và dừng hẳn khi khách tự chạm vào album.
 */
export function Album({ kind, photos }: { kind: AlbumKind; photos: string[] }) {
  const strip = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);
  const touched = useRef(false);

  useEffect(() => {
    const el = strip.current;
    if (!el || photos.length < 2) return;
    const reduce = reducedNow();
    let inView = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const slides = () => Array.from(el.children) as HTMLElement[];
    const current = () => {
      const mid = el.scrollLeft + el.clientWidth / 2;
      let best = 0;
      slides().forEach((c, i) => {
        if (Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid) < Math.abs(slides()[best].offsetLeft + slides()[best].offsetWidth / 2 - mid)) best = i;
      });
      return best;
    };
    const onScroll = () => setIndex(current());
    const go = () => {
      if (touched.current || !inView || document.hidden) return;
      const next = (current() + 1) % photos.length;
      const c = slides()[next];
      el.scrollTo({ left: c.offsetLeft - (el.clientWidth - c.offsetWidth) / 2, behavior: reduce ? "auto" : "smooth" });
    };
    const io = new IntersectionObserver(([e]) => (inView = e.intersectionRatio > 0.6), { threshold: [0, 0.6, 1] });
    io.observe(el);
    if (!reduce) timer = setInterval(go, 3500);
    const stopAuto = () => (touched.current = true);
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("pointerdown", stopAuto, { passive: true });
    el.addEventListener("touchstart", stopAuto, { passive: true });
    return () => {
      clearInterval(timer);
      io.disconnect();
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("pointerdown", stopAuto);
      el.removeEventListener("touchstart", stopAuto);
    };
  }, [photos.length]);

  const jump = (i: number) => {
    touched.current = true;
    const el = strip.current;
    const c = el?.children[i] as HTMLElement | undefined;
    if (el && c) el.scrollTo({ left: c.offsetLeft - (el.clientWidth - c.offsetWidth) / 2, behavior: "smooth" });
  };

  return (
    <div>
      {kind === "polaroid" && <div className={s.string} aria-hidden />}
      <div ref={strip} className={s.strip} role="region" aria-roledescription="album ảnh" aria-label="Album ảnh">
        {photos.map((src, i) => (
          <figure key={src} className={s.slide} aria-label={`Ảnh ${i + 1}/${photos.length}`}>
            <button type="button" className={`${FRAME[kind]} block w-full`} onClick={() => ((touched.current = true), setZoom(i))} aria-label={`Phóng to ảnh ${i + 1}`}>
              <div className={`overflow-hidden ${RATIO[kind]}`}>
                <img src={src} alt="" loading={i < 2 ? "eager" : "lazy"} decoding="async" className={`${s.photo} ${i === index ? s.kenburns : ""}`} />
              </div>
            </button>
          </figure>
        ))}
      </div>
      {photos.length > 1 && (
        <p className="mb-2 text-center text-xs tabular-nums" style={{ color: "var(--inv-muted)" }}>
          {index + 1} / {photos.length} · chạm ảnh để phóng to
        </p>
      )}
      {zoom !== null && <Lightbox photos={photos} start={zoom} onClose={() => setZoom(null)} />}
      {photos.length > 1 && (
        <div className={s.dots}>
          {photos.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Xem ảnh ${i + 1}`}
              aria-current={i === index}
              className={`${s.dot} ${i === index ? s.dotOn : ""}`}
              onClick={() => jump(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
