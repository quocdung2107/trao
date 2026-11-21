"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, Select } from "@/components/ui";
import { GUEST_SIDES, label } from "@/lib/labels";
import { importGuests } from "./actions";
import { FIELDS, checkRows, detectHeader, guessMapping, readTable, type Field, type Mapping, type Table } from "./import-parse";
import { displayPhone } from "./normalize";

type Props = {
  eventId: string;
  isWedding: boolean;
  sessions: { id: string; name: string }[];
  existingPhones: string[];
};

type Loaded = { fileName: string; table: Table; headerRow: number };

const colName = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : `C${i + 1}`);

export function ImportWizard({ eventId, isWedding, sessions, existingPhones }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [sessionIds, setSessionIds] = useState(() => sessions.map((s) => s.id));
  const [skipExisting, setSkipExisting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [show, setShow] = useState<"all" | "issues">("issues");

  const phones = useMemo(() => new Set(existingPhones), [existingPhones]);
  const checked = useMemo(
    () => (loaded ? checkRows(loaded.table, loaded.headerRow, mapping, phones, isWedding) : []),
    [loaded, mapping, phones, isWedding],
  );
  const toImport = checked.filter((c) => c.status !== "error" && !(skipExisting && c.duplicateOf === "existing"));
  const counts = {
    ok: checked.filter((c) => c.status === "ok").length,
    warning: checked.filter((c) => c.status === "warning").length,
    error: checked.filter((c) => c.status === "error").length,
    existing: checked.filter((c) => c.duplicateOf === "existing").length,
  };

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setDone(null);
    try {
      const table = await readTable(file);
      if (!table.length) throw new Error("File không có dữ liệu.");
      const headerRow = Math.max(0, detectHeader(table));
      setLoaded({ fileName: file.name, table, headerRow });
      setMapping(guessMapping(table[headerRow] ?? []));
    } catch (e) {
      setLoaded(null);
      setError(e instanceof Error ? e.message : "Không đọc được file.");
    }
  }

  async function submit() {
    if (!loaded) return;
    setBusy(true);
    setError(null);
    const res = await importGuests(eventId, {
      fileName: loaded.fileName,
      rows: toImport.map((c) => c.row),
      sessionIds: sessionIds.length === sessions.length ? null : sessionIds,
    });
    setBusy(false);
    if (res.error) setError(res.error);
    else setDone(res.created ?? 0);
  }

  if (done !== null) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center">
        <p className="font-serif text-xl">Đã nhập {done} khách</p>
        <p className="mt-1 text-sm text-muted">Bạn có thể hoàn tác lần nhập này trong 24 giờ ở trang Khách mời.</p>
        <Link href={`/app/events/${eventId}/guests`} className="mt-4 inline-block rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white">
          Xem danh sách khách
        </Link>
      </div>
    );
  }

  const headers = loaded ? (loaded.table[loaded.headerRow] ?? []) : [];
  const width = loaded ? Math.max(...loaded.table.slice(0, 50).map((r) => r.length)) : 0;
  const visible = show === "all" ? checked : checked.filter((c) => c.status !== "ok");

  return (
    <div className="space-y-6">
      {/* Bước 1 */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-medium">1. Chọn file</h2>
        <p className="mt-1 text-sm text-muted">
          File Excel (.xlsx) hoặc .csv, mỗi dòng một khách. Chưa có file?{" "}
          <a href="/mau-danh-sach-khach.xlsx" download className="font-medium text-brand">
            Tải file mẫu
          </a>
          . File được đọc ngay trên máy bạn, không tải lên máy chủ.
        </p>
        <input
          type="file"
          accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          aria-label="File danh sách khách"
          className="mt-3 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand/10 file:px-4 file:py-2 file:font-semibold file:text-brand"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </section>

      {loaded && (
        <>
          {/* Bước 2 */}
          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="font-medium">2. Cột nào là gì?</h2>
            <p className="mt-1 text-sm text-muted">
              Dòng tiêu đề: dòng {loaded.headerRow + 1}.{" "}
              <label className="inline-flex items-center gap-1">
                Đổi:
                <Select
                  className="w-auto py-1"
                  value={loaded.headerRow}
                  aria-label="Dòng tiêu đề"
                  onChange={(e) => {
                    const headerRow = Number(e.target.value);
                    setLoaded({ ...loaded, headerRow });
                    setMapping(guessMapping(loaded.table[headerRow] ?? []));
                  }}
                >
                  {loaded.table.slice(0, 10).map((_, i) => (
                    <option key={i} value={i}>
                      Dòng {i + 1}
                    </option>
                  ))}
                </Select>
              </label>
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(Object.keys(FIELDS) as Field[])
                .filter((f) => isWedding || f !== "side")
                .map((f) => (
                  <label key={f} className="text-sm">
                    <span className="mb-1 block font-medium">
                      {FIELDS[f].label}
                      {FIELDS[f].required && <span className="text-danger"> *</span>}
                    </span>
                    <Select
                      value={mapping[f] ?? ""}
                      onChange={(e) => setMapping({ ...mapping, [f]: e.target.value === "" ? undefined : Number(e.target.value) })}
                    >
                      <option value="">— Không có —</option>
                      {Array.from({ length: width }, (_, i) => (
                        <option key={i} value={i}>
                          Cột {colName(i)}
                          {headers[i] != null && String(headers[i]).trim() ? `: ${String(headers[i]).slice(0, 30)}` : ""}
                        </option>
                      ))}
                    </Select>
                  </label>
                ))}
            </div>
          </section>

          {/* Bước 3 */}
          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="font-medium">3. Kiểm tra</h2>
            {mapping.display_name === undefined ? (
              <p className="mt-2 text-sm text-danger">Hãy chọn cột “Tên khách”.</p>
            ) : (
              <>
                <div className="mt-2 flex flex-wrap gap-2 text-sm">
                  <span className="rounded-full bg-brand/10 px-3 py-1 text-brand">{counts.ok} hợp lệ</span>
                  <span className="rounded-full bg-accent/20 px-3 py-1">{counts.warning} cần xem</span>
                  <span className="rounded-full bg-danger/10 px-3 py-1 text-danger">{counts.error} lỗi (bỏ qua)</span>
                </div>
                {counts.existing > 0 && (
                  <label className="mt-3 flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={skipExisting} onChange={(e) => setSkipExisting(e.target.checked)} />
                    Bỏ qua {counts.existing} dòng trùng SĐT với khách đã có
                  </label>
                )}
                <p className="mt-2 text-xs text-muted">
                  Trùng số điện thoại không tự gộp: vợ chồng hay dùng chung một số.
                </p>
                <div className="mt-3 flex gap-3 text-sm">
                  <button type="button" className={show === "issues" ? "font-semibold" : "text-muted"} onClick={() => setShow("issues")}>
                    Dòng cần xem
                  </button>
                  <button type="button" className={show === "all" ? "font-semibold" : "text-muted"} onClick={() => setShow("all")}>
                    Tất cả
                  </button>
                </div>
                <div className="mt-2 max-h-96 overflow-auto rounded-lg border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-background text-xs text-muted">
                      <tr>
                        <th className="px-2 py-1.5">Dòng</th>
                        <th className="min-w-40 px-2 py-1.5">Tên</th>
                        <th className="px-2 py-1.5">SĐT</th>
                        <th className="px-2 py-1.5">Người</th>
                        <th className="px-2 py-1.5">Nhóm / bên</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {visible.slice(0, 300).map((c) => (
                        <tr key={c.line} className={c.status === "error" ? "bg-danger/5" : c.status === "warning" ? "bg-accent/10" : ""}>
                          <td className="px-2 py-1.5 text-muted">{c.line}</td>
                          <td className="px-2 py-1.5">
                            {c.row.display_name || "—"}
                            {c.row.salutation && c.row.salutation !== c.row.display_name && (
                              <span className="block text-xs text-muted">“{c.row.salutation}”</span>
                            )}
                            {c.messages.length > 0 && (
                              <span className={`block text-xs ${c.status === "error" ? "text-danger" : "text-foreground"}`}>
                                {c.messages.join("; ")}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap">{displayPhone(c.row.phone_e164 ?? null)}</td>
                          <td className="px-2 py-1.5">{c.row.max_party_size ?? 1}</td>
                          <td className="px-2 py-1.5 text-xs">
                            {[...(c.row.groups ?? []), c.row.side ? label(GUEST_SIDES, c.row.side) : null].filter(Boolean).join(", ")}
                          </td>
                        </tr>
                      ))}
                      {visible.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-2 py-6 text-center text-muted">
                            Không có dòng nào cần xem.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {visible.length > 300 && <p className="mt-1 text-xs text-muted">Đang hiện 300 dòng đầu.</p>}
              </>
            )}
          </section>

          {/* Bước 4 */}
          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="font-medium">4. Nhập</h2>
            {sessions.length > 1 && (
              <fieldset className="mt-2">
                <legend className="mb-1 text-sm">Mời các khách này dự buổi:</legend>
                <div className="flex flex-wrap gap-2">
                  {sessions.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={sessionIds.includes(s.id)}
                        onChange={(e) =>
                          setSessionIds(e.target.checked ? [...sessionIds, s.id] : sessionIds.filter((x) => x !== s.id))
                        }
                      />
                      {s.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {error && (
              <p role="alert" className="mt-3 text-sm text-danger">
                {error}
              </p>
            )}
            <Button
              type="button"
              className="mt-4"
              disabled={busy || mapping.display_name === undefined || toImport.length === 0 || toImport.length > 3000}
              onClick={submit}
            >
              {busy ? "Đang nhập…" : `Nhập ${toImport.length} khách`}
            </Button>
            {toImport.length > 3000 && <p className="mt-2 text-sm text-danger">Mỗi lần nhập tối đa 3000 dòng. Hãy chia nhỏ file.</p>}
          </section>
        </>
      )}

      {!loaded && error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
