import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { parseContent } from "./content";
import { withoutPartyIfGreeting, type InvitationSession, type InvitationView } from "./view";

export const invitationTag = (slug: string) => `inv:${slug}`;

export type Wish = { author_name: string; message: string; created_at: string };
export type PublicInvitation = InvitationView & {
  slug: string;
  template_key: string;
  updated_at: string;
  wishes: Wish[];
  /** Chủ tiệc cho phép đăng ký tham dự qua link chung (luôn false với "Lời chúc"). */
  open_rsvp: boolean;
  rsvp_deadline: string | null;
};

/** Thiệp đã xuất bản, đọc bằng khóa publishable (không cookie) nên cache được; xóa cache khi chủ tiệc lưu. */
export async function getPublishedInvitation(slug: string): Promise<PublicInvitation | null> {
  "use cache";
  cacheTag(invitationTag(slug));
  cacheLife("hours");

  if (!/^[A-Za-z0-9_-]{12}$/.test(slug)) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const res = await fetch(`${url}/rest/v1/rpc/get_invitation`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ p_slug: slug }),
  });
  if (!res.ok) throw new Error(`get_invitation ${res.status}`);
  const data = (await res.json()) as null | {
    slug: string;
    template_key: string;
    updated_at: string;
    content: unknown;
    event: { title: string; event_type: string };
    sessions: InvitationSession[];
    wishes?: Wish[];
    open_rsvp?: boolean;
    rsvp_deadline?: string | null;
  };
  if (!data) return null;
  return withoutPartyIfGreeting({
    ...data,
    wishes: data.wishes ?? [],
    open_rsvp: data.open_rsvp === true,
    rsvp_deadline: data.rsvp_deadline ?? null,
    content: parseContent(data.content),
  });
}

export type GuestInvite = Omit<InvitationSession, "id"> & {
  session_id: string;
  rsvp_status: "pending" | "yes" | "no" | "maybe";
  attending_count: number | null;
  rsvp_note: string | null;
};
export type GuestView = {
  salutation: string;
  max_party_size: number;
  rsvp_deadline: string | null;
  rsvp_closed: boolean;
  consented: boolean;
  invites: GuestInvite[];
};

export const isGuestToken = (t: unknown): t is string => typeof t === "string" && /^[A-Za-z0-9_-]{22}$/.test(t);

/** Phần riêng của khách (không cache: câu trả lời RSVP đổi theo từng lần khách gửi). */
export async function getGuestInvitation(slug: string, token: string): Promise<GuestView | null> {
  if (!/^[A-Za-z0-9_-]{12}$/.test(slug) || !isGuestToken(token)) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const res = await fetch(`${url}/rest/v1/rpc/get_guest_invitation`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ p_slug: slug, p_token: token }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`get_guest_invitation ${res.status}`);
  return (await res.json()) as GuestView | null;
}

export type OpenRsvpStatus = {
  status: "pending" | "approved" | "rejected";
  name: string;
  party_size: number;
  guest_token: string | null;
};
