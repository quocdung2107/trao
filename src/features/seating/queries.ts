import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Dữ liệu màn xếp bàn của một buổi: bàn, chỗ đã xếp, khách được mời buổi đó. */
export async function getSeating(eventId: string, sessionId: string) {
  const supabase = await createClient();
  const [{ data: tables }, { data: seats }, { data: invites }, { data: groups }] = await Promise.all([
    supabase
      .from("tables")
      .select("id, label, capacity, zone, sort, created_at")
      .eq("session_id", sessionId)
      .order("sort")
      .order("created_at"),
    supabase.from("seat_assignments").select("session_invite_id, table_id, seats").eq("session_id", sessionId).limit(10000),
    supabase
      .from("session_invites")
      .select(
        "id, rsvp_status, attending_count, guests!inner(id, display_name, salutation, side, max_party_size, search_text, deleted_at, guest_group_links(group_id))",
      )
      .eq("session_id", sessionId)
      .is("guests.deleted_at", null)
      .limit(10000),
    supabase.from("guest_groups").select("id, name").eq("event_id", eventId).order("name"),
  ]);

  const parties = (invites ?? []).map((i) => {
    const g = i.guests;
    return {
      inviteId: i.id,
      guestId: g.id,
      name: g.display_name,
      side: g.side,
      search: g.search_text ?? "",
      groupIds: g.guest_group_links.map((l) => l.group_id),
      rsvp: i.rsvp_status as "pending" | "yes" | "no" | "maybe",
      needed: i.rsvp_status === "yes" && (i.attending_count ?? 0) > 0 ? i.attending_count! : g.max_party_size,
    };
  });
  parties.sort((a, b) => a.name.localeCompare(b.name, "vi"));

  return {
    tables: tables ?? [],
    seats: seats ?? [],
    parties,
    groups: groups ?? [],
  };
}

export type SeatingData = Awaited<ReturnType<typeof getSeating>>;
export type Party = SeatingData["parties"][number];

/** Nhật ký thay đổi của sự kiện, mới nhất trước. */
export async function listAudit(eventId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("id, action, before, after, actor_id, created_at")
    .eq("event_id", eventId)
    .order("id", { ascending: false })
    .limit(300);
  const rows = data ?? [];
  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter((x): x is string => !!x))];
  const { data: people } = actorIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", actorIds)
    : { data: [] };
  const names = new Map((people ?? []).map((p) => [p.id, p.display_name]));
  return rows.map((r) => ({ ...r, actor: r.actor_id ? (names.get(r.actor_id) ?? "Người quản lý") : "Hệ thống" }));
}
