/* eslint-disable @next/next/no-img-element -- ảnh đã được nén ở client và phục vụ từ CDN của Storage */
import type { CSSProperties, ReactNode } from "react";
import { firstStart, mapHref, mediaUrl, sessionDate, type InvitationView } from "../view";
import { Countdown } from "./countdown";

export type Theme = {
  /** Biến CSS của mẫu: nền, chữ, nhấn, viền. */
  vars: { bg: string; fg: string; muted: string; accent: string; line: string; card: string };
  headingFont: "serif" | "sans";
  cover: "full" | "framed";
  ornament?: ReactNode;
};

const v = (name: keyof Theme["vars"]) => `var(--inv-${name})`;

function Section({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`px-6 py-10 text-center ${className}`}>{children}</section>;
}

export function BaseTemplate({ view, theme, footer }: { view: InvitationView; theme: Theme; footer?: ReactNode }) {
  const { content: c, sessions } = view;
  const heading = theme.headingFont === "serif" ? "font-serif" : "font-sans font-semibold tracking-tight";
  const style = Object.fromEntries(Object.entries(theme.vars).map(([k, val]) => [`--inv-${k}`, val])) as CSSProperties;
  const start = firstStart(sessions);
  const people = c.people.filter((p) => p.name);

  return (
    <article style={{ ...style, background: v("bg"), color: v("fg") }} className="mx-auto min-h-full w-full max-w-[480px]">
      {/* Bìa */}
      {theme.cover === "full" && c.coverImage ? (
        <header className="relative flex min-h-[85svh] items-end overflow-hidden">
          <img src={mediaUrl(c.coverImage)} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="relative w-full px-6 pb-12 text-center text-white">
            <p className="text-sm uppercase tracking-[0.3em] opacity-90">{c.subtitle}</p>
            <h1 className={`${heading} mt-3 text-4xl leading-tight`}>{c.title || view.event.title}</h1>
          </div>
        </header>
      ) : (
        <header className="px-6 pt-14 pb-6 text-center">
          {theme.ornament}
          <p className="mt-4 text-sm uppercase tracking-[0.3em]" style={{ color: v("muted") }}>
            {c.subtitle}
          </p>
          <h1 className={`${heading} mt-3 text-4xl leading-tight`} style={{ color: v("accent") }}>
            {c.title || view.event.title}
          </h1>
          {c.coverImage && (
            <div className="mt-8 overflow-hidden rounded-2xl p-1.5" style={{ border: `1px solid ${v("line")}` }}>
              <img src={mediaUrl(c.coverImage)} alt="" className="aspect-[4/5] w-full rounded-xl object-cover" />
            </div>
          )}
        </header>
      )}

      {/* Lời mời */}
      <Section>
        <p className="text-sm uppercase tracking-[0.25em]" style={{ color: v("muted") }}>
          {c.heading}
        </p>
        {people.length > 0 && (
          <div className="mt-6 grid gap-6" style={{ gridTemplateColumns: people.length > 1 ? "1fr 1fr" : "1fr" }}>
            {people.map((p, i) => (
              <div key={i}>
                {p.label && (
                  <p className="text-xs uppercase tracking-widest" style={{ color: v("muted") }}>
                    {p.label}
                  </p>
                )}
                <p className={`${heading} mt-1 text-2xl`} style={{ color: v("accent") }}>
                  {p.name}
                </p>
                {p.detail && (
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: v("muted") }}>
                    {p.detail}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
        {c.message && <p className="mx-auto mt-6 max-w-sm whitespace-pre-line leading-relaxed">{c.message}</p>}
      </Section>

      {/* Buổi tiệc */}
      {sessions.length > 0 && (
        <Section className="space-y-4 pt-0">
          {sessions.map((s) => {
            const d = sessionDate(s.starts_at);
            const href = mapHref(s);
            return (
              <div key={s.id} className="rounded-2xl px-5 py-6" style={{ background: v("card"), border: `1px solid ${v("line")}` }}>
                <p className={`${heading} text-xl`} style={{ color: v("accent") }}>
                  {s.name}
                </p>
                {d && (
                  <div className="mt-4 flex items-center justify-center gap-4">
                    <span className="text-3xl font-semibold tabular-nums">{d.time}</span>
                    <span className="h-10 w-px" style={{ background: v("line") }} />
                    <span className="text-left text-sm leading-snug">
                      <span className="capitalize">{d.weekday}</span>
                      <br />
                      {d.date}
                    </span>
                  </div>
                )}
                {(s.venue_name || s.address) && (
                  <p className="mt-4 text-sm leading-relaxed">
                    {s.venue_name && <strong className="block">{s.venue_name}</strong>}
                    {s.address}
                  </p>
                )}
                {href && (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-block rounded-full px-5 py-2 text-sm font-semibold"
                    style={{ background: v("accent"), color: v("bg") }}
                  >
                    Xem bản đồ
                  </a>
                )}
              </div>
            );
          })}
        </Section>
      )}

      {c.showCountdown && start && (
        <Section className="pt-0">
          <Countdown target={start} className="flex justify-center gap-3" />
        </Section>
      )}

      {/* Album */}
      {c.gallery.length > 0 && (
        <Section className="pt-0">
          <div className="grid grid-cols-2 gap-2">
            {c.gallery.map((p, i) => (
              <img
                key={p}
                src={mediaUrl(p)}
                alt=""
                loading="lazy"
                className={`w-full rounded-xl object-cover ${i % 3 === 0 ? "col-span-2 aspect-[3/2]" : "aspect-square"}`}
              />
            ))}
          </div>
        </Section>
      )}

      {c.closing && (
        <Section className="pt-0">
          <p className={`${heading} mx-auto max-w-xs text-lg leading-relaxed`} style={{ color: v("accent") }}>
            {c.closing}
          </p>
        </Section>
      )}

      {footer}
    </article>
  );
}
