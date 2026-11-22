import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { formatDateTime } from "@/features/events/format";
import { getEventForGuests } from "@/features/guests/queries";
import { listAudit } from "@/features/seating/queries";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Lịch sử thay đổi" };

type Info = {
  table?: string | null;
  guest?: string | null;
  seats?: number;
  count?: number;
  guests?: number;
  reason?: string | null;
  session?: string | null;
} | null;

function describe(action: string, before: Info, after: Info) {
  const who = (after ?? before)?.guest ?? "Khách đã xóa";
  if (action === "seat.assign") return `Xếp ${who} vào ${after?.table ?? "bàn"} (${after?.seats} chỗ)`;
  if (action === "seat.unassign") return before?.table ? `Bỏ ${who} khỏi ${before.table}` : `Bỏ ${who} khỏi bàn đã xóa`;
  if (action === "table.delete") return `Xóa ${before?.table}`;
  if (action === "export") return `Xuất Excel danh sách ${after?.guests ?? ""} khách`;
  if (action === "checkin.void") return `Hủy check-in của ${who} (${before?.count} người)${before?.reason ? `: ${before.reason}` : ""}`;
  return action;
}

async function History({ params }: { params: PageProps<"/app/events/[id]/history">["params"] }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) redirect(`/login?next=/app/events/${id}/history`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await getEventForGuests(id, userId);
  if (!ctx) notFound();
  if (ctx.myRole !== "owner" && ctx.myRole !== "cohost") redirect(`/app/events/${id}`);
  const rows = await listAudit(id);

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/app/events/${id}/seating`} className="text-sm text-muted">
          ← Xếp bàn
        </Link>
        <h1 className="mt-2 font-serif text-2xl">Lịch sử thay đổi</h1>
        <p className="text-sm text-muted">300 thay đổi gần nhất về xếp bàn, hủy check-in và xuất dữ liệu.</p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">Chưa có thay đổi nào.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {rows.map((r) => {
            const info = (r.after ?? r.before) as Info;
            return (
              <li key={r.id} className="px-4 py-3">
                <p className="text-sm">{describe(r.action, r.before as Info, r.after as Info)}</p>
                <p className="text-xs text-muted">
                  {formatDateTime(r.created_at)} · {r.actor}
                  {info?.session && ` · ${info.session}`}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function HistoryPage(props: PageProps<"/app/events/[id]/history">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Đang tải…</p>}>
      <History params={props.params} />
    </Suspense>
  );
}
