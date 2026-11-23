import type { ProgramItem } from "../../content";
import { sessionDate, type InvitationSession } from "../../view";
import { MapEmbed } from "./interactive";
import { s } from "./styles";

const TZ = "Asia/Ho_Chi_Minh";
const WEEK = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

/** Ngày/tháng/năm theo giờ Việt Nam. */
function ymd(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/** Lịch tháng có khoanh ngày tổ chức. Tính ở máy chủ, không cần JS. */
export function MonthCalendar({ iso }: { iso: string }) {
  const { y, m, d } = ymd(iso);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  return (
    <div className={s.calendar} aria-label={`Lịch tháng ${m}/${y}, ngày ${d}`}>
      <p className="mb-3 text-xs uppercase tracking-[0.3em]" style={{ color: "var(--inv-muted)" }}>
        Tháng {m} · {y}
      </p>
      <div className="grid grid-cols-7 gap-y-1.5 text-sm tabular-nums" aria-hidden>
        {WEEK.map((w) => (
          <span key={w} className="text-[11px] font-semibold" style={{ color: "var(--inv-muted)" }}>
            {w}
          </span>
        ))}
        {cells.map((c, i) => (
          <span key={i} className={c === d ? s.calDay : "py-1"}>
            {c ?? ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function place(x: InvitationSession) {
  return [x.venue_name, x.address].filter(Boolean).join(", ");
}

/** Chỉ đường: link chủ tiệc dán vào (nếu có), không thì Google Maps chỉ đường tới địa chỉ. */
export function directionsHref(x: InvitationSession) {
  if (x.map_url) return x.map_url;
  const q = place(x);
  return q ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}` : null;
}

const icsDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = (t: string) => t.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");

/** Link thêm vào lịch: Google Calendar và file .ics (iPhone, Outlook). Không cần JS. */
function calendarLinks(title: string, x: InvitationSession) {
  if (!x.starts_at) return null;
  const start = icsDate(x.starts_at);
  const end = icsDate(x.ends_at ?? new Date(new Date(x.starts_at).getTime() + 3 * 3600_000).toISOString());
  const name = `${title} · ${x.name}`;
  const loc = place(x);
  const google = `https://calendar.google.com/calendar/render?${new URLSearchParams({ action: "TEMPLATE", text: name, dates: `${start}/${end}`, location: loc }).toString()}`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TRAO//Thiep moi//VI",
    "BEGIN:VEVENT",
    `UID:${x.id}@trao`,
    `DTSTAMP:${start}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${icsText(name)}`,
    loc && `LOCATION:${icsText(loc)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(name)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
  return { google, ics: `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}` };
}

const pill = "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold";

/** Một buổi: giờ, ngày, lịch tháng, địa điểm, bản đồ, chỉ đường, thêm vào lịch. */
export function SessionCard({ x, title, h, showCalendar }: { x: InvitationSession; title: string; h: string; showCalendar: boolean }) {
  const d = sessionDate(x.starts_at);
  const end = sessionDate(x.ends_at);
  const dir = directionsHref(x);
  const cal = calendarLinks(title, x);
  const q = place(x);
  return (
    <div className="rounded-2xl px-5 py-6" style={{ background: "var(--inv-card)", border: "1px solid var(--inv-line)" }}>
      <p className={`${h} text-xl`} style={{ color: "var(--inv-accent)" }}>
        {x.name}
      </p>
      {d && (
        <div className="mt-4 flex items-center justify-center gap-4">
          <span className="text-3xl font-semibold tabular-nums">
            {d.time}
            {end && <span className="text-base font-normal opacity-70"> – {end.time}</span>}
          </span>
          <span className="h-10 w-px" style={{ background: "var(--inv-line)" }} />
          <span className="text-left text-sm leading-snug">
            <span className="capitalize">{d.weekday}</span>
            <br />
            {d.date}
          </span>
        </div>
      )}
      {showCalendar && x.starts_at && (
        <div className="mt-5">
          <MonthCalendar iso={x.starts_at} />
        </div>
      )}
      {q && (
        <p className="mt-5 text-sm leading-relaxed">
          <span aria-hidden className={s.pin}>
            📍
          </span>
          {x.venue_name && <strong className="block">{x.venue_name}</strong>}
          {x.address}
        </p>
      )}
      {q && <MapEmbed query={q} />}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {dir && (
          <a href={dir} target="_blank" rel="noopener noreferrer" className={pill} style={{ background: "var(--inv-accent)", color: "var(--inv-bg)" }}>
            Chỉ đường
          </a>
        )}
        {cal && (
          <>
            <a href={cal.google} target="_blank" rel="noopener noreferrer" className={pill} style={{ border: "1px solid var(--inv-line)" }}>
              Thêm vào Google Lịch
            </a>
            <a href={cal.ics} download={`${x.name}.ics`} className={pill} style={{ border: "1px solid var(--inv-line)" }}>
              Lịch iPhone
            </a>
          </>
        )}
      </div>
    </div>
  );
}

/** Chương trình theo giờ, dạng dòng thời gian. */
export function Program({ items, h }: { items: ProgramItem[]; h: string }) {
  const list = items.filter((i) => i.title);
  if (!list.length) return null;
  return (
    <div className="text-left">
      <p className={`${h} mb-5 text-center text-2xl`} style={{ color: "var(--inv-accent)" }}>
        Chương trình
      </p>
      <ol className={s.timeline}>
        {list.map((i, k) => (
          <li key={k} className={s.timelineItem} style={{ transitionDelay: `${k * 120}ms` }}>
            <span className="w-14 shrink-0 font-semibold tabular-nums" style={{ color: "var(--inv-accent)" }}>
              {i.time}
            </span>
            <span>{i.title}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
