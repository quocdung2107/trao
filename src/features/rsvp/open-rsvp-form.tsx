"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { OpenRsvpStatus } from "@/features/invitations/public";
import { sessionDate } from "@/features/invitations/view";
import { getOpenRsvpStatus, submitOpenRsvp } from "./actions";
import { POLICY_VERSION } from "./policy";

const accent = "var(--inv-accent)";
const line = "var(--inv-line)";
const MAX_PARTY = 10;

const storageKey = (slug: string) => `trao:dang-ky:${slug}`;
function readToken(slug: string) {
  try {
    return window.localStorage.getItem(storageKey(slug));
  } catch {
    return null;
  }
}
function writeToken(slug: string, token: string | null) {
  try {
    if (token) window.localStorage.setItem(storageKey(slug), token);
    else window.localStorage.removeItem(storageKey(slug));
  } catch {
    // Trình duyệt chặn lưu trữ (chế độ ẩn danh…): vẫn gửi được, chỉ không xem lại trạng thái.
  }
}

type Props = {
  slug: string;
  sessions: { id: string; name: string }[];
  deadline: string | null;
  closed: boolean;
};

/**
 * Đăng ký tham dự trên link chung (RSVP mở). Người đăng ký vào hàng chờ; khi chủ tiệc duyệt,
 * lần mở thiệp sau sẽ thấy nút mở thiệp cá nhân (RSVP, thẻ QR). Token giữ trong trình duyệt.
 */
export function OpenRsvpForm({ slug, sessions, deadline, closed }: Props) {
  const [status, setStatus] = useState<OpenRsvpStatus | null>(null);
  const [checked, setChecked] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [count, setCount] = useState(1);
  const [picked, setPicked] = useState<string[]>(() => sessions.map((s) => s.id));
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Đã đăng ký từ trước trên máy này → hiện trạng thái thay vì form.
  useEffect(() => {
    let live = true;
    Promise.resolve(readToken(slug))
      .then((token) => (token ? getOpenRsvpStatus(slug, token) : null))
      .then((s) => {
        if (!live) return;
        if (!s) writeToken(slug, null);
        setStatus(s);
      })
      .catch(() => {})
      .finally(() => live && setChecked(true));
    return () => {
      live = false;
    };
  }, [slug]);

  if (sessions.length === 0) return null;
  const due = deadline ? sessionDate(deadline) : null;

  async function submit() {
    setError(null);
    if (!consent) {
      setError("Hãy đánh dấu đồng ý ở ô bên dưới.");
      return;
    }
    setBusy(true);
    const res = await submitOpenRsvp(slug, {
      name,
      phone,
      partySize: count,
      sessionIds: picked,
      note,
      consentVersion: POLICY_VERSION,
    });
    setBusy(false);
    if (res.error || !res.token) {
      setError(res.error ?? "Chưa gửi được.");
      return;
    }
    writeToken(slug, res.token);
    setStatus({ status: "pending", name: name.trim(), party_size: count, guest_token: null });
  }

  function registerAnother() {
    writeToken(slug, null);
    setStatus(null);
    setName("");
    setPhone("");
    setNote("");
    setCount(1);
    setConsent(false);
  }

  const box = { background: "var(--inv-card)", border: `1px solid ${line}` };

  return (
    <div id="dang-ky" className="rounded-2xl px-5 py-6 text-left" style={box}>
      <p className="text-center font-serif text-xl" style={{ color: accent }}>
        Đăng ký tham dự
      </p>

      {!checked ? (
        <p className="mt-4 text-center text-sm opacity-70">Đang tải…</p>
      ) : status ? (
        <div className="mt-4 space-y-3 text-center">
          {status.status === "approved" && status.guest_token ? (
            <>
              <p>
                Chủ tiệc đã xác nhận <strong>{status.name}</strong> ({status.party_size} người).
              </p>
              <Link
                href={`/${slug}?g=${status.guest_token}`}
                className="inline-block rounded-full px-6 py-3 font-semibold"
                style={{ background: accent, color: "var(--inv-bg)" }}
              >
                Mở thiệp của bạn
              </Link>
              <p className="text-xs opacity-70">Trong thiệp của bạn có thẻ vào tiệc (mã QR) và chỗ sửa câu trả lời.</p>
            </>
          ) : status.status === "rejected" ? (
            <p className="text-sm">
              Chủ tiệc chưa xác nhận được đăng ký của <strong>{status.name}</strong>. Vui lòng liên hệ trực tiếp chủ tiệc.
            </p>
          ) : (
            <>
              <p>
                Đã gửi đăng ký của <strong>{status.name}</strong> ({status.party_size} người).
              </p>
              <p className="text-sm opacity-80">
                Chủ tiệc sẽ xác nhận sớm. Bạn mở lại thiệp này trên máy này để xem kết quả.
              </p>
            </>
          )}
          <button type="button" className="text-sm font-semibold underline" style={{ color: accent }} onClick={registerAnother}>
            Đăng ký cho người khác
          </button>
        </div>
      ) : closed ? (
        <p className="mt-4 text-center text-sm">Đã quá hạn đăng ký. Vui lòng liên hệ trực tiếp chủ tiệc.</p>
      ) : (
        <div className="mt-4 space-y-4">
          <label className="block text-sm">
            Tên của bạn
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              maxLength={150}
              autoComplete="name"
              placeholder="Vd: Anh Tú và vợ"
              className="mt-1 w-full rounded-xl bg-transparent px-3 py-2.5 text-base"
              style={{ border: `1px solid ${line}` }}
            />
          </label>
          <label className="block text-sm">
            Số điện thoại <span className="opacity-70">(không bắt buộc)</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={30}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              className="mt-1 w-full rounded-xl bg-transparent px-3 py-2.5 text-base"
              style={{ border: `1px solid ${line}` }}
            />
            <span className="mt-1 block text-xs opacity-70">Giúp chủ tiệc nhận ra bạn khi có người trùng tên.</span>
          </label>

          {sessions.length > 1 && (
            <fieldset>
              <legend className="mb-2 text-sm">Bạn sẽ đến</legend>
              <div className="space-y-2">
                {sessions.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={picked.includes(s.id)}
                      onChange={(e) => {
                        setPicked(e.target.checked ? [...picked, s.id] : picked.filter((x) => x !== s.id));
                        setError(null);
                      }}
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">Số người đi (cả bạn)</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Bớt một người"
                className="size-10 rounded-full text-xl"
                style={{ border: `1px solid ${line}` }}
                disabled={count <= 1}
                onClick={() => setCount(count - 1)}
              >
                −
              </button>
              <span className="w-6 text-center text-lg font-semibold tabular-nums" aria-live="polite">
                {count}
              </span>
              <button
                type="button"
                aria-label="Thêm một người"
                className="size-10 rounded-full text-xl"
                style={{ border: `1px solid ${line}` }}
                disabled={count >= MAX_PARTY}
                onClick={() => setCount(count + 1)}
              >
                +
              </button>
            </div>
          </div>

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

          <label className="flex items-start gap-2 text-xs leading-relaxed">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
                setError(null);
              }}
            />
            <span>
              Tôi đồng ý để chủ tiệc nhận thông tin đăng ký này qua TRAO.{" "}
              <Link href="/chinh-sach-du-lieu" target="_blank" className="underline">
                Cách TRAO dùng thông tin
              </Link>
            </span>
          </label>

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
            {busy ? "Đang gửi…" : "Gửi đăng ký"}
          </button>
          <p className="text-center text-xs opacity-70">
            Chủ tiệc sẽ xác nhận trước khi bạn có tên trong danh sách khách.
            {due && ` Hạn đăng ký: ${due.date}.`}
          </p>
        </div>
      )}
    </div>
  );
}
