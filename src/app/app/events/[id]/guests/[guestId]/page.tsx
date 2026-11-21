import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card } from "@/components/ui";
import { trashGuest, updateGuest } from "@/features/guests/actions";
import { GuestForm } from "@/features/guests/guest-form";
import { getEventForGuests, getGuest, listGroups } from "@/features/guests/queries";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sửa khách" };

const UUID = /^[0-9a-f-]{36}$/i;

async function EditGuest({ params }: { params: PageProps<"/app/events/[id]/guests/[guestId]">["params"] }) {
  const { id, guestId } = await params;
  const userId = await getUserId();
  if (!userId) redirect(`/login?next=/app/events/${id}/guests/${guestId}`);
  if (!UUID.test(id) || !UUID.test(guestId)) notFound();
  const [ctx, guest, groups] = await Promise.all([getEventForGuests(id, userId), getGuest(guestId), listGroups(id)]);
  if (!ctx || !guest || guest.event_id !== id) notFound();

  return (
    <div className="mx-auto max-w-lg">
      <Link href={`/app/events/${id}/guests`} className="text-sm text-muted">
        ← Khách mời
      </Link>
      <h1 className="mt-2 mb-4 font-serif text-2xl">{guest.display_name}</h1>
      <Card>
        <GuestForm
          action={updateGuest.bind(null, guest.id, id)}
          groups={groups}
          sessions={ctx.sessions}
          isWedding={ctx.event.event_type === "wedding"}
          defaults={{
            ...guest,
            groupIds: guest.guest_group_links.map((l) => l.group_id),
            sessionIds: guest.session_invites.map((s) => s.session_id),
          }}
          submitLabel="Lưu thay đổi"
        />
      </Card>
      <ActionForm action={trashGuest.bind(null, guest.id, id)} confirm={`Xóa ${guest.display_name} khỏi danh sách khách?`} className="mt-6">
        <SubmitButton className="text-sm text-danger">Xóa khách này</SubmitButton>
      </ActionForm>
    </div>
  );
}

export default function EditGuestPage(props: PageProps<"/app/events/[id]/guests/[guestId]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Đang tải…</p>}>
      <EditGuest params={props.params} />
    </Suspense>
  );
}
