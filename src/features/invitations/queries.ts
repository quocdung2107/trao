import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { EventRole } from "@/lib/labels";
import { parseContent } from "./content";

export async function listInvitations(eventId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invitations")
    .select("id, name, template_key, slug, published_at, updated_at")
    .eq("event_id", eventId)
    .order("created_at");
  return data ?? [];
}

export async function getInvitationForEdit(invitationId: string, userId: string) {
  const supabase = await createClient();
  const { data: inv } = await supabase
    .from("invitations")
    .select("id, event_id, name, template_key, slug, content, session_ids, published_at, updated_at")
    .eq("id", invitationId)
    .maybeSingle();
  if (!inv) return null;

  const [{ data: event }, { data: sessions }, { data: me }] = await Promise.all([
    supabase.from("events").select("id, title, event_type, deleted_at").eq("id", inv.event_id).maybeSingle(),
    supabase
      .from("sessions")
      .select("id, name, starts_at, ends_at, venue_name, address, map_url")
      .eq("event_id", inv.event_id)
      .order("sort")
      .order("starts_at", { nullsFirst: false })
      .order("created_at"),
    supabase.from("event_members").select("role").eq("event_id", inv.event_id).eq("user_id", userId).maybeSingle(),
  ]);
  if (!event || event.deleted_at) return null;

  return {
    invitation: { ...inv, content: parseContent(inv.content) },
    event,
    sessions: sessions ?? [],
    myRole: me?.role as EventRole | undefined,
  };
}
