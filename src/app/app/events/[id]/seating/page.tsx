import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, Input, Label } from "@/components/ui";
import { getEventForGuests } from "@/features/guests/queries";
import { createTables } from "@/features/seating/actions";
import { getSeating } from "@/features/seating/queries";
import { SeatingBoard } from "@/features/seating/seating-board";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Xếp bàn" };

const primaryBtn = "rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-50";

async function Seating({ params, searchParams }: PageProps<"/app/events/[id]/seating">) {
  const { id } = await params;
  const { s } = await searchParams;
  const userId = await getUserId();
  if (!userId) redirect(`/login?next=/app/events/${id}/seating`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await getEventForGuests(id, userId);
  if (!ctx) notFound();
  if (ctx.myRole !== "owner" && ctx.myRole !== "cohost") redirect(`/app/events/${id}`);
  if (ctx.sessions.length === 0) redirect(`/app/events/${id}`);

  const session = ctx.sessions.find((x) => x.id === s) ?? ctx.sessions[0];
  const data = await getSeating(id, session.id);
  const capacity = data.tables.reduce((n, t) => n + t.capacity, 0);

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/app/events/${id}`} className="text-sm text-muted">
          ← {ctx.event.title}
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl">Xếp bàn</h1>
            <p className="text-sm text-muted">
              {data.tables.length} bàn · {capacity} chỗ
            </p>
          </div>
          <Link href={`/app/events/${id}/history`} className="text-sm font-medium text-brand">
            Lịch sử đổi bàn
          </Link>
        </div>
        {ctx.sessions.length > 1 && (
          <nav className="mt-3 flex flex-wrap gap-2" aria-label="Chọn buổi tiệc">
            {ctx.sessions.map((x) => (
              <Link
                key={x.id}
                href={`/app/events/${id}/seating?s=${x.id}`}
                aria-current={x.id === session.id ? "page" : undefined}
                className={`rounded-full border px-3 py-1.5 text-sm ${x.id === session.id ? "border-brand bg-brand text-white" : "border-border bg-surface"}`}
              >
                {x.name}
              </Link>
            ))}
          </nav>
        )}
      </div>

      <Card>
        <details open={data.tables.length === 0}>
          <summary className="cursor-pointer font-medium">
            {data.tables.length === 0 ? "Tạo bàn cho buổi này" : "+ Thêm bàn"}
          </summary>
          <ActionForm action={createTables.bind(null, id, session.id)} className="mt-3 flex flex-wrap items-end gap-2">
            <div className="w-24">
              <Label htmlFor="count">Số bàn</Label>
              <Input id="count" name="count" type="number" min={1} max={200} defaultValue={data.tables.length ? 1 : 30} required />
            </div>
            <div className="w-24">
              <Label htmlFor="capacity">Chỗ mỗi bàn</Label>
              <Input id="capacity" name="capacity" type="number" min={1} max={100} defaultValue={10} required />
            </div>
            <div className="w-28">
              <Label htmlFor="prefix">Tên bàn</Label>
              <Input id="prefix" name="prefix" defaultValue="Bàn" maxLength={30} />
            </div>
            <div className="min-w-28 flex-1">
              <Label htmlFor="zone">Khu vực (tùy chọn)</Label>
              <Input id="zone" name="zone" maxLength={60} placeholder="Tầng 2" />
            </div>
            <SubmitButton className={primaryBtn} pendingText="Đang tạo…">
              Tạo bàn
            </SubmitButton>
          </ActionForm>
          <p className="mt-2 text-xs text-muted">Bàn được đánh số nối tiếp, ví dụ Bàn 1 đến Bàn 30. Đổi tên hoặc sức chứa từng bàn sau.</p>
        </details>
      </Card>

      <SeatingBoard key={session.id} data={data} />
    </div>
  );
}

export default function SeatingPage(props: PageProps<"/app/events/[id]/seating">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Đang tải…</p>}>
      <Seating {...props} />
    </Suspense>
  );
}
