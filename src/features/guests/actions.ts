"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/app/app/events/actions";
import { dbErrorMessage } from "@/features/events/errors";
import { createClient, getUserId } from "@/lib/supabase/server";
import { cleanText, normalizePhone, splitGroups } from "./normalize";

const uuid = z.uuid();

async function requireUser() {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  return userId;
}

// ---------------------------------------------------------------- thêm / sửa khách

const guestFields = z.object({
  displayName: z.string().min(1, "Hãy nhập tên khách").max(150),
  salutation: z.string().max(150),
  phone: z.string(),
  email: z.union([z.literal(""), z.email("Email chưa đúng").max(200)]),
  side: z.enum(["", "groom", "bride", "host"]),
  maxPartySize: z.coerce.number().int().min(1, "Số người tối thiểu là 1").max(50, "Tối đa 50 người"),
  notes: z.string().max(1000),
  groupIds: z.array(uuid),
  newGroups: z.array(z.string().min(1).max(60)),
  sessionIds: z.array(uuid),
});

function parseGuestForm(formData: FormData) {
  const parsed = guestFields.safeParse({
    displayName: cleanText(formData.get("displayName")),
    salutation: cleanText(formData.get("salutation")),
    phone: cleanText(formData.get("phone")),
    email: cleanText(formData.get("email")),
    side: formData.get("side") ?? "",
    maxPartySize: formData.get("maxPartySize") || 1,
    notes: String(formData.get("notes") ?? "").trim(),
    groupIds: formData.getAll("groups").map(String),
    newGroups: splitGroups(formData.get("newGroups")),
    sessionIds: formData.getAll("sessions").map(String),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message } as const;
  const phone = normalizePhone(parsed.data.phone);
  if (phone === "invalid") return { error: "Số điện thoại chưa đúng (vd 0912 345 678)." } as const;
  return { data: { ...parsed.data, phone } } as const;
}

type GuestInput = Extract<ReturnType<typeof parseGuestForm>, { data: unknown }>["data"];

/** Gắn nhóm (tạo nhóm mới nếu cần) và buổi được mời cho một khách: thêm cái thiếu, bỏ cái thừa. */
async function syncGuestLinks(eventId: string, guestId: string, input: GuestInput) {
  const supabase = await createClient();
  let groupIds = input.groupIds;
  if (input.newGroups.length) {
    const { error } = await supabase
      .from("guest_groups")
      .upsert(input.newGroups.map((name) => ({ event_id: eventId, name })), { onConflict: "event_id,name", ignoreDuplicates: true });
    if (error) return error;
    const { data } = await supabase.from("guest_groups").select("id").eq("event_id", eventId).in("name", input.newGroups);
    groupIds = [...new Set([...groupIds, ...(data ?? []).map((g) => g.id)])];
  }

  const del1 = supabase.from("guest_group_links").delete().eq("guest_id", guestId);
  const { error: e1 } = await (groupIds.length ? del1.not("group_id", "in", `(${groupIds.join(",")})`) : del1);
  if (e1) return e1;
  if (groupIds.length) {
    const { error } = await supabase
      .from("guest_group_links")
      .upsert(groupIds.map((group_id) => ({ event_id: eventId, guest_id: guestId, group_id })), { ignoreDuplicates: true });
    if (error) return error;
  }

  // Bỏ buổi = xóa cả câu trả lời RSVP của buổi đó.
  const del2 = supabase.from("session_invites").delete().eq("guest_id", guestId);
  const { error: e2 } = await (input.sessionIds.length ? del2.not("session_id", "in", `(${input.sessionIds.join(",")})`) : del2);
  if (e2) return e2;
  if (input.sessionIds.length) {
    const { error } = await supabase
      .from("session_invites")
      .upsert(
        input.sessionIds.map((session_id) => ({ event_id: eventId, guest_id: guestId, session_id })),
        { onConflict: "guest_id,session_id", ignoreDuplicates: true },
      );
    if (error) return error;
  }
  return null;
}

function guestColumns(d: GuestInput) {
  return {
    display_name: d.displayName,
    salutation: d.salutation || null,
    phone_e164: d.phone,
    email: d.email || null,
    side: d.side || null,
    max_party_size: d.maxPartySize,
    notes: d.notes || null,
  };
}

export async function createGuest(eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const id = uuid.parse(eventId);
  const parsed = parseGuestForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("guests")
    .insert({ event_id: id, ...guestColumns(parsed.data) })
    .select("id")
    .single();
  if (error || !data) return { error: dbErrorMessage(error) };
  const linkError = await syncGuestLinks(id, data.id, parsed.data);
  if (linkError) return { error: dbErrorMessage(linkError, "Đã lưu khách nhưng chưa gắn được nhóm/buổi. Hãy mở lại để sửa.") };

  if (formData.get("next") === "again") redirect(`/app/events/${id}/guests/new?added=${encodeURIComponent(parsed.data.displayName)}`);
  redirect(`/app/events/${id}/guests`);
}

export async function updateGuest(guestId: string, eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const id = uuid.parse(eventId);
  const parsed = parseGuestForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("guests")
    .update(guestColumns(parsed.data))
    .eq("id", uuid.parse(guestId))
    .eq("event_id", id)
    .select("id");
  if (error || !data?.length) return { error: dbErrorMessage(error, "Bạn không có quyền sửa khách này.") };
  const linkError = await syncGuestLinks(id, guestId, parsed.data);
  if (linkError) return { error: dbErrorMessage(linkError) };
  redirect(`/app/events/${id}/guests`);
}

export async function trashGuest(guestId: string, eventId: string, _prev: ActionState): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("guests")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", uuid.parse(guestId))
    .select("id");
  if (error || !data?.length) return { error: dbErrorMessage(error, "Bạn không có quyền xóa khách này.") };
  redirect(`/app/events/${uuid.parse(eventId)}/guests`);
}

// ---------------------------------------------------------------- gửi lời mời

export async function setInviteSent(guestId: string, sent: boolean): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("guests")
    .update({ invite_sent_at: sent ? new Date().toISOString() : null })
    .eq("id", uuid.parse(guestId))
    .select("id");
  if (error || !data?.length) return { error: dbErrorMessage(error, "Không cập nhật được.") };
  return { ok: true };
}

export async function saveInviteMessage(eventId: string, message: string): Promise<ActionState> {
  await requireUser();
  const text = z.string().trim().min(1, "Câu mời không được để trống").max(500, "Câu mời tối đa 500 ký tự").safeParse(message);
  if (!text.success) return { error: text.error.issues[0].message };
  const supabase = await createClient();
  const id = uuid.parse(eventId);
  const { data: ev } = await supabase.from("events").select("settings").eq("id", id).maybeSingle();
  if (!ev) return { error: "Không tìm thấy sự kiện." };
  const settings = { ...((ev.settings as Record<string, unknown>) ?? {}), inviteMessage: text.data };
  const { data, error } = await supabase.from("events").update({ settings }).eq("id", id).select("id");
  if (error || !data?.length) return { error: dbErrorMessage(error, "Bạn không có quyền sửa câu mời.") };
  return { ok: true };
}

// ---------------------------------------------------------------- nhóm

export async function deleteGroup(groupId: string, _prev: ActionState): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("guest_groups").delete().eq("id", uuid.parse(groupId)).select("id");
  if (error || !data?.length) return { error: dbErrorMessage(error, "Bạn không có quyền xóa nhóm này.") };
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- nhập file

const importRow = z.object({
  display_name: z.string().min(1).max(150),
  salutation: z.string().max(150).optional(),
  phone_e164: z.string().regex(/^\+[1-9]\d{7,14}$/).optional(),
  email: z.string().max(200).optional(),
  side: z.enum(["groom", "bride", "host"]).optional(),
  max_party_size: z.number().int().min(1).max(50).optional(),
  notes: z.string().max(1000).optional(),
  groups: z.array(z.string().min(1).max(60)).max(10).optional(),
});
const importInput = z.object({
  fileName: z.string().max(200),
  rows: z.array(importRow).min(1, "Không có dòng hợp lệ để nhập").max(3000, "Mỗi lần nhập tối đa 3000 dòng"),
  sessionIds: z.array(uuid).nullable(),
});

export async function importGuests(
  eventId: string,
  input: z.input<typeof importInput>,
): Promise<{ error?: string | null; created?: number }> {
  await requireUser();
  const parsed = importInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_guests", {
    p_event_id: uuid.parse(eventId),
    p_file_name: parsed.data.fileName,
    p_rows: parsed.data.rows,
    p_session_ids: parsed.data.sessionIds ?? undefined,
  });
  if (error || !data) return { error: dbErrorMessage(error, "Không nhập được. Hãy kiểm tra lại file.") };
  return { created: (data as { created: number }).created };
}

export async function undoImport(jobId: string, _prev: ActionState): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("undo_import", { p_job_id: uuid.parse(jobId) });
  if (error) return { error: dbErrorMessage(error) };
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- thùng rác

export async function restoreGuest(guestId: string, _prev: ActionState): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("guests")
    .update({ deleted_at: null })
    .eq("id", uuid.parse(guestId))
    .select("id");
  if (error || !data?.length) return { error: dbErrorMessage(error, "Bạn không có quyền khôi phục khách này.") };
  refresh();
  return { ok: true };
}
