import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { EventRole } from "@/lib/labels";

/** Sự kiện + vai trò của người đang xem; null nếu không thấy hoặc đã xóa. */
export async function getEventForGuests(eventId: string, userId: string) {
  const supabase = await createClient();
  const [{ data: event }, { data: me }, { data: sessions }] = await Promise.all([
    supabase.from("events").select("id, title, event_type, settings, deleted_at").eq("id", eventId).maybeSingle(),
    supabase.from("event_members").select("role").eq("event_id", eventId).eq("user_id", userId).maybeSingle(),
    supabase.from("sessions").select("id, name, starts_at").eq("event_id", eventId).order("sort").order("created_at"),
  ]);
  if (!event || event.deleted_at) return null;
  return { event, myRole: me?.role as EventRole | undefined, sessions: sessions ?? [] };
}

export async function listGuests(eventId: string) {
  const supabase = await createClient();
  const [{ data: guests }, { data: groups }, { data: invitations }, { data: imports }] = await Promise.all([
    supabase
      .from("guests")
      .select(
        "id, display_name, salutation, phone_e164, side, max_party_size, token, invite_sent_at, notes, search_text, created_at, guest_group_links(group_id), session_invites(session_id, rsvp_status, attending_count)",
      )
      .eq("event_id", eventId)
      .is("deleted_at", null)
      .order("created_at")
      .limit(5000),
    supabase.from("guest_groups").select("id, name, color").eq("event_id", eventId).order("name"),
    supabase
      .from("invitations")
      .select("id, name, slug, session_ids, published_at")
      .eq("event_id", eventId)
      .not("published_at", "is", null)
      .order("created_at"),
    supabase
      .from("import_jobs")
      .select("id, file_name, created_rows, created_at")
      .eq("event_id", eventId)
      .is("undone_at", null)
      .gt("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
      .order("created_at", { ascending: false }),
  ]);
  return { guests: guests ?? [], groups: groups ?? [], invitations: invitations ?? [], recentImports: imports ?? [] };
}

export type GuestRow = Awaited<ReturnType<typeof listGuests>>["guests"][number];

export async function getGuest(guestId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("guests")
    .select(
      "id, event_id, display_name, salutation, phone_e164, email, side, max_party_size, notes, deleted_at, guest_group_links(group_id), session_invites(session_id, rsvp_status, attending_count, rsvp_note, responded_via, responded_at)",
    )
    .eq("id", guestId)
    .maybeSingle();
  return data && !data.deleted_at ? data : null;
}

export async function listGroups(eventId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("guest_groups").select("id, name").eq("event_id", eventId).order("name");
  return data ?? [];
}

/** SĐT của khách hiện có, để cảnh báo trùng khi nhập file. */
export async function listGuestPhones(eventId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("guests")
    .select("phone_e164")
    .eq("event_id", eventId)
    .is("deleted_at", null)
    .not("phone_e164", "is", null)
    .limit(5000);
  return (data ?? []).map((g) => g.phone_e164!);
}

export type EventStats = {
  guests: number;
  max_people: number;
  sent: number;
  wishes: number;
  sessions: { id: string; name: string; invited: number; yes: number; no: number; maybe: number; pending: number; attending: number;
    seated: number; to_seat: number; tables: number; arrived: number }[];
};

export async function getEventStats(eventId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("event_stats", { p_event_id: eventId });
  return (data as unknown as EventStats | null) ?? null;
}

export async function listWishes(eventId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("wishes")
    .select("id, author_name, message, status, created_at, guest_id, invitations(name)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(500);
  return data ?? [];
}

/** Khách đã xóa trong 30 ngày (sau đó bị xóa hẳn hằng đêm). */
export async function listTrashedGuests(eventId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("guests")
    .select("id, display_name, max_party_size, deleted_at")
    .eq("event_id", eventId)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .limit(2000);
  return data ?? [];
}

export async function countTrashedGuests(eventId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("guests")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .not("deleted_at", "is", null);
  return count ?? 0;
}
