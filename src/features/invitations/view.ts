import type { InvitationContent } from "./content";

export type InvitationSession = {
  id: string;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  venue_name: string | null;
  address: string | null;
  map_url: string | null;
};

/** Dữ liệu một mẫu thiệp cần để hiển thị (cả trang công khai lẫn xem trước trong trình sửa). */
export type InvitationView = {
  content: InvitationContent;
  event: { title: string; event_type: string };
  sessions: InvitationSession[];
};

export function mediaUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/event-media/${path}`;
}

export function mapHref(s: InvitationSession) {
  if (s.map_url) return s.map_url;
  const q = [s.venue_name, s.address].filter(Boolean).join(", ");
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}

const TZ = "Asia/Ho_Chi_Minh";

export function sessionDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return {
    time: new Intl.DateTimeFormat("vi-VN", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(d),
    weekday: new Intl.DateTimeFormat("vi-VN", { timeZone: TZ, weekday: "long" }).format(d),
    date: new Intl.DateTimeFormat("vi-VN", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" }).format(d),
  };
}

/** Buổi sớm nhất có thời gian, dùng cho đếm ngược. */
export function firstStart(sessions: InvitationSession[]) {
  return sessions.map((s) => s.starts_at).filter(Boolean).sort()[0] ?? null;
}
