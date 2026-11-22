import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { formatDateTime } from "@/features/events/format";
import { restoreGuest } from "@/features/guests/actions";
import { getEventForGuests, listTrashedGuests } from "@/features/guests/queries";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Thùng rác khách mời" };

const DAY = 24 * 3600 * 1000;

async function Trash({ params }: { params: PageProps<"/app/events/[id]/guests/trash">["params"] }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) redirect(`/login?next=/app/events/${id}/guests/trash`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await getEventForGuests(id, userId);
  if (!ctx) notFound();
  if (ctx.myRole !== "owner" && ctx.myRole !== "cohost") redirect(`/app/events/${id}`);
  const guests = await listTrashedGuests(id);
  const now = new Date().getTime();

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/app/events/${id}/guests`} className="text-sm text-muted">
          ← Khách mời
        </Link>
        <h1 className="mt-2 font-serif text-2xl">Thùng rác</h1>
        <p className="text-sm text-muted">Khách đã xóa được giữ 30 ngày, sau đó bị xóa hẳn cùng câu trả lời và chỗ ngồi.</p>
      </div>
      {guests.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">Thùng rác trống.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {guests.map((g) => {
            const left = Math.max(0, 30 - Math.floor((now - new Date(g.deleted_at!).getTime()) / DAY));
            return (
              <li key={g.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{g.display_name}</p>
                  <p className="text-xs text-muted">
                    Xóa lúc {formatDateTime(g.deleted_at)} · còn {left} ngày
                  </p>
                </div>
                <ActionForm action={restoreGuest.bind(null, g.id)}>
                  <SubmitButton className="text-sm font-medium text-brand" pendingText="Đang khôi phục…">
                    Khôi phục
                  </SubmitButton>
                </ActionForm>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function TrashPage(props: PageProps<"/app/events/[id]/guests/trash">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Đang tải…</p>}>
      <Trash params={props.params} />
    </Suspense>
  );
}
