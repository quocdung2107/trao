import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { CheckinDesk } from "@/features/checkin/checkin-desk";
import { getEventForGuests } from "@/features/guests/queries";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Check-in" };

async function Checkin({ params, searchParams }: PageProps<"/app/events/[id]/checkin">) {
  const { id } = await params;
  const { s } = await searchParams;
  const userId = await getUserId();
  if (!userId) redirect(`/login?next=/app/events/${id}/checkin`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await getEventForGuests(id, userId);
  if (!ctx) notFound();
  if (!ctx.myRole || ctx.myRole === "viewer") redirect(`/app/events/${id}`);
  if (ctx.sessions.length === 0) redirect(`/app/events/${id}`);

  const session = ctx.sessions.find((x) => x.id === s);
  // Nhiều buổi mà chưa chọn: hỏi buổi nào trước (màn S1).
  if (!session && ctx.sessions.length > 1) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <Link href={`/app/events/${id}`} className="text-sm text-muted">
          ← {ctx.event.title}
        </Link>
        <h1 className="font-serif text-2xl">Check-in buổi nào?</h1>
        <ul className="space-y-3">
          {ctx.sessions.map((x) => (
            <li key={x.id}>
              <Link
                href={`/app/events/${id}/checkin?s=${x.id}`}
                className="block rounded-2xl bg-surface px-5 py-4 text-lg font-semibold ring-1 ring-border"
              >
                {x.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  const current = session ?? ctx.sessions[0];

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <Link href={ctx.sessions.length > 1 ? `/app/events/${id}/checkin` : `/app/events/${id}`} className="text-sm text-muted">
          ← {ctx.sessions.length > 1 ? "Đổi buổi" : ctx.event.title}
        </Link>
        <h1 className="mt-1 font-serif text-2xl">Check-in · {current.name}</h1>
      </div>
      <CheckinDesk key={current.id} sessionId={current.id} canVoidAll={ctx.myRole === "owner" || ctx.myRole === "cohost"} />
    </div>
  );
}

export default function CheckinPage(props: PageProps<"/app/events/[id]/checkin">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Đang tải…</p>}>
      <Checkin {...props} />
    </Suspense>
  );
}
