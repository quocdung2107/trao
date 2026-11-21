import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { deleteGroup, undoImport } from "@/features/guests/actions";
import { GuestList } from "@/features/guests/guest-list";
import { getEventForGuests, listGuests } from "@/features/guests/queries";
import { siteUrl } from "@/lib/site-url";
import { getUserId } from "@/lib/supabase/server";

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

  const [{ guests, groups, invitations, recentImports }, base] = await Promise.all([listGuests(id), siteUrl()]);
  const people = guests.reduce((n, g) => n + g.max_party_size, 0);
  const settings = (ctx.event.settings ?? {}) as { inviteMessage?: string };

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/app/events/${id}`} className="text-sm text-muted">
          ← {ctx.event.title}
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl">Khách mời</h1>
            <p className="text-sm text-muted">
              {guests.length} khách · tối đa {people} người
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={`/app/events/${id}/guests/import`} className={ghostBtn}>
              Nhập từ Excel
            </Link>
            <Link href={`/app/events/${id}/guests/new`} className={primaryBtn}>
              + Thêm khách
            </Link>
          </div>
        </div>
      </div>

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
