/* eslint-disable @next/next/no-img-element -- ảnh đã được nén ở client và phục vụ từ CDN của Storage */
import { Dancing_Script, Playfair_Display } from "next/font/google";
import type { CSSProperties, ReactNode } from "react";
import { firstStart, mediaUrl, type InvitationView } from "../../view";
import type { TemplateSlots } from "../base";
import { Countdown } from "../countdown";
import { Album } from "./album";
import { Bow, Garland, Holly, Lantern, MiniGifts, Tree } from "./decor";
import { Program, SessionCard } from "./event-details";
import { GiftBox } from "./interactive";
import { resolveMusic } from "./music";
import { Particles } from "./particles";
import { FESTIVE_PRESETS, type FestiveKey, type FestivePreset } from "./presets";
import { FestiveStage } from "./stage";
import { s } from "./styles";
import { Letters } from "./typography";

const display = Playfair_Display({ subsets: ["latin", "vietnamese"], variable: "--font-display", display: "swap" });
// Chữ viết tay cho lời nhắn cá nhân (mẫu Vintage). Có bộ chữ tiếng Việt.
const script = Dancing_Script({ subsets: ["latin", "vietnamese"], variable: "--font-script", display: "swap" });

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
      <p className={`${s.pulseText} text-xs uppercase tracking-[0.35em] opacity-80`}>{kicker}</p>
      <Letters as="h1" text={title} className={`${h} mt-3 text-4xl leading-tight`} delay={300} />
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
  if (preset.cover === "envelope3d")
    return (
      <>
        <Garland ornaments={false} className={s.coverGarland} />
        {heading}
        <div className={`${s.coverArt} ${s.env3d}`}>
          <span className={s.envLight} />
          <div className={s.envBack} />
          <div className={s.envCard}>
            <span className="font-[family-name:var(--font-script)] text-2xl" style={{ color: "#8b2028" }}>
              Merry Christmas
            </span>
          </div>
          <div className={s.envFront} />
          <div className={s.envFlap} />
          <span className={s.envSeal}>
            <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
              <path d="M12 2 L18 11 H15 L20 18 H4 L9 11 H6 Z" fill="#f4ebd8" />
              <rect x="11" y="18" width="2" height="4" fill="#f4ebd8" />
            </svg>
          </span>
        </div>
      </>
    );
  if (preset.cover === "nordic")
    return (
      <>
        <div className={s.coverArt}>
          <svg viewBox="0 0 120 140" className="mx-auto h-36 w-32" aria-hidden>
            <path className={s.draw} d="M60 8 V132 M60 30 L34 52 M60 30 L86 52 M60 56 L26 84 M60 56 L94 84 M60 84 L20 116 M60 84 L100 116" stroke="#2e5a47" strokeWidth="3" strokeLinecap="round" fill="none" />
            <circle cx="60" cy="8" r="4" fill="#c9a25a" />
          </svg>
        </div>
        {heading}
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
    <section data-fx-reveal="" data-fx-stop={stop ? "" : undefined} className={`${s.reveal} relative px-6 py-10 text-center ${className}`} style={style}>
      {children}
    </section>
  );
}

function Divider() {
  return <span className={s.divider} aria-hidden />;
}

function HeroOrnament({ p }: { p: FestivePreset }) {
  if (p.cover === "envelope") return <Sprig />;
  if (p.cover === "star") return <Star className="mx-auto h-10 w-10" />;
  if (p.cover === "deco") return <Fan />;
  if (p.cover === "nordic") return <span className="mx-auto block h-px w-16" style={{ background: "var(--inv-accent)" }} />;
  return <Holly className="mx-auto" />;
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
 * Thứ tự: bìa → lời chào → chữ chạy → lời mời → thông tin buổi (lịch, giờ, bản đồ) → chương trình → đếm ngược
 * → album → RSVP → lời chúc → hộp quà → lời chào cuối.
 * Các khối tự ẩn khi không có dữ liệu (không có buổi tiệc, không có RSVP…), nên dùng được cho mọi loại sự kiện,
 * kể cả thiệp chỉ để chúc.
 */
export function FestiveTemplate({ presetKey, view, frame = "page", resolveMedia = mediaUrl, greeting, rsvp, wishes, footer }: FestiveProps) {
  const p: FestivePreset = FESTIVE_PRESETS[presetKey];
  const { content: c, sessions } = view;
  const h = headingClass(p);
  const personal = p.script ? "font-[family-name:var(--font-script)] text-[1.35em] leading-snug" : "";
  const title = c.title || view.event.title;
  const start = firstStart(sessions);
  const people = c.people.filter((x) => x.name);
  const marquee = c.marquee || p.marquee;
  const vintage = p.decor === "vintage";
  // Chỉ vẽ lịch tháng ở buổi đầu tiên; các buổi sau cùng tháng thì lặp lại thừa.
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
    <article style={style} className={`${display.variable} ${script.variable} relative mx-auto min-h-full w-full max-w-[480px] overflow-x-clip`}>
      {/* Trang thật: nền trang cùng màu thiệp (màn hình rộng, vùng kéo quá đà trên điện thoại). */}
      {frame === "page" && <style>{`body{background:${p.vars.bg}}`}</style>}
      <FestiveStage
        frame={frame}
        autoScroll={c.autoScroll}
        musicSrc={resolveMusic(c.music, p.music)}
        shareTitle={title}
        cover3d={p.cover === "envelope3d"}
        cover={<CoverArt preset={p} title={title} kicker={c.subtitle || p.coverKicker} greeting={greeting} h={h} />}
      >
        <Particles kind={p.particles} />

        {/* Lời chào mở đầu */}
        <header className={`${s.hero} relative px-6 pb-8 text-center ${vintage ? "pt-24" : "pt-14"}`} style={{ background: p.vars.coverBg, color: p.vars.coverFg }}>
          {vintage && (
            <>
              <Garland className={s.heroGarland} />
              <Bow className={s.heroBow} />
            </>
          )}
          <HeroOrnament p={p} />
          <p className="mt-4 text-xs uppercase tracking-[0.35em] opacity-80">{c.subtitle || p.coverKicker}</p>
          <Letters as="h2" text={title} className={`${h} mt-3 text-4xl leading-tight`} delay={200} />
          {c.coverImage && (
            <div
              className={`${s.heroPhoto} mt-8 overflow-hidden ${p.album === "arch" ? s.arch : "rounded-2xl"}`}
              style={p.album === "arch" ? undefined : { border: `1px solid ${p.album === "plain" ? p.vars.line : p.vars.accent}`, padding: 6 }}
            >
              <img src={resolveMedia(c.coverImage)} alt="" className={`aspect-[4/5] w-full object-cover ${p.album === "arch" ? "" : "rounded-xl"}`} />
            </div>
          )}
          {vintage && <Holly className={`${s.sway} mx-auto mt-6`} />}
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
        <Block className={vintage ? s.parchment : ""}>
          <p className="text-xs uppercase tracking-[0.3em]" style={muted}>
            {c.heading}
          </p>
          {greeting && (
            <p className={`${h} ${s.popIn} mt-3 text-2xl`} style={accent}>
              {greeting}
            </p>
          )}
          <Divider />
          {people.length > 0 && (
            <div className="mt-6 grid gap-6" style={{ gridTemplateColumns: people.length > 1 ? "1fr 1fr" : "1fr" }}>
              {people.map((x, i) => (
                <div key={i} className={s.popIn} style={{ animationDelay: `${300 + i * 200}ms` }}>
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
          {c.message && (
            <div className={`mx-auto mt-6 max-w-sm leading-relaxed ${personal}`}>
              {c.message.split("\n").map((line, i) => (
                <p key={i} className={s.line} style={{ transitionDelay: `${200 + i * 180}ms` }}>
                  {line || "\u00a0"}
                </p>
              ))}
            </div>
          )}
        </Block>

        {/* Thông tin buổi: giờ, lịch tháng, địa điểm, bản đồ, chỉ đường, thêm vào lịch */}
        {sessions.length > 0 && (
          <Block className="space-y-4">
            <p className={`${h} text-2xl`} style={accent}>
              {sessions.length > 1 ? "Các buổi tiệc" : "Thông tin buổi tiệc"}
            </p>
            {sessions.map((x, i) => (
              <SessionCard key={x.id} x={x} title={title} h={h} showCalendar={i === 0} />
            ))}
          </Block>
        )}

        {c.program.some((x) => x.title) && (
          <Block className="pt-0">
            <div className="rounded-2xl px-5 py-6" style={card}>
              <Program items={c.program} h={h} />
            </div>
          </Block>
        )}

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
            <p className={`${h} mb-2 text-center text-2xl`} style={accent}>
              Khoảnh khắc
            </p>
            <Album kind={p.album} photos={c.gallery.map(resolveMedia)} />
          </section>
        )}

        {/* RSVP: điểm dừng của tự lướt, không bao giờ tự cuộn qua form */}
        {rsvp && (
          <Block className="pt-0" stop>
            {rsvp}
          </Block>
        )}

        {wishes && <Block className="pt-0">{wishes}</Block>}

        {c.showGift && (
          <Block>
            <p className={`${h} mb-12 text-2xl`} style={accent}>
              Một món quà nhỏ
            </p>
            <GiftBox message={c.giftMessage || p.gift} h={`${h} ${personal}`} />
          </Block>
        )}

        {/* Lời chào cuối */}
        <Block className={`${s.finale} pb-14 ${vintage ? "pt-20" : ""}`} style={{ background: p.vars.coverBg, color: p.vars.coverFg }}>
          {vintage && <Garland ornaments={false} className={s.finaleGarland} />}
          <Tree className="mx-auto h-44 w-44" />
          <Letters as="p" text={p.finale} className={`${h} mt-4 text-4xl`} step={70} />
          {c.closing && <p className={`mx-auto mt-4 max-w-xs text-lg leading-relaxed opacity-90 ${personal}`}>{c.closing}</p>}
          {vintage && (
            <div className="mt-6 flex items-end justify-between">
              <MiniGifts />
              <Lantern delay={0} />
              <Lantern delay={700} className="hidden min-[380px]:block" />
              <MiniGifts className="-scale-x-100" />
            </div>
          )}
        </Block>

        {footer}
      </FestiveStage>
    </article>
  );
}
