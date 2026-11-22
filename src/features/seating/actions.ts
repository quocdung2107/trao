"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/app/app/events/actions";
import { dbErrorMessage } from "@/features/events/errors";
import { createClient, getUserId } from "@/lib/supabase/server";

const uuid = z.uuid();

async function requireUser() {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  return userId;
}

function tableError(error: Parameters<typeof dbErrorMessage>[0]) {
  if (error?.code === "23505") return "Tên bàn này đã có trong buổi tiệc.";
  return dbErrorMessage(error);
}

// ---------------------------------------------------------------- bàn

const quickSchema = z.object({
  count: z.coerce.number().int().min(1, "Ít nhất 1 bàn").max(200, "Tối đa 200 bàn một lần"),
  capacity: z.coerce.number().int().min(1, "Mỗi bàn ít nhất 1 chỗ").max(100, "Tối đa 100 chỗ một bàn"),
  prefix: z.string().trim().min(1).max(30),
  zone: z.string().trim().max(60),
});

/** Tạo nhanh N bàn, đánh số nối tiếp các bàn cùng tiền tố đã có ("Bàn 1" … "Bàn 30"). */
export async function createTables(eventId: string, sessionId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  if (!uuid.safeParse(eventId).success || !uuid.safeParse(sessionId).success) return { error: "Buổi tiệc không hợp lệ." };
  const parsed = quickSchema.safeParse({
    count: formData.get("count"),
    capacity: formData.get("capacity"),
    prefix: formData.get("prefix") || "Bàn",
    zone: formData.get("zone") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { count, capacity, prefix, zone } = parsed.data;

  const supabase = await createClient();
  const { data: existing } = await supabase.from("tables").select("label, sort").eq("session_id", sessionId);
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(\\d+)$`);
  const maxNo = Math.max(0, ...(existing ?? []).map((t) => Number(re.exec(t.label)?.[1] ?? 0)));
  const maxSort = Math.max(0, ...(existing ?? []).map((t) => t.sort));
  const rows = Array.from({ length: count }, (_, i) => ({
    event_id: eventId,
    session_id: sessionId,
    label: `${prefix} ${maxNo + i + 1}`,
    capacity,
    zone: zone || null,
    sort: maxSort + i + 1,
  }));
  const { error } = await supabase.from("tables").insert(rows);
  if (error) return { error: tableError(error) };
  refresh();
  return { ok: true };
}

const tableSchema = z.object({
  label: z.string().trim().min(1, "Hãy đặt tên bàn").max(40),
  capacity: z.coerce.number().int().min(1, "Ít nhất 1 chỗ").max(100, "Tối đa 100 chỗ"),
  zone: z.string().trim().max(60),
});

export async function updateTable(tableId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  if (!uuid.safeParse(tableId).success) return { error: "Bàn không hợp lệ." };
  const parsed = tableSchema.safeParse({
    label: formData.get("label"),
    capacity: formData.get("capacity"),
    zone: formData.get("zone") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase
    .from("tables")
    .update({ label: parsed.data.label, capacity: parsed.data.capacity, zone: parsed.data.zone || null })
    .eq("id", tableId);
  if (error) return { error: tableError(error) };
  refresh();
  return { ok: true };
}

export async function deleteTable(tableId: string): Promise<ActionState> {
  await requireUser();
  if (!uuid.safeParse(tableId).success) return { error: "Bàn không hợp lệ." };
  const supabase = await createClient();
  const { error } = await supabase.from("tables").delete().eq("id", tableId);
  if (error) return { error: dbErrorMessage(error) };
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- xếp chỗ

export type AssignResult =
  | { ok: true; label: string; over: number }
  | { ok: false; reason: "over_capacity"; label: string; capacity: number; used: number; needed: number }
  | { ok: false; reason: "error"; error: string };

export async function assignSeats(tableId: string, inviteIds: string[], allowOver = false): Promise<AssignResult> {
  await requireUser();
  const ids = z.array(uuid).min(1).max(500).safeParse(inviteIds);
  if (!uuid.safeParse(tableId).success || !ids.success) return { ok: false, reason: "error", error: "Hãy chọn khách cần xếp." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("assign_seats", {
    p_table_id: tableId,
    p_invite_ids: ids.data,
    p_allow_over: allowOver,
  });
  if (error) return { ok: false, reason: "error", error: dbErrorMessage(error)! };
  const res = data as unknown as AssignResult;
  if (res.ok) refresh();
  return res;
}

export async function unassignSeats(inviteIds: string[]): Promise<{ error?: string }> {
  await requireUser();
  const ids = z.array(uuid).min(1).max(500).safeParse(inviteIds);
  if (!ids.success) return { error: "Hãy chọn khách." };
  const supabase = await createClient();
  const { error } = await supabase.from("seat_assignments").delete().in("session_invite_id", ids.data);
  if (error) return { error: dbErrorMessage(error)! };
  refresh();
  return {};
}
