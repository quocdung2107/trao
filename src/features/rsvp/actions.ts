"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { dbErrorMessage } from "@/features/events/errors";
import { invitationTag, isGuestToken, type GuestView } from "@/features/invitations/public";
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
