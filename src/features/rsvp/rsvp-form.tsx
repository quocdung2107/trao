"use client";

import Link from "next/link";
import { useState } from "react";
import type { GuestView } from "@/features/invitations/public";
import { sessionDate } from "@/features/invitations/view";
import { submitRsvp } from "./actions";
import { POLICY_VERSION } from "./policy";

type Answer = { status: "yes" | "no" | "maybe" | null; count: number };

const CHOICES = [
  { key: "yes", label: "Sẽ đến" },
  { key: "maybe", label: "Chưa chắc" },
  { key: "no", label: "Không đến được" },
] as const;

const accent = "var(--inv-accent)";
const line = "var(--inv-line)";

function initialAnswers(g: GuestView): Record<string, Answer> {
  return Object.fromEntries(
    g.invites.map((i) => [
      i.session_id,
      {
        status: i.rsvp_status === "pending" ? null : i.rsvp_status,
        count: i.attending_count && i.attending_count > 0 ? i.attending_count : g.max_party_size,
      },
    ]),
  );
}

/** Khối trả lời trên thiệp cá nhân: từng buổi đi/không/chưa chắc, số người, lời nhắn. */
export function RsvpForm({ slug, token, guest: initial }: { slug: string; token: string; guest: GuestView }) {
  const [guest, setGuest] = useState(initial);
  const answered = guest.invites.some((i) => i.rsvp_status !== "pending");
  const [editing, setEditing] = useState(!answered);
  const [answers, setAnswers] = useState(() => initialAnswers(initial));
  const [note, setNote] = useState(initial.invites.find((i) => i.rsvp_note)?.rsvp_note ?? "");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (guest.invites.length === 0) return null;
  const deadline = guest.rsvp_deadline ? sessionDate(guest.rsvp_deadline) : null;

  async function submit() {
    setError(null);
    const responses = guest.invites.map((i) => ({ session_id: i.session_id, ...answers[i.session_id] }));
    if (responses.some((r) => !r.status)) {
      setError(guest.invites.length > 1 ? "Hãy trả lời cho từng buổi." : "Hãy chọn câu trả lời.");
      return;
    }
    if (!guest.consented && !consent) {
      setError("Hãy đánh dấu đồng ý ở ô bên dưới.");
      return;
    }
    setBusy(true);
    const res = await submitRsvp(slug, token, {
      responses: responses.map((r) => ({ session_id: r.session_id, status: r.status!, count: r.status === "no" ? 0 : r.count })),
      note,
      consentVersion: guest.consented ? null : POLICY_VERSION,
    });
    setBusy(false);
    if (res.error || !res.guest) setError(res.error ?? "Chưa gửi được.");
    else {
      setGuest(res.guest);
      setEditing(false);
    }
  }

  return (
    <div id="tra-loi" className="rounded-2xl px-5 py-6 text-left" style={{ background: "var(--inv-card)", border: `1px solid ${line}` }}>
      <p className="text-center font-serif text-xl" style={{ color: accent }}>
        Xác nhận tham dự
      </p>

      {!editing ? (
        <div className="mt-4 space-y-2 text-center">
          {guest.invites.map((i) => (
            <p key={i.session_id}>
              {guest.invites.length > 1 && <span className="opacity-70">{i.name}: </span>}
              <strong>
                {i.rsvp_status === "yes"
                  ? `Sẽ đến · ${i.attending_count} người`
                  : i.rsvp_status === "no"
                    ? "Không đến được"
                    : i.rsvp_status === "maybe"
                      ? "Chưa chắc"
                      : "Chưa trả lời"}
              </strong>
            </p>
          ))}
          <p className="pt-2 text-sm opacity-80">Cảm ơn bạn đã phản hồi!</p>
          {guest.rsvp_closed && <p className="text-xs opacity-70">Đã hết hạn sửa câu trả lời.</p>}
          {!guest.rsvp_closed && (
            <button type="button" className="text-sm font-semibold underline" style={{ color: accent }} onClick={() => setEditing(true)}>
              Sửa câu trả lời
            </button>
          )}
        </div>
      ) : guest.rsvp_closed ? (
        <p className="mt-4 text-center text-sm">Đã quá hạn trả lời. Vui lòng liên hệ trực tiếp chủ tiệc.</p>
      ) : (
        <div className="mt-4 space-y-5">
          {guest.invites.map((i) => {
            const a = answers[i.session_id];
            const set = (patch: Partial<Answer>) => setAnswers({ ...answers, [i.session_id]: { ...a, ...patch } });
            return (
              <fieldset key={i.session_id}>
                {guest.invites.length > 1 && <legend className="mb-2 font-semibold">{i.name}</legend>}
                <div className="grid grid-cols-3 gap-2">
                  {CHOICES.map((c) => (
                    <label
                      key={c.key}
                      className="cursor-pointer rounded-xl px-2 py-3 text-center text-sm font-semibold"
                      style={
                        a.status === c.key
                          ? { background: accent, color: "var(--inv-bg)", border: `1px solid ${accent}` }
                          : { border: `1px solid ${line}` }
                      }
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        name={`rsvp-${i.session_id}`}
                        value={c.key}
                        checked={a.status === c.key}
                        onChange={() => {
                          set({ status: c.key });
                          setError(null);
                        }}
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
                {a.status && a.status !== "no" && guest.max_party_size > 1 && (
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-sm">Số người đi</span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        aria-label="Bớt một người"
                        className="size-10 rounded-full text-xl"
                        style={{ border: `1px solid ${line}` }}
                        disabled={a.count <= 1}
                        onClick={() => set({ count: a.count - 1 })}
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-lg font-semibold tabular-nums" aria-live="polite">
                        {a.count}
                      </span>
                      <button
                        type="button"
                        aria-label="Thêm một người"
                        className="size-10 rounded-full text-xl"
                        style={{ border: `1px solid ${line}` }}
                        disabled={a.count >= guest.max_party_size}
                        onClick={() => set({ count: a.count + 1 })}
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}
              </fieldset>
            );
          })}

          <label className="block text-sm">
            Lời nhắn cho chủ tiệc (không bắt buộc)
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={2}
              className="mt-1 w-full rounded-xl bg-transparent px-3 py-2 text-base"
              style={{ border: `1px solid ${line}` }}
            />
          </label>

          {!guest.consented && (
            <label className="flex items-start gap-2 text-xs leading-relaxed">
              <input type="checkbox" className="mt-0.5" checked={consent}
                onChange={(e) => {
                  setConsent(e.target.checked);
                  setError(null);
                }} />
              <span>
                Tôi đồng ý để chủ tiệc nhận câu trả lời này qua TRAO.{" "}
                <Link href="/chinh-sach-du-lieu" target="_blank" className="underline">
                  Cách TRAO dùng thông tin
                </Link>
              </span>
            </label>
          )}

          {error && (
            <p role="alert" className="text-sm font-semibold text-red-700">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="w-full rounded-full py-3 font-semibold disabled:opacity-60"
            style={{ background: accent, color: "var(--inv-bg)" }}
          >
            {busy ? "Đang gửi…" : "Gửi xác nhận"}
          </button>
          {deadline && (
            <p className="text-center text-xs opacity-70">
              Vui lòng trả lời trước {deadline.date}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
