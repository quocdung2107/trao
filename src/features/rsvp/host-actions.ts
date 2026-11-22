"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/app/app/events/actions";
import { dbErrorMessage } from "@/features/events/errors";
import { invitationTag } from "@/features/invitations/public";
import type { Json } from "@/lib/supabase/database.types";
import { createClient, getUserId } from "@/lib/supabase/server";

const uuid = z.uuid();

async function requireUser() {
  const userId = await getUserId();
  if (!userId) redirect("/login");
}

/** Hạn trả lời: hết ngày đã chọn theo giờ Việt Nam. Bỏ trống = không có hạn. */
export async function setRsvpDeadline(eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const raw = String(formData.get("deadline") ?? "");
  if (raw && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { error: "Ngày chưa đúng" };
  const supabase = await createClient();
  const id = uuid.parse(eventId);
  const { data: ev } = await supabase.from("events").select("settings").eq("id", id).maybeSingle();
  if (!ev) return { error: "Không tìm thấy sự kiện." };
  const settings: Record<string, Json | undefined> = { ...((ev.settings as Record<string, Json>) ?? {}) };
  if (raw) settings.rsvpDeadline = `${raw}T23:59:59+07:00`;
  else delete settings.rsvpDeadline;
  const { data, error } = await supabase.from("events").update({ settings }).eq("id", id).select("id");
  if (error || !data?.length) return { error: dbErrorMessage(error, "Bạn không có quyền đổi hạn trả lời.") };
  refresh();
  return { ok: true };
}

/** Chủ tiệc ghi câu trả lời thay khách (khách báo qua điện thoại, người lớn tuổi…). */
export async function setRsvpByHost(
  guestId: string,
  sessionId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const status = z.enum(["pending", "yes", "no", "maybe"]).safeParse(formData.get("status"));
  if (!status.success) return { error: "Câu trả lời không hợp lệ" };
  const count = z.coerce.number().int().min(0).max(50).catch(1).parse(formData.get("count"));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_invites")
    .update({
      rsvp_status: status.data,
      attending_count: status.data === "pending" ? null : status.data === "no" ? 0 : Math.max(count, 1),
      responded_at: status.data === "pending" ? null : new Date().toISOString(),
      responded_via: status.data === "pending" ? null : "host",
    })
    .eq("guest_id", uuid.parse(guestId))
    .eq("session_id", uuid.parse(sessionId))
    .select("id");
  if (error || !data?.length) return { error: dbErrorMessage(error, "Không cập nhật được.") };
  refresh();
  return { ok: true };
}

async function changeWish(wishId: string, change: "show" | "hide" | "delete"): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const q =
    change === "delete"
      ? supabase.from("wishes").delete()
      : supabase.from("wishes").update({ status: change === "hide" ? "hidden" : "visible" });
  const { data, error } = await q.eq("id", uuid.parse(wishId)).select("invitations(slug)");
  if (error || !data?.length) return { error: dbErrorMessage(error, "Bạn không có quyền sửa lời chúc này.") };
  const slug = data[0].invitations?.slug;
  if (slug) updateTag(invitationTag(slug));
  refresh();
  return { ok: true };
}

export async function hideWish(wishId: string, _prev: ActionState) {
  return changeWish(wishId, "hide");
}
export async function showWish(wishId: string, _prev: ActionState) {
  return changeWish(wishId, "show");
}
export async function deleteWish(wishId: string, _prev: ActionState) {
  return changeWish(wishId, "delete");
}

// ---------------------------------------------------------------- RSVP mở: bật/tắt, duyệt, từ chối

/** Bật/tắt đăng ký tham dự qua link chung. Làm mới cache mọi thiệp của sự kiện để form hiện/ẩn ngay. */
export async function setOpenRsvp(eventId: string, open: boolean, _prev: ActionState): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const id = uuid.parse(eventId);
  const { data: ev } = await supabase.from("events").select("settings, event_type").eq("id", id).maybeSingle();
  if (!ev) return { error: "Không tìm thấy sự kiện." };
  if (ev.event_type === "greeting") return { error: "Thiệp Lời chúc không có đăng ký tham dự." };
  const settings: Record<string, Json | undefined> = { ...((ev.settings as Record<string, Json>) ?? {}), openRsvp: open };
  const { data, error } = await supabase.from("events").update({ settings }).eq("id", id).select("id");
  if (error || !data?.length) return { error: dbErrorMessage(error, "Bạn không có quyền đổi cài đặt này.") };
  const { data: invs } = await supabase.from("invitations").select("slug").eq("event_id", id);
  for (const inv of invs ?? []) updateTag(invitationTag(inv.slug));
  refresh();
  return { ok: true };
}

/** Duyệt thành khách mới, hoặc gộp vào khách sẵn có khi là cùng một người. */
export async function approveRsvpRequest(requestId: string, mergeGuestId: string | null, _prev: ActionState): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_rsvp_request", {
    p_request_id: uuid.parse(requestId),
    p_merge_guest_id: mergeGuestId ? uuid.parse(mergeGuestId) : undefined,
  });
  if (error) return { error: dbErrorMessage(error, "Chưa duyệt được.") };
  refresh();
  return { ok: true };
}

export async function rejectRsvpRequest(requestId: string, _prev: ActionState): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_rsvp_request", { p_request_id: uuid.parse(requestId) });
  if (error) return { error: dbErrorMessage(error, "Chưa từ chối được.") };
  refresh();
  return { ok: true };
}
