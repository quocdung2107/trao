"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { invitationTag, isGuestToken } from "@/features/invitations/public";
import { createClient } from "@/lib/supabase/server";

/** Khách tự xóa toàn bộ thông tin của mình khỏi sự kiện. Không khôi phục được. */
export async function eraseMyData(token: string, _prev: unknown, formData: FormData): Promise<{ error?: string | null }> {
  if (!isGuestToken(token)) return { error: "Link không hợp lệ." };
  if (formData.get("confirm") !== "on") return { error: "Hãy đánh dấu ô xác nhận trước khi xóa." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("guest_erase", { p_token: token });
  if (error || !data) return { error: "Chưa xóa được. Link có thể đã hết hiệu lực, hoặc thông tin đã được xóa trước đó." };
  // Lời chúc của khách vừa bị xóa: làm mới trang thiệp có lời chúc đó.
  for (const slug of (data as { slugs?: string[] }).slugs ?? []) updateTag(invitationTag(slug));
  redirect("/rieng-tu/da-xoa");
}
