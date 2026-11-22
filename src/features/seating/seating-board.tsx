"use client";

import { useMemo, useState, useTransition } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Input, Select } from "@/components/ui";
import { vnFold } from "@/features/guests/normalize";
import { GUEST_SIDES, RSVP_STATUS, label } from "@/lib/labels";
import { assignSeats, deleteTable, unassignSeats, updateTable, type AssignResult } from "./actions";
import type { Party, SeatingData } from "./queries";

type Warning = Extract<AssignResult, { reason: "over_capacity" }> & { tableId: string; ids: string[] };

const linkBtn = "text-sm font-medium text-brand disabled:opacity-50";

function fillTone(used: number, capacity: number) {
  if (used > capacity) return { bar: "bg-danger", text: "text-danger" };
  if (used >= capacity * 0.8) return { bar: "bg-accent", text: "text-foreground" };
  return { bar: "bg-brand", text: "text-muted" };
}

/** Màn xếp bàn: chọn khách bên "Chưa xếp" (hoặc trong bàn để đổi chỗ) → chọn bàn → xếp. Không kéo thả. */
export function SeatingBoard({ data }: { data: SeatingData }) {
  const { tables, seats, parties, groups } = data;
  const [tab, setTab] = useState<"guests" | "tables">("guests");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const [side, setSide] = useState("");
  const [rsvp, setRsvp] = useState("");
  const [target, setTarget] = useState("");
  const [warning, setWarning] = useState<Warning | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const byId = useMemo(() => new Map(parties.map((p) => [p.inviteId, p])), [parties]);
  const seatsByTable = useMemo(() => {
    const m = new Map<string, { party: Party; seats: number }[]>();
    for (const s of seats) {
      const party = byId.get(s.session_invite_id);
      if (!party) continue; // khách đã xóa
      m.set(s.table_id, [...(m.get(s.table_id) ?? []), { party, seats: s.seats }]);
    }
    for (const list of m.values()) list.sort((a, b) => a.party.name.localeCompare(b.party.name, "vi"));
    return m;
  }, [seats, byId]);
  const seated = useMemo(() => new Set(seats.filter((s) => byId.has(s.session_invite_id)).map((s) => s.session_invite_id)), [seats, byId]);
  const used = (tableId: string) => (seatsByTable.get(tableId) ?? []).reduce((n, x) => n + x.seats, 0);

  const waiting = parties.filter((p) => p.rsvp !== "no" && !seated.has(p.inviteId));
  const fq = vnFold(q);
  const shown = waiting.filter(
    (p) =>
      (!fq || p.search.includes(fq)) &&
      (!group || p.groupIds.includes(group)) &&
      (!side || p.side === side) &&
      (!rsvp || p.rsvp === rsvp),
  );
  const selectedSeats = [...selected].reduce((n, id) => n + (byId.get(id)?.needed ?? 0), 0);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    setWarning(null);
    setError(null);
  }

  function run(tableId: string, ids: string[], allowOver: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await assignSeats(tableId, ids, allowOver);
      if (res.ok) {
        setSelected(new Set());
        setWarning(null);
        setTarget("");
      } else if (res.reason === "over_capacity") setWarning({ ...res, tableId, ids });
      else setError(res.error);
    });
  }

  function unassign(ids: string[]) {
    setError(null);
    startTransition(async () => {
      const res = await unassignSeats(ids);
      if (res.error) setError(res.error);
      else setSelected((s) => new Set([...s].filter((id) => !ids.includes(id))));
    });
  }

  const tabBtn = (key: typeof tab, text: string) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      aria-pressed={tab === key}
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${tab === key ? "bg-brand text-white" : "text-muted"}`}
    >
      {text}
    </button>
  );

  return (
    <div className="space-y-4 pb-28">
      <div className="flex gap-1 rounded-xl border border-border bg-surface p-1 md:hidden">
        {tabBtn("guests", `Chưa xếp (${waiting.length})`)}
        {tabBtn("tables", `Bàn (${tables.length})`)}
      </div>

      <div className="grid gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* ---------------- Chưa xếp */}
        <section className={`${tab === "guests" ? "" : "hidden"} space-y-3 md:block`} aria-label="Khách chưa xếp">
          <h2 className="hidden font-serif text-lg md:block">Chưa xếp ({waiting.length})</h2>
          <div className="grid grid-cols-2 gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tên…" aria-label="Tìm khách" className="col-span-2" />
            <Select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Lọc theo nhóm" className="text-sm">
              <option value="">Mọi nhóm</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
            <Select value={side} onChange={(e) => setSide(e.target.value)} aria-label="Lọc theo bên" className="text-sm">
              <option value="">Mọi bên</option>
              {Object.entries(GUEST_SIDES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
            <Select value={rsvp} onChange={(e) => setRsvp(e.target.value)} aria-label="Lọc theo trả lời" className="col-span-2 text-sm">
              <option value="">Mọi câu trả lời</option>
              <option value="yes">{RSVP_STATUS.yes}</option>
              <option value="maybe">{RSVP_STATUS.maybe}</option>
              <option value="pending">{RSVP_STATUS.pending}</option>
            </Select>
          </div>
          {shown.length > 0 && (
            <button
              type="button"
              className={linkBtn}
              onClick={() => {
                const all = shown.every((p) => selected.has(p.inviteId));
                const next = new Set(selected);
                for (const p of shown) {
                  if (all) next.delete(p.inviteId);
                  else next.add(p.inviteId);
                }
                setSelected(next);
              }}
            >
              {shown.every((p) => selected.has(p.inviteId)) ? "Bỏ chọn tất cả" : `Chọn cả ${shown.length} khách đang lọc`}
            </button>
          )}
          {waiting.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
              {parties.length === 0 ? "Buổi này chưa có khách được mời." : "Đã xếp hết khách. 🎉"}
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
              {shown.map((p) => (
                <li key={p.inviteId}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
                    <input type="checkbox" className="size-5 accent-brand" checked={selected.has(p.inviteId)} onChange={() => toggle(p.inviteId)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="text-xs text-muted">
                        {[p.side && label(GUEST_SIDES, p.side), label(RSVP_STATUS, p.rsvp)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-muted">{p.needed} chỗ</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------------- Bàn */}
        <section className={`${tab === "tables" ? "" : "hidden"} space-y-3 md:block`} aria-label="Bàn">
          <h2 className="hidden font-serif text-lg md:block">Bàn ({tables.length})</h2>
          {tables.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">Chưa có bàn. Tạo nhanh ở trên.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {tables.map((t) => {
                const list = seatsByTable.get(t.id) ?? [];
                const u = used(t.id);
                const tone = fillTone(u, t.capacity);
                return (
                  <li key={t.id} className="rounded-xl border border-border bg-surface p-3" data-table={t.label}>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-semibold">
                        {t.label}
                        {t.zone && <span className="font-normal text-muted"> · {t.zone}</span>}
                      </p>
                      <span className={`text-sm tabular-nums ${tone.text}`}>
                        {u}/{t.capacity}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-background" aria-hidden>
                      <div className={`h-full ${tone.bar}`} style={{ width: `${Math.min(100, (u / t.capacity) * 100)}%` }} />
                    </div>
                    {u > t.capacity && <p className="mt-1 text-xs font-semibold text-danger">Vượt {u - t.capacity} chỗ (ghế phụ)</p>}
                    {list.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {list.map(({ party, seats: n }) => (
                          <li key={party.inviteId} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              className="size-4 accent-brand"
                              aria-label={`Chọn ${party.name} để đổi bàn`}
                              checked={selected.has(party.inviteId)}
                              onChange={() => toggle(party.inviteId)}
                            />
                            <span className="min-w-0 flex-1 truncate">
                              {party.name}
                              {party.rsvp === "no" && <span className="ml-1 text-xs font-semibold text-danger">báo không đến</span>}
                            </span>
                            <span className="tabular-nums text-muted">{n}</span>
                            <button
                              type="button"
                              disabled={pending}
                              className="text-xs text-danger disabled:opacity-50"
                              onClick={() => unassign([party.inviteId])}
                              aria-label={`Bỏ ${party.name} khỏi ${t.label}`}
                            >
                              Bỏ
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-muted">Sửa bàn</summary>
                      <ActionForm action={updateTable.bind(null, t.id)} className="mt-2 grid grid-cols-[1fr_5rem] gap-2">
                        <Input name="label" defaultValue={t.label} maxLength={40} aria-label="Tên bàn" className="py-1.5 text-sm" />
                        <Input name="capacity" type="number" min={1} max={100} defaultValue={t.capacity} aria-label="Sức chứa" className="py-1.5 text-sm" />
                        <Input name="zone" defaultValue={t.zone ?? ""} maxLength={60} placeholder="Khu vực" aria-label="Khu vực" className="col-span-2 py-1.5 text-sm" />
                        <SubmitButton className={linkBtn} pendingText="Đang lưu…">
                          Lưu
                        </SubmitButton>
                      </ActionForm>
                      <ActionForm
                        action={async () => deleteTable(t.id)}
                        confirm={list.length ? `Xóa ${t.label}? ${list.length} khách sẽ về "Chưa xếp".` : `Xóa ${t.label}?`}
                        className="mt-1"
                      >
                        <SubmitButton className="text-xs text-danger">Xóa bàn</SubmitButton>
                      </ActionForm>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* ---------------- Thanh thao tác */}
      {(selected.size > 0 || error) && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface/95 px-4 py-3 shadow-lg backdrop-blur">
          <div className="mx-auto max-w-5xl space-y-2">
            {warning ? (
              <div role="alertdialog" aria-label="Bàn không đủ chỗ" className="space-y-2">
                <p className="text-sm">
                  <b>{warning.label}</b> còn {Math.max(warning.capacity - warning.used, 0)} chỗ, nhóm cần {warning.needed}.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="rounded-lg border border-border px-3 py-2 text-sm font-semibold" onClick={() => setWarning(null)}>
                    Chọn bàn khác
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded-lg bg-danger px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    onClick={() => run(warning.tableId, warning.ids, true)}
                  >
                    Vẫn xếp (ghế phụ)
                  </button>
                </div>
              </div>
            ) : (
              selected.size > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm">
                    Đã chọn <b>{selected.size}</b> khách · {selectedSeats} chỗ
                  </span>
                  <Select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Chọn bàn" className="w-auto min-w-36 flex-1 py-2 text-sm">
                    <option value="">Chọn bàn…</option>
                    {tables.map((t) => {
                      const free = t.capacity - used(t.id);
                      return (
                        <option key={t.id} value={t.id}>
                          {t.label} · {free >= 0 ? `còn ${free}` : `vượt ${-free}`}
                        </option>
                      );
                    })}
                  </Select>
                  <button
                    type="button"
                    disabled={!target || pending}
                    className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    onClick={() => run(target, [...selected], false)}
                  >
                    {pending ? "Đang xếp…" : "Xếp vào bàn"}
                  </button>
                  {[...selected].some((id) => seated.has(id)) && (
                    <button type="button" disabled={pending} className="text-sm text-danger" onClick={() => unassign([...selected].filter((id) => seated.has(id)))}>
                      Bỏ xếp
                    </button>
                  )}
                  <button type="button" className="text-sm text-muted" onClick={() => setSelected(new Set())}>
                    Bỏ chọn
                  </button>
                </div>
              )
            )}
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
