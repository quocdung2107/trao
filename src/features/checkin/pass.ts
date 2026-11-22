import "server-only";
import { isGuestToken } from "@/features/invitations/public";

export type GuestPass = {
  event_title: string;
  name: string;
  party: number;
  sessions: {
    name: string;
    starts_at: string | null;
    venue_name: string | null;
    address: string | null;
    rsvp: "pending" | "yes" | "maybe";
    tables: string[] | null;
  }[];
};

/** Thẻ vào tiệc của khách theo token (không cache: số bàn có thể đổi tới phút chót). */
export async function getGuestPass(token: string): Promise<GuestPass | null> {
  if (!isGuestToken(token)) return null;
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/get_guest_pass`, {
    method: "POST",
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`get_guest_pass ${res.status}`);
  return (await res.json()) as GuestPass | null;
}
