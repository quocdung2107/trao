import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/components/ui";
import { createGuest } from "@/features/guests/actions";
import { GuestForm } from "@/features/guests/guest-form";
import { getEventForGuests, listGroups } from "@/features/guests/queries";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Thêm khách" };

async function NewGuest({ props }: { props: PageProps<"/app/events/[id]/guests/new"> }) {
  const [{ id }, { added }] = await Promise.all([props.params, props.searchParams]);
  const userId = await getUserId();
  if (!userId) redirect(`/login?next=/app/events/${id}/guests/new`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await getEventForGuests(id, userId);
  if (!ctx) notFound();
  if (ctx.myRole !== "owner" && ctx.myRole !== "cohost") redirect(`/app/events/${id}`);
  const groups = await listGroups(id);

  return (
    <div className="mx-auto max-w-lg">
      <Link href={`/app/events/${id}/guests`} className="text-sm text-muted">
        ← Khách mời
      </Link>
      <h1 className="mt-2 mb-4 font-serif text-2xl">Thêm khách</h1>
      {typeof added === "string" && (
        <p role="status" className="mb-4 rounded-lg bg-brand/10 px-3 py-2 text-sm text-brand">
          Đã thêm {added}.
        </p>
      )}
      <Card>
        <GuestForm
          key={typeof added === "string" ? added : "new"}
          action={createGuest.bind(null, id)}
          groups={groups}
          sessions={ctx.sessions}
          isWedding={ctx.event.event_type === "wedding"}
          submitLabel="Lưu khách"
          allowAddAnother
        />
      </Card>
    </div>
  );
}

export default function NewGuestPage(props: PageProps<"/app/events/[id]/guests/new">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Đang tải…</p>}>
      <NewGuest props={props} />
    </Suspense>
  );
}
