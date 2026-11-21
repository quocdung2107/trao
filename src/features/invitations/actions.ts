"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dbErrorMessage } from "@/features/events/errors";
import type { EventType } from "@/lib/labels";
import { createClient, getUserId } from "@/lib/supabase/server";
import { defaultContent, invitationContentSchema, type InvitationContent } from "./content";
import { invitationTag } from "./public";
import { DEFAULT_TEMPLATE, isTemplateKey } from "./templates/registry";

type State = { error?: string | null; ok?: boolean };
const uuid = z.uuid();

async function requireUser() {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  return userId;
}

export async function createInvitation(eventId: string, _prev: State, formData: FormData): Promise<State> {
  await requireUser();
  const supabase = await createClient();
  const id = uuid.parse(eventId);
  const templateKey = String(formData.get("templateKey") ?? DEFAULT_TEMPLATE);
  if (!isTemplateKey(templateKey)) return { error: "Mẫu thiệp không hợp lệ" };
  const name = z.string().trim().min(1).max(100).catch("Thiệp chính").parse(formData.get("name"));

  const { data: event } = await supabase.from("events").select("title, event_type").eq("id", id).maybeSingle();
  if (!event) return { error: "Không tìm thấy sự kiện" };

  const { data, error } = await supabase
    .from("invitations")
    .insert({
      event_id: id,
      name,
      template_key: templateKey,
      content: defaultContent(event.event_type as EventType, event.title),
    })
    .select("id")
    .single();
  if (error || !data) return { error: dbErrorMessage(error) };
  redirect(`/app/events/${id}/invitations/${data.id}`);
}

const saveSchema = z.object({
  name: z.string().trim().min(1, "Tên thiệp không được để trống").max(100),
  templateKey: z.string().refine(isTemplateKey, "Mẫu thiệp không hợp lệ"),
  content: invitationContentSchema,
  sessionIds: z.array(z.uuid()).nullable(),
});

export type SaveInvitationInput = {
  name: string;
  templateKey: string;
  content: InvitationContent;
  sessionIds: string[] | null;
};

export async function saveInvitation(invitationId: string, input: SaveInvitationInput): Promise<State> {
  await requireUser();
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("invitations")
    .select("event_id")
    .eq("id", uuid.parse(invitationId))
    .maybeSingle();
  if (!current) return { error: "Không tìm thấy thiệp" };

  // Ảnh phải nằm trong thư mục của chính sự kiện này.
  const { content } = parsed.data;
  const paths = [content.coverImage, ...content.gallery].filter(Boolean) as string[];
  if (paths.some((p) => !p.startsWith(`${current.event_id}/`))) return { error: "Ảnh không thuộc sự kiện này" };

  const { data, error } = await supabase
    .from("invitations")
    .update({
      name: parsed.data.name,
      template_key: parsed.data.templateKey,
      content,
      session_ids: parsed.data.sessionIds?.length ? parsed.data.sessionIds : null,
    })
    .eq("id", invitationId)
    .select("slug");
  if (error || !data?.length) return { error: dbErrorMessage(error, "Bạn không có quyền sửa thiệp này.") };
  updateTag(invitationTag(data[0].slug));
  return { ok: true };
}

export async function setInvitationPublished(invitationId: string, publish: boolean): Promise<State> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invitations")
    .update({ published_at: publish ? new Date().toISOString() : null })
    .eq("id", uuid.parse(invitationId))
    .select("slug");
  if (error || !data?.length) return { error: dbErrorMessage(error, "Bạn không có quyền xuất bản thiệp này.") };
  updateTag(invitationTag(data[0].slug));
  refresh();
  return { ok: true };
}

export async function deleteInvitation(invitationId: string, eventId: string, _prev: State): Promise<State> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invitations")
    .delete()
    .eq("id", uuid.parse(invitationId))
    .select("slug");
  if (error || !data?.length) return { error: dbErrorMessage(error, "Bạn không có quyền xóa thiệp này.") };
  updateTag(invitationTag(data[0].slug));
  redirect(`/app/events/${uuid.parse(eventId)}`);
}
