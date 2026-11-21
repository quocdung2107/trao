"use client";

import { useState } from "react";
import type { Wish } from "@/features/invitations/public";
import { postWish } from "./actions";

const accent = "var(--inv-accent)";
const line = "var(--inv-line)";

/** Sổ lời chúc trên thiệp. Danh sách đến từ thiệp đã cache; gửi xong thì cache được làm mới. */
export function Wishes({ slug, token, wishes, defaultName }: { slug: string; token: string | null; wishes: Wish[]; defaultName?: string }) {
  const [name, setName] = useState(defaultName ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await postWish(slug, token, { name, message });
    setBusy(false);
    if (res.error) setError(res.error);
    else {
      setMessage("");
      setSent(true);
    }
  }

  return (
    <div className="text-left">
      <p className="text-center font-serif text-xl" style={{ color: accent }}>
        Gửi lời chúc
      </p>
      {sent ? (
        <p className="mt-3 text-center text-sm">Cảm ơn lời chúc của bạn!</p>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            required
            placeholder="Tên bạn"
            aria-label="Tên bạn"
            className="w-full rounded-xl bg-transparent px-3 py-2.5 text-base"
            style={{ border: `1px solid ${line}` }}
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={500}
            required
            rows={3}
            placeholder="Lời chúc của bạn"
            aria-label="Lời chúc"
            className="w-full rounded-xl bg-transparent px-3 py-2.5 text-base"
            style={{ border: `1px solid ${line}` }}
          />
          {error && (
            <p role="alert" className="text-sm font-semibold text-red-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full py-3 font-semibold disabled:opacity-60"
            style={{ background: accent, color: "var(--inv-bg)" }}
          >
            {busy ? "Đang gửi…" : "Gửi lời chúc"}
          </button>
        </form>
      )}
      {wishes.length > 0 && (
        <ul className="mt-6 space-y-3">
          {wishes.map((w, i) => (
            <li key={i} className="rounded-2xl px-4 py-3" style={{ background: "var(--inv-card)", border: `1px solid ${line}` }}>
              <p className="whitespace-pre-line text-sm leading-relaxed">{w.message}</p>
              <p className="mt-1 text-xs font-semibold" style={{ color: accent }}>
                — {w.author_name}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
