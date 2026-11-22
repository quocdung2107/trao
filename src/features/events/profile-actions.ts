"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/app/app/events/actions";
import { dbErrorMessage } from "./errors";
import { createClient, getUserId } from "@/lib/supabase/server";

/** Tên hiển thị: hiện cho người cùng quản lý sự kiện (vd "check-in bởi Lan"). */
export async function updateDisplayName(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  const name = String(formData.get("displayName") ?? "").replace(/\s+/g, " ").trim();
  if (!name) return { error: "Hãy nhập tên." };
  if (name.length > 100) return { error: "Tên tối đa 100 ký tự." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ display_name: name }).eq("id", userId);
  if (error) return { error: dbErrorMessage(error) };
  refresh();
  return { ok: true };
}
