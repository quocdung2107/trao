"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient, getUserId } from "@/lib/supabase/server";
import { EVENT_TYPES } from "@/lib/labels";
import { dbErrorMessage } from "@/features/events/errors";
import { localVnToIso } from "@/features/events/format";
import { getPersonalWorkspaceId } from "@/features/events/queries";

export type ActionState = { error?: string | null; ok?: boolean };

const uuid = z.uuid();

async function requireUser() {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  return userId;
}

// ---------------------------------------------------------------- sự kiện

const createEventSchema = z.object({
  title: z.string().trim().min(1, "Hãy đặt tên sự kiện").max(200),
  eventType: z.enum(Object.keys(EVENT_TYPES) as [keyof typeof EVENT_TYPES]),
  firstSession: z.string().trim().max(100).optional(),
});

export async function createEvent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await requireUser();
  const parsed = createEventSchema.safeParse({
    title: formData.get("title"),
    eventType: formData.get("eventType"),
    firstSession: formData.get("firstSession") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const workspaceId = await getPersonalWorkspaceId(userId);
  if (!workspaceId) return { error: "Không tìm thấy không gian làm việc của bạn." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_event", {
    p_workspace_id: workspaceId,
    p_title: parsed.data.title,
    p_event_type: parsed.data.eventType,
    p_first_session_name: parsed.data.firstSession || undefined,
  });
  if (error || !data) return { error: dbErrorMessage(error) };
  redirect(`/app/events/${data}`);
}

export async function updateEventTitle(eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const title = z.string().trim().min(1, "Tên không được để trống").max(200).safeParse(formData.get("title"));
  if (!title.success) return { error: title.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .update({ title: title.data })
    .eq("id", uuid.parse(eventId))
    .select("id");
  if (error || !data?.length) return { error: dbErrorMessage(error, "Bạn không có quyền sửa sự kiện này.") };
  refresh();
  return { ok: true };
}

export async function trashEvent(eventId: string, _prev: ActionState): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("trash_event", { p_event_id: uuid.parse(eventId) });
  if (error) return { error: dbErrorMessage(error) };
  redirect("/app");
}

export async function restoreEvent(eventId: string, _prev: ActionState): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_event", { p_event_id: uuid.parse(eventId) });
  if (error) return { error: dbErrorMessage(error) };
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- buổi tiệc

const sessionSchema = z.object({
  name: z.string().trim().min(1, "Hãy đặt tên buổi tiệc").max(100),
  startsAt: z.string().optional(),
  venueName: z.string().trim().max(200).optional(),
  address: z.string().trim().max(500).optional(),
});

export async function addSession(eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = sessionSchema.safeParse({
    name: formData.get("name"),
    startsAt: formData.get("startsAt") || undefined,
    venueName: formData.get("venueName") || undefined,
    address: formData.get("address") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("sessions").insert({
    event_id: uuid.parse(eventId),
    name: parsed.data.name,
    starts_at: localVnToIso(parsed.data.startsAt),
    venue_name: parsed.data.venueName || null,
    address: parsed.data.address || null,
  });
  if (error) return { error: dbErrorMessage(error) };
  refresh();
  return { ok: true };
}

export async function deleteSession(sessionId: string, _prev: ActionState): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("sessions").delete().eq("id", uuid.parse(sessionId)).select("id");
  if (error || !data?.length) return { error: dbErrorMessage(error, "Bạn không có quyền xóa buổi tiệc này.") };
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- thành viên & lời mời

const inviteRole = z.enum(["cohost", "staff", "viewer"]);
const memberRole = z.enum(["owner", "cohost", "staff", "viewer"]);

export async function createInvite(eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const role = inviteRole.safeParse(formData.get("role"));
  if (!role.success) return { error: "Vai trò không hợp lệ" };
  const note = z.string().trim().max(200).optional().parse(formData.get("note") || undefined);

  const supabase = await createClient();
  const { error } = await supabase
    .from("event_invites")
    .insert({ event_id: uuid.parse(eventId), role: role.data, note: note || null });
  if (error) return { error: dbErrorMessage(error) };
  refresh();
  return { ok: true };
}

export async function revokeInvite(inviteId: string, _prev: ActionState): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", uuid.parse(inviteId));
  if (error) return { error: dbErrorMessage(error) };
  refresh();
  return { ok: true };
}

export async function changeMemberRole(
  eventId: string,
  memberId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const role = memberRole.safeParse(formData.get("role"));
  if (!role.success) return { error: "Vai trò không hợp lệ" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_members")
    .update({ role: role.data })
    .eq("event_id", uuid.parse(eventId))
    .eq("user_id", uuid.parse(memberId))
    .select("user_id");
  if (error || !data?.length) return { error: dbErrorMessage(error, "Bạn không có quyền đổi vai trò.") };
  refresh();
  return { ok: true };
}

export async function removeMember(eventId: string, memberId: string, _prev: ActionState): Promise<ActionState> {
  const userId = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_members")
    .delete()
    .eq("event_id", uuid.parse(eventId))
    .eq("user_id", uuid.parse(memberId))
    .select("user_id");
  if (error || !data?.length) return { error: dbErrorMessage(error, "Bạn không có quyền xóa thành viên này.") };
  if (memberId === userId) redirect("/app");
  refresh();
  return { ok: true };
}

export async function acceptInvite(token: string, _prev: ActionState): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_event_invite", { p_token: token });
  if (error || !data) return { error: dbErrorMessage(error) };
  redirect(`/app/events/${data}`);
}
