import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card } from "@/components/ui";
import { listMyEvents } from "@/features/events/queries";
import { EVENT_ROLES, EVENT_STATUS, EVENT_TYPES, label } from "@/lib/labels";
import { getUserId } from "@/lib/supabase/server";
import { restoreEvent } from "./events/actions";

export const metadata: Metadata = { title: "Sự kiện của tôi" };

async function EventList() {
  const userId = await getUserId();
  if (!userId) redirect("/login?next=/app");
  const { active, trashed } = await listMyEvents(userId);

  return (
    <>
      {active.length === 0 ? (
        <Card className="text-center">
          <p className="font-serif text-lg">Chưa có sự kiện nào</p>
          <p className="mt-1 text-sm text-muted">Tạo sự kiện đầu tiên để bắt đầu làm thiệp và mời khách.</p>
          <Link
            href="/app/events/new"
            className="mt-4 inline-block rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white"
          >
            Tạo sự kiện
          </Link>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {active.map((e) => (
            <li key={e.id}>
              <Link href={`/app/events/${e.id}`} className="block rounded-xl border border-border bg-surface p-4 hover:border-brand">
                <p className="text-xs uppercase tracking-wide text-muted">{label(EVENT_TYPES, e.event_type)}</p>
                <p className="mt-1 font-serif text-lg">{e.title}</p>
                <p className="mt-2 text-xs text-muted">
                  {label(EVENT_STATUS, e.status)} · {e.role ? label(EVENT_ROLES, e.role) : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {trashed.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold text-muted">Thùng rác</h2>
          <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-surface">
            {trashed.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm">{e.title}</span>
                <ActionForm action={restoreEvent.bind(null, e.id)}>
                  <SubmitButton className="text-sm font-medium text-brand" pendingText="Đang khôi phục…">
                    Khôi phục
                  </SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export default function EventsPage() {
  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl">Sự kiện của tôi</h1>
        <Link href="/app/events/new" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
          + Tạo sự kiện
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-muted">Đang tải…</p>}>
        <EventList />
      </Suspense>
    </>
  );
}
