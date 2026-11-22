"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { dbErrorMessage } from "@/features/events/errors";
import { normalizePhone } from "@/features/guests/normalize";
import { invitationTag, isGuestToken, type GuestView, type OpenRsvpStatus } from "@/features/invitations/public";
import { createClient } from "@/lib/supabase/server";

const slugSchema = z.string().regex(/^[A-Za-z0-9_-]{12}$/);

const rsvpInput = z.object({
  responses: z
    .array(z.object({ session_id: z.uuid(), status: z.enum(["yes", "no", "maybe"]), count: z.number().int().min(0).max(50) }))
    .min(1, "Hãy chọn câu trả lời"),
  note: z.string().max(500, "Lời nhắn tối đa 500 ký tự"),
  consentVersion: z.string().max(40).nullable(),
});

export async function submitRsvp(
  slug: string,
  token: string,
  input: z.input<typeof rsvpInput>,
): Promise<{ error?: string | null; guest?: GuestView }> {
  if (!slugSchema.safeParse(slug).success || !isGuestToken(token)) return { error: "Link mời không hợp lệ." };
  const parsed = rsvpInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_rsvp", {
    p_slug: slug,
    p_token: token,
    p_responses: parsed.data.responses,
    p_note: parsed.data.note.trim() || undefined,
    p_consent_version: parsed.data.consentVersion ?? undefined,
  });
  if (error || !data) return { error: dbErrorMessage(error, "Chưa gửi được. Vui lòng thử lại.") };
  return { guest: data as unknown as GuestView };
}

const wishInput = z.object({
  name: z.string().trim().min(1, "Hãy cho biết tên bạn").max(80),
  message: z.string().trim().min(1, "Hãy viết lời chúc").max(500, "Lời chúc tối đa 500 ký tự"),
});

export async function postWish(
  slug: string,
  token: string | null,
  input: z.input<typeof wishInput>,
): Promise<{ error?: string | null; ok?: boolean }> {
  if (!slugSchema.safeParse(slug).success) return { error: "Link không hợp lệ." };
  const parsed = wishInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.rpc("post_wish", {
    p_slug: slug,
    p_token: isGuestToken(token) ? token : undefined,
    p_name: parsed.data.name,
    p_message: parsed.data.message,
  });
  if (error) return { error: dbErrorMessage(error, "Chưa gửi được. Vui lòng thử lại.") };
  updateTag(invitationTag(slug));
  return { ok: true };
}

// ---------------------------------------------------------------- RSVP mở (link chung)

const openRsvpInput = z.object({
  name: z.string().trim().min(1, "Hãy cho biết tên bạn").max(150, "Tên tối đa 150 ký tự"),
  phone: z.string().max(30),
  partySize: z.number().int().min(1, "Số người ít nhất là 1").max(10, "Đông hơn 10 người, vui lòng báo trực tiếp chủ tiệc"),
  sessionIds: z.array(z.uuid("Buổi không hợp lệ, hãy tải lại thiệp")).min(1, "Hãy chọn buổi bạn sẽ đến").max(20),
  note: z.string().max(500, "Lời nhắn tối đa 500 ký tự"),
  consentVersion: z.string().min(1, "Hãy đánh dấu đồng ý ở ô bên dưới.").max(40),
});

/** Người có link chung xin tham dự. Chưa thành khách cho tới khi chủ tiệc duyệt. */
export async function submitOpenRsvp(
  slug: string,
  input: z.input<typeof openRsvpInput>,
): Promise<{ error?: string | null; token?: string }> {
  if (!slugSchema.safeParse(slug).success) return { error: "Link không hợp lệ." };
  const parsed = openRsvpInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const phone = normalizePhone(parsed.data.phone);
  if (phone === "invalid") return { error: "Số điện thoại chưa đúng. Có thể bỏ trống." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_open_rsvp", {
    p_slug: slug,
    p_name: parsed.data.name,
    p_party_size: parsed.data.partySize,
    p_session_ids: parsed.data.sessionIds,
    p_phone: phone ?? undefined,
    p_note: parsed.data.note.trim() || undefined,
    p_consent_version: parsed.data.consentVersion,
  });
  const token = (data as { token?: string } | null)?.token;
  if (error || !token) return { error: dbErrorMessage(error, "Chưa gửi được. Vui lòng thử lại.") };
  return { token };
}

/** Trạng thái đăng ký, đọc bằng token người đăng ký giữ trong trình duyệt. */
export async function getOpenRsvpStatus(slug: string, token: string): Promise<OpenRsvpStatus | null> {
  if (!slugSchema.safeParse(slug).success || !isGuestToken(token)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_open_rsvp", { p_slug: slug, p_token: token });
  return (data as unknown as OpenRsvpStatus | null) ?? null;
}
