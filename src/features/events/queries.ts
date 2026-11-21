import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { EventRole } from "@/lib/labels";

export async function listMyEvents(userId: string) {
  const supabase = await createClient();
  const [{ data: events }, { data: roles }] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, event_type, status, created_at, deleted_at")
      .order("created_at", { ascending: false }),
    supabase.from("event_members").select("event_id, role").eq("user_id", userId),
  ]);
  const roleByEvent = new Map((roles ?? []).map((r) => [r.event_id, r.role as EventRole]));
  const all = (events ?? []).map((e) => ({ ...e, role: roleByEvent.get(e.id) }));
  return { active: all.filter((e) => !e.deleted_at), trashed: all.filter((e) => e.deleted_at) };
}

export async function getPersonalWorkspaceId(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces(kind)")
    .eq("user_id", userId);
  const personal = data?.find((m) => m.workspaces?.kind === "personal") ?? data?.[0];
  return personal?.workspace_id ?? null;
}

export async function getEventDetail(eventId: string, userId: string) {
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, title, event_type, status, deleted_at, created_at")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return null;

  const [{ data: sessions }, { data: members }] = await Promise.all([
    supabase.from("sessions").select("*").eq("event_id", eventId).order("sort").order("created_at"),
    supabase.from("event_members").select("user_id, role, created_at").eq("event_id", eventId).order("created_at"),
  ]);

  const userIds = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", userIds)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  const myRole = (members ?? []).find((m) => m.user_id === userId)?.role as EventRole | undefined;

  // RLS chỉ cho owner đọc lời mời; vai trò khác nhận danh sách rỗng.
  const { data: invites } =
    myRole === "owner"
      ? await supabase
          .from("event_invites")
          .select("id, role, token, note, expires_at, created_at")
          .eq("event_id", eventId)
          .is("accepted_at", null)
          .is("revoked_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
      : { data: [] };

  return {
    event,
    myRole,
    sessions: sessions ?? [],
    members: (members ?? []).map((m) => ({
      ...m,
      role: m.role as EventRole,
      name: nameById.get(m.user_id) ?? "Thành viên",
      isMe: m.user_id === userId,
    })),
    invites: invites ?? [],
  };
}
