import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { parseContent } from "./content";
import type { InvitationSession, InvitationView } from "./view";

export const invitationTag = (slug: string) => `inv:${slug}`;

export type PublicInvitation = InvitationView & { slug: string; template_key: string; updated_at: string };

/** Thiệp đã xuất bản, đọc bằng khóa publishable (không cookie) nên cache được; xóa cache khi chủ tiệc lưu. */
export async function getPublishedInvitation(slug: string): Promise<PublicInvitation | null> {
  "use cache";
  cacheTag(invitationTag(slug));
  cacheLife("hours");

  if (!/^[A-Za-z0-9_-]{12}$/.test(slug)) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const res = await fetch(`${url}/rest/v1/rpc/get_invitation`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ p_slug: slug }),
  });
  if (!res.ok) throw new Error(`get_invitation ${res.status}`);
  const data = (await res.json()) as null | {
    slug: string;
    template_key: string;
    updated_at: string;
    content: unknown;
    event: { title: string; event_type: string };
    sessions: InvitationSession[];
  };
  if (!data) return null;
  return { ...data, content: parseContent(data.content) };
}
