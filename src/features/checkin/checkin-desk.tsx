"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { tokenFromQr } from "./qr-token";
import { QrScanner } from "./qr-scanner";

type Found = {
  invite_id: string;
  name: string;
  salutation: string | null;
  rsvp: "pending" | "yes" | "no" | "maybe";
  party: number;
  phone_last3: string | null;
  tables: string[];
  checked_in: { id: string; at: string; count: number; by: string; mine: boolean } | null;
};
type Summary = { guests_expected: number; people_expected: number; guests_arrived: number; people_arrived: number };
type Panel = {
  guest: Found;
  method: "qr" | "search";
  clientId: string;
  count: number;
  stage: "confirm" | "done" | "duplicate" | "note";
  first?: { at: string; count: number; by: string } | null;
  note?: string;
};

const time = (iso: string) =>
  new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

function deviceId() {
  try {
    let id = localStorage.getItem("trao-device");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("trao-device", id);
    }
    return id;
  } catch {
    return null;
  }
}

/** Màn check-in tại sảnh: tìm theo tên / số cuối SĐT hoặc quét QR → số bàn thật to → xác nhận số người. */
export function CheckinDesk({ sessionId, canVoidAll }: { sessionId: string; canVoidAll: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Found[]>([]);
  const [searched, setSearched] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [scanning, setScanning] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const qRef = useRef(q);
  useEffect(() => {
    qRef.current = q;
  }, [q]);

  const loadSummary = useCallback(async () => {
    const { data } = await supabase.rpc("checkin_summary", { p_session_id: sessionId });
    if (data) setSummary(data as unknown as Summary);
  }, [supabase, sessionId]);

  const search = useCallback(
    async (query: string) => {
      const { data, error } = await supabase.rpc("checkin_find", { p_session_id: sessionId, p_query: query });
      if (error) {
        setNotice("Không tra cứu được. Kiểm tra kết nối mạng.");
        return;
      }
      setItems(((data as { items: Found[] }).items ?? []) as Found[]);
      setSearched(query.trim().length > 0);
    },
    [supabase, sessionId],
  );

  // Gõ tới đâu tìm tới đó (chờ 250 ms sau phím cuối).
  useEffect(() => {
    const t = setTimeout(() => search(q), 250);
    return () => clearTimeout(t);
  }, [q, search]);

  // Máy khác check-in → cập nhật số liệu và kết quả đang xem.
  useEffect(() => {
    const first = setTimeout(loadSummary, 0);
    const channel = supabase
      .channel(`checkins:${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "checkins", filter: `session_id=eq.${sessionId}` }, () => {
        loadSummary();
        if (qRef.current.trim()) search(qRef.current);
      })
      .subscribe();
    return () => {
      clearTimeout(first);
      supabase.removeChannel(channel);
    };
  }, [supabase, sessionId, loadSummary, search]);

  function open(guest: Found, method: Panel["method"]) {
    setNotice(null);
    setPanel({
      guest,
      method,
      clientId: crypto.randomUUID(),
      count: guest.party,
      stage: guest.checked_in ? "duplicate" : "confirm",
      first: guest.checked_in,
    });
  }

  async function onScan(text: string) {
    const token = tokenFromQr(text);
    setScanning(false);
    if (!token) {
      setNotice("Mã QR này không phải thẻ vào tiệc của TRAO.");
      return;
    }
    const { data, error } = await supabase.rpc("checkin_find", { p_session_id: sessionId, p_token: token });
    if (error) {
      setNotice("Không tra cứu được. Kiểm tra kết nối mạng.");
      return;
    }
    const res = data as { items: Found[]; not_invited?: string | null };
    if (res.items?.[0]) open(res.items[0], "qr");
    else if (res.not_invited) setNotice(`${res.not_invited} không được mời buổi này. Hãy hỏi chủ tiệc.`);
    else setNotice("Không tìm thấy khách với mã này.");
  }

  async function confirm(note?: string) {
    if (!panel) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("checkin", {
      p_id: panel.clientId,
      p_invite_id: panel.guest.invite_id,
      p_arrived: panel.count,
      p_method: panel.method,
      p_device_id: deviceId() ?? undefined,
      p_client_at: new Date().toISOString(),
      p_note: note,
    });
    setBusy(false);
    if (error) {
      setNotice("Chưa ghi được. Kiểm tra mạng rồi bấm lại (sẽ không bị tính hai lần).");
      return;
    }
    const res = data as { result: "ok" | "duplicate"; first: Panel["first"] };
    if (res.result === "ok" || note !== undefined) {
      setPanel({ ...panel, stage: "done" });
      setQ("");
      setItems([]);
      setTimeout(() => setPanel((p) => (p?.clientId === panel.clientId ? null : p)), 1800);
    } else {
      // Máy khác vừa check-in trước.
      setPanel({ ...panel, stage: "duplicate", first: res.first, clientId: crypto.randomUUID() });
    }
    loadSummary();
  }

  async function voidCheckin() {
    const id = panel?.guest.checked_in?.id;
    if (!id) return;
    setBusy(true);
    const { error } = await supabase.rpc("checkin_void", { p_checkin_id: id, p_reason: "Hủy tại sảnh" });
    setBusy(false);
    if (error) {
      setNotice("Không hủy được lượt này.");
      return;
    }
    setPanel(null);
    setNotice(`Đã hủy check-in của ${panel!.guest.name}.`);
    loadSummary();
    if (q.trim()) search(q);
  }

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 gap-3 text-center" aria-live="polite">
          <div className="rounded-xl bg-surface p-3 ring-1 ring-border">
            <p className="text-xs text-muted">Người đã đến</p>
            <p className="text-3xl font-bold tabular-nums">
              {summary.people_arrived}
              <span className="text-base font-normal text-muted">/{summary.people_expected}</span>
            </p>
          </div>
          <div className="rounded-xl bg-surface p-3 ring-1 ring-border">
            <p className="text-xs text-muted">Khách đã đến</p>
            <p className="text-3xl font-bold tabular-nums">
              {summary.guests_arrived}
              <span className="text-base font-normal text-muted">/{summary.guests_expected}</span>
            </p>
          </div>
        </div>
      )}

      {scanning ? (
        <QrScanner onResult={onScan} onClose={() => setScanning(false)} />
      ) : (
        <button
          type="button"
          onClick={() => {
            setNotice(null);
            setScanning(true);
          }}
          className="w-full rounded-2xl bg-brand py-4 text-lg font-bold text-white"
        >
          Quét mã QR
        </button>
      )}

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Tìm tên hoặc 3–4 số cuối SĐT"
        aria-label="Tìm khách"
        inputMode="search"
        className="w-full rounded-2xl border-2 border-border bg-surface px-4 py-4 text-lg outline-none focus:border-brand"
      />

      {notice && (
        <p role="status" className="rounded-xl bg-accent/20 px-4 py-3 text-sm font-medium">
          {notice}
        </p>
      )}

      {items.length > 0 ? (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-surface ring-1 ring-border">
          {items.map((g) => (
            <li key={g.invite_id}>
              <button type="button" onClick={() => open(g, "search")} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-semibold">{g.name}</span>
                  <span className="text-sm text-muted">
                    {g.party} người{g.phone_last3 && ` · SĐT …${g.phone_last3}`}
                    {g.rsvp === "no" && " · đã báo không đến"}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-lg font-bold">{g.tables.join(", ") || "—"}</span>
                  {g.checked_in && <span className="text-xs font-semibold text-brand">Đã đến {time(g.checked_in.at)}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        searched && <p className="text-center text-sm text-muted">Không thấy khách nào. Thử gõ ít chữ hơn hoặc 3–4 số cuối SĐT.</p>
      )}

      {panel && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Check-in ${panel.guest.name}`}
          className={`fixed inset-0 z-20 flex flex-col overflow-y-auto px-6 py-8 text-center ${
            panel.stage === "done" ? "bg-brand text-white" : panel.stage === "confirm" ? "bg-surface" : "bg-amber-100 text-amber-950"
          }`}
        >
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4">
            <p className="text-sm font-semibold uppercase tracking-widest opacity-70">{panel.guest.tables.length > 1 ? "Các bàn" : "Bàn"}</p>
            <p className="font-serif text-7xl font-bold leading-none sm:text-8xl" data-testid="table-label">
              {panel.guest.tables.length ? panel.guest.tables.map((t) => t.replace(/^Bàn\s+/i, "")).join(", ") : "Chưa xếp"}
            </p>
            <p className="text-2xl font-semibold">{panel.guest.name}</p>

            {panel.stage === "done" && <p className="text-xl font-bold">✓ Đã check-in {panel.count} người</p>}

            {panel.stage === "confirm" && (
              <>
                <p className="text-muted">Dự kiến {panel.guest.party} người</p>
                <div className="flex items-center justify-center gap-6">
                  <button
                    type="button"
                    aria-label="Bớt một người"
                    disabled={panel.count <= 1}
                    onClick={() => setPanel({ ...panel, count: panel.count - 1 })}
                    className="size-16 rounded-full border-2 border-border text-3xl disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="w-16 text-5xl font-bold tabular-nums" aria-live="polite" aria-label="Số người đến">
                    {panel.count}
                  </span>
                  <button
                    type="button"
                    aria-label="Thêm một người"
                    disabled={panel.count >= 50}
                    onClick={() => setPanel({ ...panel, count: panel.count + 1 })}
                    className="size-16 rounded-full border-2 border-border text-3xl disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => confirm()}
                  className="mt-2 w-full rounded-2xl bg-brand py-4 text-xl font-bold text-white disabled:opacity-60"
                >
                  {busy ? "Đang ghi…" : "Xác nhận"}
                </button>
              </>
            )}

            {(panel.stage === "duplicate" || panel.stage === "note") && panel.first && (
              <>
                <p className="rounded-xl bg-amber-200 px-4 py-3 text-lg font-semibold">
                  Đã check-in lúc {time(panel.first.at)} bởi {panel.first.by}, {panel.first.count} người
                </p>
                {panel.stage === "note" ? (
                  <>
                    <input
                      autoFocus
                      value={panel.note ?? ""}
                      onChange={(e) => setPanel({ ...panel, note: e.target.value })}
                      maxLength={200}
                      placeholder="Ghi chú, vd: người nhà đến sau"
                      aria-label="Ghi chú"
                      className="w-full rounded-xl border-2 border-amber-300 bg-white px-4 py-3 text-base"
                    />
                    <button
                      type="button"
                      disabled={busy || !panel.note?.trim()}
                      onClick={() => confirm(panel.note!.trim())}
                      className="w-full rounded-2xl bg-amber-600 py-4 text-lg font-bold text-white disabled:opacity-50"
                    >
                      Ghi chú và cho vào
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPanel({ ...panel, stage: "note" })}
                    className="w-full rounded-2xl bg-amber-600 py-4 text-lg font-bold text-white"
                  >
                    Vẫn cho vào (ghi chú)
                  </button>
                )}
                {panel.guest.checked_in && (panel.guest.checked_in.mine || canVoidAll) && (
                  <button type="button" disabled={busy} onClick={voidCheckin} className="text-sm font-semibold text-danger underline">
                    Hủy lượt check-in trước (nhầm người)
                  </button>
                )}
              </>
            )}

            {panel.stage !== "done" && (
              <button type="button" onClick={() => setPanel(null)} className="mt-2 text-base font-semibold underline">
                Đóng
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
