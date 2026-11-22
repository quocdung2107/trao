import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { CopyButton } from "@/components/copy-button";
import { Card, Input, Label, Select } from "@/components/ui";
import { formatDateTime } from "@/features/events/format";
import { getEventDetail } from "@/features/events/queries";
import { createInvitation } from "@/features/invitations/actions";
import { getEventStats } from "@/features/guests/queries";
import { listInvitations } from "@/features/invitations/queries";
import { TEMPLATES } from "@/features/invitations/templates/registry";
import { EVENT_ROLES, EVENT_STATUS, EVENT_TYPES, hasParty, label } from "@/lib/labels";
import { siteUrl } from "@/lib/site-url";
import { getUserId } from "@/lib/supabase/server";
import {
  addSession,
  changeMemberRole,
  createInvite,
  deleteSession,
  removeMember,
  revokeInvite,
  trashEvent,
  updateEventTitle,
} from "../actions";

export const metadata: Metadata = { title: "Sự kiện" };

const primaryBtn = "rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-50";
const linkBtn = "text-sm font-medium text-brand disabled:opacity-50";
const dangerLink = "text-sm text-danger disabled:opacity-50";

async function EventDetail({ params }: { params: PageProps<"/app/events/[id]">["params"] }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) redirect(`/login?next=/app/events/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const detail = await getEventDetail(id, userId);
  if (!detail || detail.event.deleted_at) notFound();
  const { event, myRole, sessions, members, invites } = detail;
  const canEdit = myRole === "owner" || myRole === "cohost";
  const isOwner = myRole === "owner";
  const party = hasParty(event.event_type);
  const openRsvp = (event.settings as { openRsvp?: boolean } | null)?.openRsvp === true;
  const base = await siteUrl();
  const [invitations, stats] = await Promise.all([listInvitations(event.id), getEventStats(event.id)]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app" className="text-sm text-muted">
          ← Sự kiện của tôi
        </Link>
        <p className="mt-3 text-xs uppercase tracking-wide text-muted">
          {label(EVENT_TYPES, event.event_type)} · {label(EVENT_STATUS, event.status)}
          {myRole && ` · Bạn là ${label(EVENT_ROLES, myRole).toLowerCase()}`}
        </p>
        {canEdit ? (
          <ActionForm action={updateEventTitle.bind(null, event.id)} className="mt-1 flex gap-2">
            <Input name="title" defaultValue={event.title} maxLength={200} className="font-serif text-xl" aria-label="Tên sự kiện" />
            <SubmitButton className={primaryBtn} pendingText="Đang lưu…">
              Lưu
            </SubmitButton>
          </ActionForm>
        ) : (
          <h1 className="mt-1 font-serif text-2xl">{event.title}</h1>
        )}
      </div>

      {party && myRole && myRole !== "viewer" && sessions.length > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg">Check-in tại sảnh</h2>
            <p className="text-sm text-muted">Quét mã QR hoặc tìm tên khách, xem ngay số bàn.</p>
          </div>
          <Link href={`/app/events/${event.id}/checkin`} className={primaryBtn}>
            Mở màn check-in
          </Link>
        </Card>
      )}

      {/* Thiệp mời */}
      <Card>
        <h2 className="font-serif text-lg">Thiệp mời</h2>
        <p className="text-sm text-muted">
          {!party
            ? "Gửi link chung cho mọi người, hoặc link có tên từng người trong danh sách người nhận."
            : openRsvp
              ? "Ai có link chung đều đăng ký tham dự được; bạn duyệt trong mục Chờ duyệt. Khách có link riêng thì trả lời ngay."
              : "Link chung để xem thiệp và gửi lời chúc. Khách xác nhận tham dự qua link riêng trong danh sách khách, hoặc bạn bật đăng ký qua link chung."}
        </p>
        {invitations.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Chưa có thiệp nào.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {invitations.map((inv) => {
              const url = `${base}/${inv.slug}`;
              return (
                <li key={inv.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{inv.name}</p>
                    <p className="text-xs text-muted">
                      {TEMPLATES.find((t) => t.key === inv.template_key)?.name ?? inv.template_key} ·{" "}
                      {inv.published_at ? "Đã xuất bản" : "Bản nháp"}
                    </p>
                  </div>
                  {inv.published_at && <CopyButton text={url} label="Chép link chung" />}
                  {canEdit && (
                    <Link href={`/app/events/${event.id}/invitations/${inv.id}`} className={linkBtn}>
                      Sửa
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {canEdit && (
          <ActionForm action={createInvitation.bind(null, event.id)} className="mt-4 flex flex-wrap items-end gap-2">
            <div className="min-w-40 flex-1">
              <Label htmlFor="inv-name">Tên thiệp</Label>
              <Input id="inv-name" name="name" placeholder={invitations.length ? "Thiệp nhà trai" : "Thiệp chính"} maxLength={100} />
            </div>
            <div>
              <Label htmlFor="inv-template">Mẫu</Label>
              <Select id="inv-template" name="templateKey" defaultValue={TEMPLATES[0].key}>
                {TEMPLATES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
            <SubmitButton className={primaryBtn} pendingText="Đang tạo…">
              Tạo thiệp
            </SubmitButton>
          </ActionForm>
        )}
      </Card>

      {/* Tổng quan khách & trả lời */}
      {stats && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-lg">{party ? "Khách mời" : "Người nhận"}</h2>
            {canEdit && (
              <Link href={`/app/events/${event.id}/guests`} className={primaryBtn}>
                {stats.guests === 0 ? (party ? "Thêm khách" : "Thêm người nhận") : party ? "Danh sách khách" : "Danh sách người nhận"}
              </Link>
            )}
          </div>
          {canEdit && stats.requests_pending > 0 && (
            <Link
              href={`/app/events/${event.id}/guests/requests`}
              className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm"
            >
              <span>
                <b>{stats.requests_pending} người</b> đăng ký qua link chung đang chờ bạn duyệt
              </span>
              <span className="font-semibold text-brand">Xem →</span>
            </Link>
          )}
          {stats.guests === 0 ? (
            <p className="mt-1 text-sm text-muted">
              {party
                ? "Chưa có khách nào. Nhập từ Excel hoặc thêm từng khách."
                : "Không bắt buộc. Thêm người nhận nếu muốn gửi link có tên từng người (“Thân gửi cô Lan”)."}
            </p>
          ) : (
            <>
              <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-background p-3">
                  <dt className="text-xs text-muted">Khách</dt>
                  <dd className="text-2xl font-semibold tabular-nums">{stats.guests}</dd>
                </div>
                <div className="rounded-lg bg-background p-3">
                  <dt className="text-xs text-muted">Tối đa</dt>
                  <dd className="text-2xl font-semibold tabular-nums">{stats.max_people}</dd>
                </div>
                <div className="rounded-lg bg-background p-3">
                  <dt className="text-xs text-muted">Đã gửi thiệp</dt>
                  <dd className="text-2xl font-semibold tabular-nums">{stats.sent}</dd>
                </div>
              </dl>
              <ul className="mt-4 space-y-3">
                {stats.sessions
                  .filter((s) => s.invited > 0)
                  .map((s) => {
                    const answered = s.yes + s.no + s.maybe;
                    return (
                      <li key={s.id}>
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="font-medium">{s.name}</span>
                          <span className="text-muted">
                            {answered}/{s.invited} đã trả lời
                          </span>
                        </div>
                        <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-background" aria-hidden>
                          <div className="bg-brand" style={{ width: `${(s.yes / s.invited) * 100}%` }} />
                          <div className="bg-accent" style={{ width: `${(s.maybe / s.invited) * 100}%` }} />
                          <div className="bg-danger/60" style={{ width: `${(s.no / s.invited) * 100}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          <b className="text-brand">{s.attending} người sẽ đến</b> ({s.yes} khách) · {s.maybe} chưa chắc · {s.no}{" "}
                          không đến · {s.pending} chưa trả lời
                        </p>
                        {s.tables > 0 && (
                          <p className="text-xs text-muted">
                            Đã xếp bàn {s.seated}/{s.to_seat} khách · {s.tables} bàn
                          </p>
                        )}
                        {s.arrived > 0 && <p className="text-xs font-semibold text-brand">Đã đến {s.arrived} khách</p>}
                      </li>
                    );
                  })}
              </ul>
            </>
          )}
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            {stats.wishes > 0 && (
              <Link href={`/app/events/${event.id}/wishes`} className={linkBtn}>
                Xem {stats.wishes} lời chúc →
              </Link>
            )}
            {canEdit && (
              <Link href={`/app/events/${event.id}/history`} className={linkBtn}>
                Lịch sử thay đổi
              </Link>
            )}
          </div>
        </Card>
      )}

      {/* Buổi tiệc (Lời chúc không có tiệc) */}
      {party && (
      <Card>
        <h2 className="font-serif text-lg">Buổi tiệc</h2>
        <p className="text-sm text-muted">Bàn và check-in được quản lý riêng cho từng buổi.</p>
        {sessions.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Chưa có buổi tiệc nào.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-sm text-muted">
                    {[formatDateTime(s.starts_at), s.venue_name, s.address].filter(Boolean).join(" · ") || "Chưa có thời gian, địa điểm"}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 items-center gap-3">
                    <Link href={`/app/events/${event.id}/seating?s=${s.id}`} className={linkBtn}>
                      Xếp bàn
                    </Link>
                    <ActionForm action={deleteSession.bind(null, s.id)} confirm={`Xóa buổi "${s.name}"?`}>
                      <SubmitButton className={dangerLink}>Xóa</SubmitButton>
                    </ActionForm>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-brand">+ Thêm buổi tiệc</summary>
            <ActionForm action={addSession.bind(null, event.id)} className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="name">Tên buổi</Label>
                <Input id="name" name="name" required maxLength={100} placeholder="Tiệc nhà trai" />
              </div>
              <div>
                <Label htmlFor="startsAt">Thời gian (giờ Việt Nam)</Label>
                <Input id="startsAt" name="startsAt" type="datetime-local" />
              </div>
              <div>
                <Label htmlFor="venueName">Địa điểm</Label>
                <Input id="venueName" name="venueName" maxLength={200} placeholder="Nhà hàng …" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="address">Địa chỉ</Label>
                <Input id="address" name="address" maxLength={500} />
              </div>
              <div>
                <SubmitButton className={primaryBtn} pendingText="Đang thêm…">
                  Thêm buổi
                </SubmitButton>
              </div>
            </ActionForm>
          </details>
        )}
      </Card>
      )}

      {/* Thành viên */}
      <Card>
        <h2 className="font-serif text-lg">Người quản lý</h2>
        <p className="text-sm text-muted">Đồng tổ chức sửa được mọi thứ; nhân viên chỉ dùng màn check-in.</p>
        <ul className="mt-4 divide-y divide-border">
          {members.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span className="font-medium">
                {m.name}
                {m.isMe && <span className="text-muted"> (bạn)</span>}
              </span>
              {isOwner ? (
                <div className="flex items-center gap-3">
                  <ActionForm action={changeMemberRole.bind(null, event.id, m.user_id)} className="flex items-center gap-2">
                    <Select name="role" defaultValue={m.role} className="w-auto py-1.5 text-sm" aria-label={`Vai trò của ${m.name}`}>
                      {Object.entries(EVENT_ROLES).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </Select>
                    <SubmitButton className={linkBtn}>Đổi</SubmitButton>
                  </ActionForm>
                  <ActionForm action={removeMember.bind(null, event.id, m.user_id)} confirm={`Gỡ ${m.name} khỏi sự kiện?`}>
                    <SubmitButton className={dangerLink}>Gỡ</SubmitButton>
                  </ActionForm>
                </div>
              ) : (
                <span className="text-sm text-muted">{label(EVENT_ROLES, m.role)}</span>
              )}
            </li>
          ))}
        </ul>

        {isOwner && (
          <div className="mt-6 border-t border-border pt-4">
            <h3 className="text-sm font-semibold">Mời người quản lý bằng liên kết</h3>
            <ActionForm action={createInvite.bind(null, event.id)} className="mt-2 flex flex-wrap items-end gap-2">
              <div>
                <Label htmlFor="role">Vai trò</Label>
                <Select id="role" name="role" defaultValue="staff" className="w-auto">
                  <option value="cohost">{EVENT_ROLES.cohost}</option>
                  <option value="staff">{EVENT_ROLES.staff}</option>
                  <option value="viewer">{EVENT_ROLES.viewer}</option>
                </Select>
              </div>
              <div className="min-w-48 flex-1">
                <Label htmlFor="note">Ghi chú (để bạn nhớ gửi cho ai)</Label>
                <Input id="note" name="note" maxLength={200} placeholder="Chị Lan – lễ tân" />
              </div>
              <SubmitButton className={primaryBtn} pendingText="Đang tạo…">
                Tạo liên kết
              </SubmitButton>
            </ActionForm>

            {invites.length > 0 && (
              <ul className="mt-4 space-y-3">
                {invites.map((inv) => {
                  const url = `${base}/invite/${inv.token}`;
                  return (
                    <li key={inv.id} className="rounded-lg border border-border p-3">
                      <p className="text-sm">
                        <strong>{label(EVENT_ROLES, inv.role)}</strong>
                        {inv.note && ` · ${inv.note}`}
                        <span className="text-muted"> · hết hạn {formatDateTime(inv.expires_at)}</span>
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1 text-xs">{url}</code>
                        <CopyButton text={url} />
                        <ActionForm action={revokeInvite.bind(null, inv.id)}>
                          <SubmitButton className={dangerLink}>Thu hồi</SubmitButton>
                        </ActionForm>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted">
              Mỗi liên kết dùng được một lần, hết hạn sau 14 ngày. Gửi qua Zalo cho đúng người.
            </p>
          </div>
        )}
      </Card>

      {isOwner && (
        <Card className="border-danger/30">
          <h2 className="font-serif text-lg">Xóa sự kiện</h2>
          <p className="text-sm text-muted">Sự kiện vào thùng rác và có thể khôi phục trong 30 ngày.</p>
          <ActionForm action={trashEvent.bind(null, event.id)} confirm="Đưa sự kiện vào thùng rác?" className="mt-3">
            <SubmitButton className="rounded-lg border border-danger/30 px-4 py-2 text-sm font-semibold text-danger">
              Đưa vào thùng rác
            </SubmitButton>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}

export default function EventPage(props: PageProps<"/app/events/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Đang tải…</p>}>
      <EventDetail params={props.params} />
    </Suspense>
  );
}
