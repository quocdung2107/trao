"use client";

/* eslint-disable @next/next/no-img-element -- ảnh đã nén ở client, phục vụ từ CDN của Storage */
import { useEffect, useRef, useState } from "react";
import type { AlbumKind } from "./presets";
import { s } from "./styles";

const FRAME: Record<AlbumKind, string> = { polaroid: s.polaroid, arch: s.arch, film: s.film };
const RATIO: Record<AlbumKind, string> = { polaroid: "aspect-square", arch: "aspect-[3/4]", film: "aspect-[4/3]" };

/**
 * Album băng ngang: vuốt tay bằng CSS scroll-snap (chạy cả khi JS chậm).
 * JS chỉ tự chuyển ảnh khi album đang trong màn hình, và dừng hẳn khi khách tự chạm vào album.
 */
export function Album({ kind, photos }: { kind: AlbumKind; photos: string[] }) {
  const strip = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const touched = useRef(false);

  useEffect(() => {
    const el = strip.current;
    if (!el || photos.length < 2) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
            <div className={FRAME[kind]}>
              <div className={`overflow-hidden ${RATIO[kind]}`}>
                <img src={src} alt="" loading={i < 2 ? "eager" : "lazy"} decoding="async" className={`${s.photo} ${i === index ? s.kenburns : ""}`} />
              </div>
            </div>
          </figure>
        ))}
      </div>
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
