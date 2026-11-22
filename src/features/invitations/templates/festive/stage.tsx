"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { s } from "./styles";

/** Tốc độ tự lướt (px/giây) và thời gian chờ không thao tác trước khi lướt tiếp. */
const SPEED = 36;
const IDLE_MS = 3000;
const FIRST_DELAY_MS = 2200;

type ScrollMode = "off" | "waiting" | "running" | "stopped" | "done";

/** Khung cuộn gần nhất (trình sửa thiệp có khung xem trước riêng); không có thì là cửa sổ. */
function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

/**
 * Sân khấu của thiệp lễ hội: màn bìa "Chạm để mở thiệp", nhạc, tự lướt và các nút nổi.
 * Cú chạm mở thiệp là cử chỉ người dùng duy nhất trình duyệt chấp nhận để phát tiếng,
 * nên cả nhạc lẫn tự lướt đều bắt đầu từ đây.
 */
export function FestiveStage({
  cover,
  musicSrc,
  autoScroll,
  frame,
  children,
}: {
  cover: ReactNode;
  musicSrc: string | null;
  autoScroll: boolean;
  frame: "page" | "preview";
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [phase, setPhase] = useState<"closed" | "opening" | "open">("closed");
  const [hint, setHint] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<ScrollMode>("off");
  const modeRef = useRef<ScrollMode>("off");
  const setScroll = useCallback((m: ScrollMode) => {
    modeRef.current = m;
    setMode(m);
  }, []);

  // Gợi ý bàn tay sau vài giây chưa bấm.
  useEffect(() => {
    if (phase !== "closed") return;
    const t = setTimeout(() => setHint(true), 2600);
    return () => clearTimeout(t);
  }, [phase]);

  const open = () => {
    if (phase !== "closed") return;
    if (musicSrc) {
      // Tạo và phát ngay trong cú chạm; file chỉ tải sau khi khách bấm.
      const a = audio.current ?? new Audio();
      audio.current = a;
      a.src = musicSrc;
      a.loop = true;
      a.volume = 0.7;
      a.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
    }
    setPhase("opening");
    setTimeout(() => setPhase("open"), 900);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (autoScroll && !reduce) setScroll("waiting");
  };

  const toggleMusic = () => {
    const a = audio.current;
    if (!musicSrc) return;
    if (!a || a.paused) {
      const el = a ?? new Audio(musicSrc);
      audio.current = el;
      if (!el.src) el.src = musicSrc;
      el.loop = true;
      el.play().then(() => setPlaying(true), () => setPlaying(false));
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  // Tạm dừng nhạc khi khách chuyển ứng dụng, phát lại khi quay về.
  useEffect(() => {
    const onVis = () => {
      const a = audio.current;
      if (!a || !playing) return;
      if (document.hidden) a.pause();
      else a.play().catch(() => setPlaying(false));
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [playing]);

  useEffect(() => () => audio.current?.pause(), []);

  // Các khối hiện dần khi cuộn tới (một observer cho cả thiệp).
  useEffect(() => {
    if (phase === "closed") return;
    const nodes = root.current?.querySelectorAll<HTMLElement>("[data-fx-reveal]");
    if (!nodes?.length) return;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add(s.revealOn);
            io.unobserve(e.target);
          }
        }),
      { root: scrollParent(root.current), rootMargin: "0px 0px -8% 0px" },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [phase]);

  // Tự lướt.
  useEffect(() => {
    if (mode === "off" || mode === "done" || mode === "stopped") return;
    const el = root.current;
    if (!el) return;
    const sc = scrollParent(el);
    const target: HTMLElement | Window = sc ?? window;
    const getTop = () => (sc ? sc.scrollTop : window.scrollY);
    const viewH = () => (sc ? sc.clientHeight : window.innerHeight);
    const maxTop = () => (sc ? sc.scrollHeight - sc.clientHeight : document.documentElement.scrollHeight - window.innerHeight);
    const offsetOf = (n: HTMLElement) =>
      sc ? n.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop : n.getBoundingClientRect().top + window.scrollY;
    // Điểm dừng: khối buổi tiệc/bản đồ, RSVP. Không bao giờ tự cuộn qua form.
    const stopAt = () => {
      const first = el.querySelector<HTMLElement>("[data-fx-stop]");
      return first ? Math.max(0, offsetOf(first) - viewH() * 0.3) : maxTop();
    };

    let raf = 0;
    let pos = getTop();
    let lastSet = pos;
    let last = 0;
    let idle: ReturnType<typeof setTimeout> | undefined;

    const tick = (now: number) => {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      if (modeRef.current !== "running") return;
      const limit = Math.min(stopAt(), maxTop());
      // Đã ở (hoặc khách đã tự kéo qua) điểm dừng: kết thúc, không kéo ngược lại.
      if (pos >= limit - 1) return setScroll("done");
      pos = Math.min(limit, pos + SPEED * dt);
      lastSet = Math.round(pos);
      if (sc) sc.scrollTop = lastSet;
      else window.scrollTo(0, lastSet);
      if (pos >= limit - 1) return setScroll("done");
      raf = requestAnimationFrame(tick);
    };
    const run = () => {
      if (document.hidden || modeRef.current === "done" || modeRef.current === "stopped") return;
      modeRef.current = "running";
      setMode("running");
      pos = getTop();
      last = 0;
      raf = requestAnimationFrame(tick);
    };
    const pause = () => {
      cancelAnimationFrame(raf);
      clearTimeout(idle);
      if (modeRef.current === "running" || modeRef.current === "waiting") {
        modeRef.current = "waiting";
        setMode("waiting");
        idle = setTimeout(run, IDLE_MS);
      }
    };
    const onScroll = () => {
      // Khách kéo ngược lên xem lại: tắt tự lướt cho đến khi bấm ▶.
      if (getTop() < lastSet - 6) {
        cancelAnimationFrame(raf);
        clearTimeout(idle);
        setScroll("stopped");
      }
    };
    const onFocus = (e: FocusEvent) => {
      if ((e.target as HTMLElement).matches?.("input, textarea, select")) {
        cancelAnimationFrame(raf);
        clearTimeout(idle);
        setScroll("done");
      }
    };
    const onVis = () => (document.hidden ? pause() : undefined);

    const inputs = ["touchstart", "wheel", "keydown", "pointerdown"] as const;
    inputs.forEach((ev) => window.addEventListener(ev, pause, { passive: true }));
    target.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("focusin", onFocus);
    document.addEventListener("visibilitychange", onVis);
    if (modeRef.current === "running") run();
    else idle = setTimeout(run, phase === "open" ? IDLE_MS : FIRST_DELAY_MS);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(idle);
      inputs.forEach((ev) => window.removeEventListener(ev, pause));
      target.removeEventListener("scroll", onScroll);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
    // Chạy lại khi chuyển giữa "tắt" và "đang lướt"; các chuyển trạng thái trong vòng lặp đi qua modeRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode === "off" || mode === "done" || mode === "stopped", setScroll]);

  const coverH = frame === "preview" ? "h-[720px]" : "h-[100svh]";
  const scrollOn = mode === "running" || mode === "waiting";

  return (
    <div ref={root} className={`relative ${frame === "preview" ? s.previewFrame : ""}`}>
      {phase !== "open" && (
        <div
          aria-hidden={phase === "opening"}
          onClick={open}
          data-fx-cover
          className={`${s.cover} ${phase === "opening" ? s.coverLeaving : ""} absolute inset-x-0 top-0 z-40 ${coverH}`}
        >
          {cover}
          <div className={s.openWrap}>
            <span className={s.ripple} aria-hidden />
            <span className={s.ripple} aria-hidden />
            <button type="button" className={s.openBtn} onClick={(e) => (e.stopPropagation(), open())} autoFocus={frame === "page"}>
              Chạm để mở thiệp {musicSrc && <span className={s.note} aria-hidden>♪</span>}
            </button>
            <span className={`${s.hint} ${hint ? s.hintOn : ""}`} aria-hidden>
              👆
            </span>
          </div>
          {musicSrc && <p className={s.subtle}>Thiệp có nhạc, bạn tắt được bất cứ lúc nào</p>}
        </div>
      )}
      <noscript>
        <style>{"[data-fx-cover]{display:none!important}[data-fx-body]{height:auto!important;overflow:visible!important}[data-fx-reveal]{opacity:1!important;transform:none!important}"}</style>
      </noscript>

      <div
        data-fx-body
        className={phase === "closed" ? `${coverH} overflow-hidden` : s.body}
        // Trước khi mở, thân thiệp nằm dưới bìa và không cuộn được.
      >
        {children}
      </div>

      {phase === "open" && (musicSrc || scrollOn || mode === "stopped") && (
        <div className={s.dock}>
          <div className={s.dockInner}>
            {(scrollOn || mode === "stopped") && (
              <button
                type="button"
                className={s.fab}
                aria-label={scrollOn ? "Dừng tự lướt" : "Tiếp tục tự lướt"}
                onClick={(e) => {
                  e.stopPropagation();
                  setScroll(scrollOn ? "stopped" : "running");
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {scrollOn ? "⏸" : "▶"}
              </button>
            )}
            {musicSrc && (
              <button
                type="button"
                className={s.fab}
                aria-label={playing ? "Tắt nhạc" : "Bật nhạc"}
                aria-pressed={playing}
                onClick={toggleMusic}
              >
                <span style={{ display: "inline-block", opacity: playing ? 1 : 0.5 }}>
                  {playing ? "♪" : "🔇"}
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
