import "server-only";
import { isGuestToken } from "@/features/invitations/public";
import type { RsvpStatus } from "@/lib/labels";

export type GuestPrivacyView = {
  event_title: string;
  name: string;
  has_phone: boolean;
  has_email: boolean;
  consented_at: string | null;
  wishes: number;
  sessions: { name: string; rsvp: RsvpStatus; attending: number | null; note: boolean }[];
};

/** Dữ liệu TRAO đang giữ về một khách, theo token cá nhân (không cache). */
export async function getGuestPrivacyView(token: string): Promise<GuestPrivacyView | null> {
  if (!isGuestToken(token)) return null;
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/guest_privacy_view`, {
    method: "POST",
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`guest_privacy_view ${res.status}`);
  return (await res.json()) as GuestPrivacyView | null;
}
