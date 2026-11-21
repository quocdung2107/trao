import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, Input, Select } from "@/components/ui";
import { setRsvpByHost } from "@/features/rsvp/host-actions";
import { RSVP_STATUS } from "@/lib/labels";
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
      {guest.session_invites.length > 0 && (
        <Card className="mt-6">
          <h2 className="font-serif text-lg">Câu trả lời</h2>
          <p className="text-sm text-muted">Khách báo qua điện thoại? Bạn ghi lại thay khách ở đây.</p>
          <ul className="mt-3 divide-y divide-border">
            {guest.session_invites.map((si) => {
              const session = ctx.sessions.find((s) => s.id === si.session_id);
              return (
                <li key={si.session_id} className="py-3">
                  <p className="text-sm font-medium">{session?.name}</p>
                  {si.rsvp_note && <p className="mt-1 text-sm italic text-muted">“{si.rsvp_note}”</p>}
                  <ActionForm action={setRsvpByHost.bind(null, guest.id, si.session_id)} className="mt-2 flex flex-wrap items-end gap-2">
                    <Select name="status" defaultValue={si.rsvp_status} aria-label={`Trả lời cho ${session?.name}`} className="w-auto">
                      {Object.entries(RSVP_STATUS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </Select>
                    <Input
                      name="count"
                      type="number"
                      min={1}
                      max={50}
                      defaultValue={si.attending_count || guest.max_party_size}
                      aria-label="Số người"
                      className="w-20"
                    />
                    <SubmitButton className="rounded-lg border border-border px-3 py-2.5 text-sm font-semibold" pendingText="…">
                      Lưu
                    </SubmitButton>
                  </ActionForm>
                  {si.responded_via && (
                    <p className="mt-1 text-xs text-muted">{si.responded_via === "guest" ? "Khách tự trả lời" : "Bạn ghi thay khách"}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
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
