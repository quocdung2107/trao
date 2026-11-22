import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card } from "@/components/ui";
import { formatDateTime } from "@/features/events/format";
import { displayPhone } from "@/features/guests/normalize";
import { getEventForGuests, listGuests, listRsvpRequests } from "@/features/guests/queries";
import { approveRsvpRequest, rejectRsvpRequest, setOpenRsvp } from "@/features/rsvp/host-actions";
import { likelyMatches } from "@/features/rsvp/match";
import { hasParty } from "@/lib/labels";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Chờ duyệt" };

const primaryBtn = "rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-50";
const ghostBtn = "rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold disabled:opacity-50";

async function Requests({ params }: { params: PageProps<"/app/events/[id]/guests/requests">["params"] }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) redirect(`/login?next=/app/events/${id}/guests/requests`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await getEventForGuests(id, userId);
  if (!ctx) notFound();
  if (ctx.myRole !== "owner" && ctx.myRole !== "cohost") redirect(`/app/events/${id}`);

  const party = hasParty(ctx.event.event_type);
  const open = (ctx.event.settings as { openRsvp?: boolean } | null)?.openRsvp === true;
  const [{ pending, decided }, { guests }] = await Promise.all([listRsvpRequests(id), listGuests(id)]);
  const sessionName = new Map(ctx.sessions.map((s) => [s.id, s.name]));
  const guestName = new Map(guests.map((g) => [g.id, g.display_name]));

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link href={`/app/events/${id}/guests`} className="text-sm text-muted">
          ← Khách mời
        </Link>
        <h1 className="mt-2 font-serif text-2xl">Chờ duyệt</h1>
        <p className="text-sm text-muted">
          Người mở link chung và đăng ký tham dự. Họ chỉ vào danh sách khách (xếp bàn, check-in được) khi bạn duyệt.
        </p>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-medium">Đăng ký qua link chung: {party ? (open ? "đang bật" : "đang tắt") : "không áp dụng"}</h2>
          <p className="text-sm text-muted">
            {!party
              ? "Thiệp Lời chúc không có buổi tiệc nên không có đăng ký tham dự."
              : open
                ? "Ai có link chung đều thấy nút “Đăng ký tham dự”. Hợp với tiệc gửi một link vào nhóm Zalo."
                : "Bật khi bạn gửi một link chung vào nhóm và không có danh sách khách từ trước."}
          </p>
        </div>
        {party && (
          <ActionForm action={setOpenRsvp.bind(null, id, !open)}>
            <SubmitButton className={open ? ghostBtn : primaryBtn} pendingText="Đang lưu…">
              {open ? "Tắt đăng ký" : "Bật đăng ký"}
            </SubmitButton>
          </ActionForm>
        )}
      </Card>

      {pending.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">Không có đăng ký nào đang chờ.</p>
      ) : (
        <ul className="space-y-3">
          {pending.map((r) => {
            const matches = likelyMatches(r, guests);
            return (
              <li key={r.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="font-medium">
                    {r.name} <span className="text-muted">· {r.party_size} người</span>
                  </p>
                  <p className="text-xs text-muted">{formatDateTime(r.created_at)}</p>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {[
                    r.phone_e164 && displayPhone(r.phone_e164),
                    r.session_ids.map((s) => sessionName.get(s) ?? "Buổi đã xóa").join(", "),
                    r.invitations?.name && `qua ${r.invitations.name}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {r.note && <p className="mt-2 whitespace-pre-line text-sm">“{r.note}”</p>}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <ActionForm action={approveRsvpRequest.bind(null, r.id, null)}>
                    <SubmitButton className={primaryBtn} pendingText="Đang duyệt…">
                      Duyệt
                    </SubmitButton>
                  </ActionForm>
                  <ActionForm action={rejectRsvpRequest.bind(null, r.id)} confirm={`Từ chối đăng ký của ${r.name}?`}>
                    <SubmitButton className="px-2 py-2 text-sm text-danger disabled:opacity-50">Từ chối</SubmitButton>
                  </ActionForm>
                </div>

                {matches.length > 0 && (
                  <div className="mt-3 rounded-lg bg-background p-3 text-sm">
                    <p className="text-muted">Có thể đã có trong danh sách khách:</p>
                    <ul className="mt-2 space-y-2">
                      {matches.map((g) => (
                        <li key={g.id} className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            <b>{g.display_name}</b>
                            {g.phone_e164 && <span className="text-muted"> · {displayPhone(g.phone_e164)}</span>}
                            {g.phone_e164 && g.phone_e164 === r.phone_e164 && <span className="text-brand"> · trùng SĐT</span>}
                          </span>
                          <ActionForm action={approveRsvpRequest.bind(null, r.id, g.id)}>
                            <SubmitButton className="font-semibold text-brand disabled:opacity-50" pendingText="Đang gộp…">
                              Gộp vào khách này
                            </SubmitButton>
                          </ActionForm>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {decided.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">Đã xử lý gần đây ({decided.length})</summary>
          <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-surface">
            {decided.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span>
                  {r.name} · {r.party_size} người
                </span>
                <span className="text-muted">
                  {r.status === "approved" ? (
                    r.guest_id ? (
                      <Link href={`/app/events/${id}/guests/${r.guest_id}`} className="text-brand underline">
                        Đã duyệt → {guestName.get(r.guest_id) ?? "khách"}
                      </Link>
                    ) : (
                      "Đã duyệt (khách đã xóa)"
                    )
                  ) : (
                    "Đã từ chối"
                  )}
                  {r.decided_at && ` · ${formatDateTime(r.decided_at)}`}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export default function RequestsPage(props: PageProps<"/app/events/[id]/guests/requests">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Đang tải…</p>}>
      <Requests params={props.params} />
    </Suspense>
  );
}
