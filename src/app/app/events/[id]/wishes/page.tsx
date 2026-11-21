import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { formatDateTime } from "@/features/events/format";
import { getEventForGuests, listWishes } from "@/features/guests/queries";
import { deleteWish, hideWish, showWish } from "@/features/rsvp/host-actions";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Lời chúc" };

async function Wishes({ params }: { params: PageProps<"/app/events/[id]/wishes">["params"] }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) redirect(`/login?next=/app/events/${id}/wishes`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await getEventForGuests(id, userId);
  if (!ctx) notFound();
  const canEdit = ctx.myRole === "owner" || ctx.myRole === "cohost";
  const wishes = await listWishes(id);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/app/events/${id}`} className="text-sm text-muted">
        ← {ctx.event.title}
      </Link>
      <h1 className="mt-2 font-serif text-2xl">Lời chúc</h1>
      <p className="mb-4 text-sm text-muted">Lời chúc hiện công khai trên thiệp. Ẩn những lời không phù hợp.</p>
      {wishes.length === 0 ? (
        <p className="text-sm text-muted">Chưa có lời chúc nào.</p>
      ) : (
        <ul className="space-y-3">
          {wishes.map((w) => (
            <li key={w.id} className={`rounded-xl border border-border bg-surface p-4 ${w.status === "hidden" ? "opacity-60" : ""}`}>
              <p className="whitespace-pre-line">{w.message}</p>
              <p className="mt-2 text-xs text-muted">
                <b className="text-foreground">{w.author_name}</b>
                {w.guest_id ? " · khách trong danh sách" : " · qua link chung"} · {formatDateTime(w.created_at)}
                {w.status === "hidden" && " · đang ẩn"}
              </p>
              {canEdit && (
                <div className="mt-2 flex gap-4 text-sm">
                  {w.status === "visible" ? (
                    <ActionForm action={hideWish.bind(null, w.id)}>
                      <SubmitButton className="font-medium text-brand">Ẩn</SubmitButton>
                    </ActionForm>
                  ) : (
                    <ActionForm action={showWish.bind(null, w.id)}>
                      <SubmitButton className="font-medium text-brand">Hiện lại</SubmitButton>
                    </ActionForm>
                  )}
                  <ActionForm action={deleteWish.bind(null, w.id)} confirm="Xóa hẳn lời chúc này?">
                    <SubmitButton className="text-danger">Xóa</SubmitButton>
                  </ActionForm>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function WishesPage(props: PageProps<"/app/events/[id]/wishes">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Đang tải…</p>}>
      <Wishes params={props.params} />
    </Suspense>
  );
}
