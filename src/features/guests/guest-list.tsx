"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Input, Select } from "@/components/ui";
import { GUEST_SIDES, RSVP_STATUS, label } from "@/lib/labels";
import { saveInviteMessage, setInviteSent } from "./actions";
import { displayPhone, vnFold } from "./normalize";

export type ListGuest = {
  id: string;
  display_name: string;
  salutation: string | null;
  phone_e164: string | null;
  side: string | null;
  max_party_size: number;
  token: string;
  invite_sent_at: string | null;
  search_text: string | null;
  guest_group_links: { group_id: string }[];
  session_invites: { session_id: string; rsvp_status: string; attending_count: number | null }[];
};

type Props = {
  eventId: string;
  eventTitle: string;
  baseUrl: string;
  guests: ListGuest[];
  groups: { id: string; name: string }[];
  sessions: { id: string; name: string }[];
  invitations: { slug: string; session_ids: string[] | null }[];
  inviteMessage: string | null;
};

export const DEFAULT_INVITE_MESSAGE = "Trân trọng kính mời {ten} đến dự {su_kien}.\nThiệp mời: {link}";
const PAGE = 200;

/** Thiệp phù hợp nhất cho khách: thiệp đầu tiên hiện ít nhất một buổi khách được mời. */
function pickInvitation(invitations: Props["invitations"], sessionIds: string[]) {
  return (
    invitations.find((i) => !i.session_ids || i.session_ids.some((s) => sessionIds.includes(s))) ?? invitations[0] ?? null
  );
}

export function GuestList(props: Props) {
  const { guests, groups, sessions, invitations, baseUrl } = props;
  const [q, setQ] = useState("");
  const [side, setSide] = useState("");
  const [group, setGroup] = useState("");
  const [sent, setSent] = useState("");
  const [rsvp, setRsvp] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [message, setMessage] = useState(props.inviteMessage || DEFAULT_INVITE_MESSAGE);
  const [msgState, setMsgState] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sentMap, setSentMap] = useState(() => new Map(guests.map((g) => [g.id, Boolean(g.invite_sent_at)])));
  // Chỉ biết trình duyệt có bảng chia sẻ (Zalo, Messenger…) sau khi hydrate.
  const canShare = useSyncExternalStore(
    () => () => {},
    () => "share" in navigator,
    () => false,
  );

  const groupName = useMemo(() => new Map(groups.map((g) => [g.id, g.name])), [groups]);
  const sessionName = useMemo(() => new Map(sessions.map((s) => [s.id, s.name])), [sessions]);

  const filtered = useMemo(() => {
    const term = vnFold(q.trim());
    const digits = q.replace(/\D/g, "");
    return guests.filter((g) => {
      if (term) {
        const byName = (g.search_text ?? "").includes(term);
        const byPhone = digits.length >= 3 && (g.phone_e164 ?? "").replace(/\D/g, "").includes(digits.replace(/^0/, ""));
        if (!byName && !byPhone) return false;
      }
      if (side && (g.side ?? "none") !== side) return false;
      if (group && !g.guest_group_links.some((l) => l.group_id === group)) return false;
      if (sent && ((sentMap.get(g.id) ?? Boolean(g.invite_sent_at)) ? "yes" : "no") !== sent) return false;
      if (rsvp && !g.session_invites.some((s) => s.rsvp_status === rsvp)) return false;
      return true;
    });
  }, [guests, q, side, group, sent, rsvp, sentMap]);

  function linkFor(g: ListGuest) {
    const inv = pickInvitation(invitations, g.session_invites.map((s) => s.session_id));
    return inv ? `${baseUrl}/${inv.slug}?g=${g.token}` : null;
  }

  function messageFor(g: ListGuest) {
    const link = linkFor(g);
    if (!link) return null;
    return message
      .replaceAll("{ten}", g.salutation || g.display_name)
      .replaceAll("{su_kien}", props.eventTitle)
      .replaceAll("{link}", link);
  }

  async function markSent(id: string, value: boolean) {
    setError(null);
    setSentMap((m) => new Map(m).set(id, value));
    const res = await setInviteSent(id, value);
    if (res.error) {
      setError(res.error);
      setSentMap((m) => new Map(m).set(id, !value));
    }
  }

  async function copy(g: ListGuest) {
    const text = messageFor(g);
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(g.id);
    setTimeout(() => setCopied((c) => (c === g.id ? null : c)), 2000);
  }

  async function share(g: ListGuest) {
    const text = messageFor(g);
    if (!text) return;
    try {
      await navigator.share({ text });
      if (!sentMap.get(g.id)) markSent(g.id, true);
    } catch {
      // người dùng đóng bảng chia sẻ
    }
  }

  const sentCount = guests.filter((g) => sentMap.get(g.id) ?? Boolean(g.invite_sent_at)).length;
  const hasSides = guests.some((g) => g.side);

  return (
    <div className="space-y-4">
      {invitations.length === 0 ? (
        <p className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
          Chưa có thiệp nào được xuất bản. Hãy xuất bản thiệp để có link riêng gửi cho từng khách.
        </p>
      ) : (
        <details className="rounded-xl border border-border bg-surface p-4 text-sm">
          <summary className="cursor-pointer font-medium">Câu mời khi sao chép ({sentCount}/{guests.length} đã gửi)</summary>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={500}
            aria-label="Câu mời"
            className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-base"
          />
          <p className="mt-1 text-xs text-muted">
            <code>{"{ten}"}</code> = xưng hô của khách, <code>{"{su_kien}"}</code> = tên sự kiện, <code>{"{link}"}</code> = link thiệp
            riêng của khách.
          </p>
          <button
            type="button"
            className="mt-2 text-sm font-medium text-brand"
            onClick={async () => {
              setMsgState("Đang lưu…");
              const res = await saveInviteMessage(props.eventId, message);
              setMsgState(res.error ?? "Đã lưu câu mời");
            }}
          >
            Lưu câu mời
          </button>
          {msgState && <span className="ml-2 text-xs text-muted">{msgState}</span>}
        </details>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]">
        <Input
          className="col-span-2 sm:col-span-1"
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setLimit(PAGE);
          }}
          placeholder="Tìm theo tên hoặc số điện thoại"
          aria-label="Tìm khách"
        />
        {hasSides && (
          <Select value={side} onChange={(e) => setSide(e.target.value)} aria-label="Lọc theo bên">
            <option value="">Mọi bên</option>
            {Object.entries(GUEST_SIDES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
            <option value="none">Chưa chọn bên</option>
          </Select>
        )}
        {groups.length > 0 && (
          <Select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Lọc theo nhóm">
            <option value="">Mọi nhóm</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        )}
        <Select value={sent} onChange={(e) => setSent(e.target.value)} aria-label="Lọc theo đã gửi">
          <option value="">Đã gửi + chưa gửi</option>
          <option value="no">Chưa gửi</option>
          <option value="yes">Đã gửi</option>
        </Select>
        <Select value={rsvp} onChange={(e) => setRsvp(e.target.value)} aria-label="Lọc theo trả lời">
          <option value="">Mọi trả lời</option>
          {Object.entries(RSVP_STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <p className="text-xs text-muted">
        {filtered.length === guests.length ? `${guests.length} khách` : `${filtered.length} / ${guests.length} khách`}
      </p>

      <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
        {filtered.slice(0, limit).map((g) => {
          const isSent = sentMap.get(g.id) ?? Boolean(g.invite_sent_at);
          const hasLink = Boolean(linkFor(g));
          return (
            <li key={g.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <Link href={`/app/events/${props.eventId}/guests/${g.id}`} className="font-medium hover:underline">
                  {g.display_name}
                </Link>
                <p className="text-xs text-muted">
                  {[
                    g.salutation && g.salutation !== g.display_name ? `“${g.salutation}”` : null,
                    displayPhone(g.phone_e164) || null,
                    `${g.max_party_size} người`,
                    g.side ? label(GUEST_SIDES, g.side) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {(g.guest_group_links.length > 0 || g.session_invites.length > 0) && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {g.guest_group_links.map((l) => (
                      <span key={l.group_id} className="rounded-full bg-background px-2 py-0.5 text-xs">
                        {groupName.get(l.group_id)}
                      </span>
                    ))}
                    {g.session_invites.map((s) => (
                      <span
                        key={s.session_id}
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          s.rsvp_status === "yes"
                            ? "bg-brand/10 text-brand"
                            : s.rsvp_status === "no"
                              ? "bg-danger/10 text-danger"
                              : "border border-border text-muted"
                        }`}
                      >
                        {sessions.length > 1 ? `${sessionName.get(s.session_id)}: ` : ""}
                        {label(RSVP_STATUS, s.rsvp_status)}
                        {s.rsvp_status === "yes" && s.attending_count ? ` (${s.attending_count})` : ""}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                {hasLink && (
                  <>
                    <button type="button" className="text-sm font-medium text-brand" onClick={() => copy(g)}>
                      {copied === g.id ? "Đã chép" : "Sao chép"}
                    </button>
                    {canShare && (
                      <button type="button" className="text-sm font-medium text-brand" onClick={() => share(g)}>
                        Gửi…
                      </button>
                    )}
                  </>
                )}
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={isSent} onChange={(e) => markSent(g.id, e.target.checked)} />
                  Đã gửi
                </label>
              </div>
            </li>
          );
        })}
        {filtered.length === 0 && <li className="p-6 text-center text-sm text-muted">Không có khách nào khớp.</li>}
      </ul>
      {filtered.length > limit && (
        <button type="button" className="text-sm font-medium text-brand" onClick={() => setLimit((l) => l + PAGE)}>
          Hiện thêm {Math.min(PAGE, filtered.length - limit)} khách
        </button>
      )}
    </div>
  );
}
