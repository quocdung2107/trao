/* eslint-disable @next/next/no-img-element -- ảnh đã được nén ở client và phục vụ từ CDN của Storage */
import { Playfair_Display } from "next/font/google";
import type { CSSProperties, ReactNode } from "react";
import { firstStart, mapHref, mediaUrl, sessionDate, type InvitationView } from "../../view";
import type { TemplateSlots } from "../base";
import { Countdown } from "../countdown";
import { Album } from "./album";
import { resolveMusic } from "./music";
import { Particles } from "./particles";
import { FESTIVE_PRESETS, type FestiveKey, type FestivePreset } from "./presets";
import { FestiveStage } from "./stage";
import { s } from "./styles";

const display = Playfair_Display({ subsets: ["latin", "vietnamese"], variable: "--font-display", display: "swap" });

const PARTICLE_COLOR: Record<FestivePreset["particles"], string> = {
  snow: "#fffaf2",
  stars: "#fff1c2",
  glitter: "#e6c473",
  none: "transparent",
};

function headingClass(p: FestivePreset) {
  if (p.headingFont === "display") return "font-[family-name:var(--font-display)]";
  if (p.headingFont === "serif") return "font-serif";
  return "font-sans font-semibold tracking-tight";
}

function Star({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <path d="M50 0 L57 43 L100 50 L57 57 L50 100 L43 57 L0 50 L43 43 Z" fill="#fff4cf" />
      <path d="M50 18 L54 46 L82 50 L54 54 L50 82 L46 54 L18 50 L46 46 Z" fill="#f2cf7a" transform="rotate(45 50 50)" opacity="0.75" />
    </svg>
  );
}

function Fan() {
  return (
    <svg viewBox="0 0 176 96" className={s.fan} aria-hidden>
      {Array.from({ length: 9 }, (_, i) => {
        const a = Math.PI * (0.1 + (0.8 * i) / 8);
        return <line key={i} x1="88" y1="92" x2={88 - Math.cos(a) * 84} y2={92 - Math.sin(a) * 84} stroke="#d8b56a" strokeWidth="1.2" />;
      })}
      <path d="M8 92 A80 80 0 0 1 168 92" fill="none" stroke="#d8b56a" strokeWidth="1.5" />
      <path d="M36 92 A52 52 0 0 1 140 92" fill="none" stroke="#d8b56a" strokeWidth="1" />
      <circle cx="88" cy="92" r="6" fill="#d8b56a" />
    </svg>
  );
}

function Sprig() {
  return (
    <svg viewBox="0 0 120 40" className="mx-auto h-8 w-24" aria-hidden>
      <path d="M10 22 Q60 6 110 22" stroke="#3f6b3a" strokeWidth="2" fill="none" />
      {[22, 40, 58, 76, 94].map((x, i) => (
        <ellipse key={x} cx={x} cy={i % 2 ? 22 : 12} rx="9" ry="4" fill="#4d7d45" transform={`rotate(${i % 2 ? 25 : -25} ${x} ${i % 2 ? 22 : 12})`} />
      ))}
      <circle cx="56" cy="20" r="4" fill="#b3261e" />
      <circle cx="64" cy="22" r="4" fill="#c8362a" />
    </svg>
  );
}

function CoverArt({ preset, title, kicker, greeting, h }: { preset: FestivePreset; title: string; kicker: string; greeting?: string | null; h: string }) {
  const heading = (
    <div className={s.coverArt}>
      <p className="text-xs uppercase tracking-[0.35em] opacity-80">{kicker}</p>
      <h1 className={`${h} mt-3 text-4xl leading-tight`}>{title}</h1>
      {greeting && (
        <p className="mt-4 text-sm">
          <span className="opacity-70">Kính gửi </span>
          <strong>{greeting}</strong>
        </p>
      )}
    </div>
  );
  if (preset.cover === "envelope")
    return (
      <>
        {heading}
        <div className={s.coverArt}>
          <div className={s.envelope}>
            <span className={s.seal}>✦</span>
          </div>
        </div>
      </>
    );
  if (preset.cover === "star")
    return (
      <>
        <div className={s.coverArt}>
          <div className={s.starWrap}>
            <span className={s.starGlow} />
            <Star className="relative h-full w-full" />
          </div>
        </div>
        {heading}
      </>
    );
  return (
    <>
      <span className={s.deco} aria-hidden />
      <div className={s.coverArt}>
        <Fan />
      </div>
      {heading}
    </>
  );
}

function Block({ children, className = "", stop, style }: { children: ReactNode; className?: string; stop?: boolean; style?: CSSProperties }) {
  return (
    <section data-fx-reveal="" data-fx-stop={stop ? "" : undefined} className={`${s.reveal} px-6 py-10 text-center ${className}`} style={style}>
      {children}
    </section>
  );
}

export type FestiveProps = {
  presetKey: FestiveKey;
  view: InvitationView;
  /** Khung hiển thị: trang thật (cả màn hình) hay khung xem trước trong trình sửa. */
  frame?: "page" | "preview";
  /** Đổi đường dẫn ảnh thành URL; mặc định là Storage. Trang xem mẫu dùng ảnh tĩnh. */
  resolveMedia?: (path: string) => string;
} & TemplateSlots;

/**
 * Engine thiệp lễ hội: một bố cục, nhiều preset dữ liệu.
 * Các khối tự ẩn khi không có dữ liệu (không có buổi tiệc, không có RSVP…), nên dùng được cho mọi loại sự kiện,
 * kể cả thiệp chỉ để chúc.
 */
export function FestiveTemplate({ presetKey, view, frame = "page", resolveMedia = mediaUrl, greeting, rsvp, wishes, footer }: FestiveProps) {
  const p: FestivePreset = FESTIVE_PRESETS[presetKey];
  const { content: c, sessions } = view;
  const h = headingClass(p);
  const title = c.title || view.event.title;
  const start = firstStart(sessions);
  const people = c.people.filter((x) => x.name);
  const marquee = c.marquee || p.marquee;
  const style = {
    "--inv-bg": p.vars.bg,
    "--inv-fg": p.vars.fg,
    "--inv-muted": p.vars.muted,
    "--inv-accent": p.vars.accent,
    "--inv-line": p.vars.line,
    "--inv-card": p.vars.card,
    "--fx-cover-bg": p.vars.coverBg,
    "--fx-cover-fg": p.vars.coverFg,
    "--fx-button": p.vars.button,
    "--fx-button-fg": p.vars.buttonFg,
    background: "var(--inv-bg)",
    color: "var(--inv-fg)",
  } as CSSProperties;
  const muted = { color: "var(--inv-muted)" };
  const accent = { color: "var(--inv-accent)" };
  const card = { background: "var(--inv-card)", border: "1px solid var(--inv-line)" };

  return (
    <article style={style} className={`${display.variable} relative mx-auto min-h-full w-full max-w-[480px] overflow-x-clip`}>
      {/* Trang thật: nền trang cùng màu thiệp (màn hình rộng, vùng kéo quá đà trên điện thoại). */}
      {frame === "page" && <style>{`body{background:${p.vars.bg}}`}</style>}
      <FestiveStage
        frame={frame}
        autoScroll={c.autoScroll}
        musicSrc={resolveMusic(c.music, p.music)}
        cover={<CoverArt preset={p} title={title} kicker={c.subtitle || p.coverKicker} greeting={greeting} h={h} />}
      >
        <Particles kind={p.particles} color={PARTICLE_COLOR[p.particles]} />

        {/* Mở đầu */}
        <header className="px-6 pt-14 pb-8 text-center" style={{ background: p.vars.coverBg, color: p.vars.coverFg }}>
          {p.cover === "envelope" ? <Sprig /> : p.cover === "star" ? <Star className="mx-auto h-10 w-10" /> : <Fan />}
          <p className="mt-4 text-xs uppercase tracking-[0.35em] opacity-80">{c.subtitle || p.coverKicker}</p>
          <h2 className={`${h} mt-3 text-4xl leading-tight`}>{title}</h2>
          {c.coverImage && (
            <div
              className={`mt-8 overflow-hidden ${p.album === "arch" ? s.arch : "rounded-2xl"}`}
              style={p.album === "arch" ? undefined : { border: `1px solid ${p.vars.accent}`, padding: 6 }}
            >
              <img src={resolveMedia(c.coverImage)} alt="" className={`aspect-[4/5] w-full object-cover ${p.album === "arch" ? "" : "rounded-xl"}`} />
            </div>
          )}
        </header>

        {marquee && (
          <div className={`${s.marquee} ${h} text-lg`} style={accent}>
            <div className={s.marqueeTrack}>
              <span>{marquee}</span>
              <span>{marquee}</span>
              <span aria-hidden>{marquee}</span>
              <span aria-hidden>{marquee}</span>
            </div>
          </div>
        )}

        {/* Lời mời */}
        <Block>
          <p className="text-xs uppercase tracking-[0.3em]" style={muted}>
            {c.heading}
          </p>
          {greeting && (
            <p className={`${h} mt-3 text-2xl`} style={accent}>
              {greeting}
            </p>
          )}
          {people.length > 0 && (
            <div className="mt-6 grid gap-6" style={{ gridTemplateColumns: people.length > 1 ? "1fr 1fr" : "1fr" }}>
              {people.map((x, i) => (
                <div key={i}>
                  {x.label && (
                    <p className="text-xs uppercase tracking-widest" style={muted}>
                      {x.label}
                    </p>
                  )}
                  <p className={`${h} mt-1 text-2xl`} style={accent}>
                    {x.name}
                  </p>
                  {x.detail && (
                    <p className="mt-1 text-xs leading-relaxed" style={muted}>
                      {x.detail}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          {c.message && <p className="mx-auto mt-6 max-w-sm whitespace-pre-line leading-relaxed">{c.message}</p>}
        </Block>

        {c.showCountdown && start && (
          <Block className="pt-0">
            <div className="rounded-2xl px-4 py-5" style={card}>
              <p className="mb-3 text-xs uppercase tracking-[0.3em]" style={muted}>
                Còn
              </p>
              <Countdown target={start} className="flex justify-center gap-3" />
            </div>
          </Block>
        )}

        {c.gallery.length > 0 && (
          <section data-fx-reveal="" className={`${s.reveal} py-6`}>
            <Album kind={p.album} photos={c.gallery.map(resolveMedia)} />
          </section>
        )}

        {/* Buổi tiệc: điểm dừng của tự lướt */}
        {sessions.length > 0 && (
          <Block className="space-y-4" stop>
            {sessions.map((x) => {
              const d = sessionDate(x.starts_at);
              const href = mapHref(x);
              return (
                <div key={x.id} className="rounded-2xl px-5 py-6" style={card}>
                  <p className={`${h} text-xl`} style={accent}>
                    {x.name}
                  </p>
                  {d && (
                    <div className="mt-4 flex items-center justify-center gap-4">
                      <span className="text-3xl font-semibold tabular-nums">{d.time}</span>
                      <span className="h-10 w-px" style={{ background: "var(--inv-line)" }} />
                      <span className="text-left text-sm leading-snug">
                        <span className="capitalize">{d.weekday}</span>
                        <br />
                        {d.date}
                      </span>
                    </div>
                  )}
                  {(x.venue_name || x.address) && (
                    <p className="mt-4 text-sm leading-relaxed">
                      {x.venue_name && <strong className="block">{x.venue_name}</strong>}
                      {x.address}
                    </p>
                  )}
                  {href && (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-block rounded-full px-5 py-2 text-sm font-semibold"
                      style={{ background: "var(--inv-accent)", color: "var(--inv-bg)" }}
                    >
                      Xem bản đồ
                    </a>
                  )}
                </div>
              );
            })}
          </Block>
        )}

        {rsvp && (
          <Block className="pt-0" stop>
            {rsvp}
          </Block>
        )}

        {wishes && <Block className="pt-0">{wishes}</Block>}

        {c.closing && (
          <Block className="pt-0">
            <p className={`${h} mx-auto max-w-xs text-xl leading-relaxed`} style={accent}>
              {c.closing}
            </p>
          </Block>
        )}

        {footer}
      </FestiveStage>
    </article>
  );
}
