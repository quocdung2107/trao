import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ImportWizard } from "@/features/guests/import-wizard";
import { getEventForGuests, listGuestPhones } from "@/features/guests/queries";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Nhập khách từ Excel" };

async function Import({ params }: { params: PageProps<"/app/events/[id]/guests/import">["params"] }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) redirect(`/login?next=/app/events/${id}/guests/import`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await getEventForGuests(id, userId);
  if (!ctx) notFound();
  if (ctx.myRole !== "owner" && ctx.myRole !== "cohost") redirect(`/app/events/${id}`);
  const phones = await listGuestPhones(id);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/app/events/${id}/guests`} className="text-sm text-muted">
        ← Khách mời
      </Link>
      <h1 className="mt-2 mb-4 font-serif text-2xl">Nhập khách từ Excel</h1>
      <ImportWizard
        eventId={id}
        isWedding={ctx.event.event_type === "wedding"}
        sessions={ctx.sessions}
        existingPhones={phones}
      />
    </div>
  );
}

export default function ImportPage(props: PageProps<"/app/events/[id]/guests/import">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Đang tải…</p>}>
      <Import params={props.params} />
    </Suspense>
  );
}
