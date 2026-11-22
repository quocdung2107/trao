import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { deleteGroup, undoImport } from "@/features/guests/actions";
import { GuestList } from "@/features/guests/guest-list";
import { countPendingRequests, countTrashedGuests, getEventForGuests, listGuests } from "@/features/guests/queries";
import { hasParty } from "@/lib/labels";
import { siteUrl } from "@/lib/site-url";
import { getUserId } from "@/lib/supabase/server";
import { Input } from "@/components/ui";
import { setRsvpDeadline } from "@/features/rsvp/host-actions";

export const metadata: Metadata = { title: "Khách mời" };

const primaryBtn = "rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong";
const ghostBtn = "rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold";

async function Guests({ params }: { params: PageProps<"/app/events/[id]/guests">["params"] }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) redirect(`/login?next=/app/events/${id}/guests`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await getEventForGuests(id, userId);
  if (!ctx) notFound();
  if (ctx.myRole !== "owner" && ctx.myRole !== "cohost") redirect(`/app/events/${id}`);

  const [{ guests, groups, invitations, recentImports }, base, trashed, requests] = await Promise.all([
    listGuests(id),
    siteUrl(),
    countTrashedGuests(id),
    countPendingRequests(id),
  ]);
  const party = hasParty(ctx.event.event_type);
  const people = guests.reduce((n, g) => n + g.max_party_size, 0);
  const settings = (ctx.event.settings ?? {}) as { inviteMessage?: string; rsvpDeadline?: string; openRsvp?: boolean };
  const deadline = settings.rsvpDeadline ? settings.rsvpDeadline.slice(0, 10) : "";

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/app/events/${id}`} className="text-sm text-muted">
          ← {ctx.event.title}
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl">{party ? "Khách mời" : "Người nhận"}</h1>
            <p className="text-sm text-muted">
              {guests.length} khách · tối đa {people} người
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {guests.length > 0 && (
              <a href={`/app/events/${id}/export`} className={ghostBtn}>
                Xuất Excel
              </a>
            )}
            <Link href={`/app/events/${id}/guests/import`} className={ghostBtn}>
              Nhập từ Excel
            </Link>
            <Link href={`/app/events/${id}/guests/new`} className={primaryBtn}>
              + Thêm khách
            </Link>
          </div>
        </div>
      </div>

      {party && (
        <Link
          href={`/app/events/${id}/guests/requests`}
          className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${
            requests > 0 ? "border-accent/40 bg-accent/10" : "border-border bg-surface"
          }`}
        >
          <span>
            {requests > 0 ? (
              <>
                <b>Chờ duyệt ({requests})</b> · người đăng ký qua link chung
              </>
            ) : settings.openRsvp ? (
              "Đăng ký qua link chung đang bật · chưa có ai chờ duyệt"
            ) : (
              "Gửi một link chung vào nhóm? Bật đăng ký qua link chung"
            )}
          </span>
          <span className="font-semibold text-brand">{requests > 0 ? "Duyệt →" : "Mở →"}</span>
        </Link>
      )}

      {recentImports.map((job) => (
        <ActionForm
          key={job.id}
          action={undoImport.bind(null, job.id)}
          confirm={`Hoàn tác lần nhập “${job.file_name}”? ${job.created_rows} khách sẽ bị xóa khỏi danh sách.`}
          className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        >
          <span className="flex-1">
            Đã nhập {job.created_rows} khách từ <b>{job.file_name}</b>
          </span>
          <SubmitButton className="font-medium text-danger" pendingText="Đang hoàn tác…">
            Hoàn tác
          </SubmitButton>
        </ActionForm>
      ))}

      {guests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="font-medium">Chưa có khách nào</p>
          <p className="mt-1 text-sm text-muted">Nhập từ file Excel có sẵn, hoặc thêm từng khách.</p>
        </div>
      ) : (
        <GuestList
          eventId={id}
          eventTitle={ctx.event.title}
          baseUrl={base}
          guests={guests}
          groups={groups}
          sessions={ctx.sessions}
          invitations={invitations}
          inviteMessage={settings.inviteMessage ?? null}
        />
      )}

      {party && (
      <ActionForm action={setRsvpDeadline.bind(null, id)} className="flex flex-wrap items-end gap-2 text-sm">
        <label>
          <span className="mb-1 block font-medium">Hạn trả lời</span>
          <Input type="date" name="deadline" defaultValue={deadline} className="w-auto" />
        </label>
        <SubmitButton className={ghostBtn} pendingText="Đang lưu…">
          Lưu hạn
        </SubmitButton>
        <span className="pb-2.5 text-xs text-muted">{deadline ? "Sau ngày này khách không tự sửa câu trả lời được." : "Chưa đặt hạn."}</span>
      </ActionForm>
      )}

      {trashed > 0 && (
        <Link href={`/app/events/${id}/guests/trash`} className="block text-sm text-muted underline">
          Thùng rác ({trashed} khách đã xóa)
        </Link>
      )}

      {groups.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">Quản lý nhóm ({groups.length})</summary>
          <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-surface">
            {groups.map((g) => (
              <li key={g.id} className="flex items-center gap-2 px-3 py-2">
                <span className="flex-1">{g.name}</span>
                <ActionForm action={deleteGroup.bind(null, g.id)} confirm={`Xóa nhóm “${g.name}”? Khách trong nhóm vẫn giữ nguyên.`}>
                  <SubmitButton className="text-danger">Xóa</SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export default function GuestsPage(props: PageProps<"/app/events/[id]/guests">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Đang tải…</p>}>
      <Guests params={props.params} />
    </Suspense>
  );
}
