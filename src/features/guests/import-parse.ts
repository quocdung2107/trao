// Đọc và kiểm tra file danh sách khách ở trình duyệt (§6.2). File gốc không được tải lên máy chủ.
import { cleanText, normalizePhone, parseSide, splitGroups, vnFold } from "./normalize";

export type Cell = string | number | boolean | Date | null | undefined;
export type Table = Cell[][];

export const FIELDS = {
  display_name: { label: "Tên khách", required: true, keys: ["ten khach", "ho ten", "ho va ten", "ten", "khach", "name", "full name"] },
  salutation: { label: "Xưng hô", required: false, keys: ["xung ho", "danh xung", "cach goi", "goi la", "salutation"] },
  phone: { label: "Số điện thoại", required: false, keys: ["so dien thoai", "dien thoai", "sdt", "dt", "phone", "mobile", "so dt"] },
  email: { label: "Email", required: false, keys: ["email", "e-mail", "mail"] },
  side: { label: "Bên", required: false, keys: ["ben", "nha", "side", "ben nao"] },
  max_party_size: { label: "Số người", required: false, keys: ["so nguoi", "so luong", "sl", "nguoi", "so khach"] },
  groups: { label: "Nhóm", required: false, keys: ["nhom", "quan he", "moi quan he", "group"] },
  notes: { label: "Ghi chú", required: false, keys: ["ghi chu", "note", "notes"] },
} as const;
export type Field = keyof typeof FIELDS;
export type Mapping = Partial<Record<Field, number>>;

// ---------------------------------------------------------------- đọc file

/** CSV có ngoặc kép, tự nhận dấu phân cách (, ; tab). */
export function parseCsv(text: string): Table {
  const nl = text.indexOf("\n");
  const firstLine = nl === -1 ? text : text.slice(0, nl);
  const delim = [",", ";", "\t"].reduce((best, d) => (firstLine.split(d).length > firstLine.split(best).length ? d : best), ",");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === delim) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Excel lưu CSV tiếng Việt bằng UTF-8 hoặc Windows-1258 tùy máy; thử UTF-8 trước. */
export function decodeCsv(buf: ArrayBuffer) {
  const utf8 = new TextDecoder("utf-8").decode(buf);
  if (!utf8.includes("�")) return utf8.replace(/^﻿/, "");
  return new TextDecoder("windows-1258").decode(buf);
}

export async function readTable(file: File): Promise<Table> {
  if (/\.csv$/i.test(file.name) || file.type === "text/csv") return parseCsv(decodeCsv(await file.arrayBuffer()));
  if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import("read-excel-file/browser");
    return (await readSheet(file)) as Table;
  }
  throw new Error("Chỉ nhận file .xlsx hoặc .csv. File .xls cũ: mở bằng Excel rồi “Lưu thành” .xlsx.");
}

// ---------------------------------------------------------------- dòng tiêu đề & ánh xạ cột

function matchField(header: string, exact: boolean): Field | null {
  const h = vnFold(cleanText(header)).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  if (!h) return null;
  for (const [field, def] of Object.entries(FIELDS) as [Field, (typeof FIELDS)[Field]][]) {
    if (def.keys.some((k) => (exact ? h === k : k.length > 3 && h.includes(k)))) return field;
  }
  return null;
}

/** Tìm dòng tiêu đề trong 10 dòng đầu: dòng khớp nhiều tên cột nhất. */
export function detectHeader(table: Table) {
  let best = { row: -1, score: 0 };
  table.slice(0, 10).forEach((r, i) => {
    const score = r.filter((c) => matchField(String(c ?? ""), true) || matchField(String(c ?? ""), false)).length;
    if (score > best.score) best = { row: i, score };
  });
  return best.row;
}

export function guessMapping(headers: Cell[]): Mapping {
  const m: Mapping = {};
  for (const exact of [true, false]) {
    headers.forEach((h, i) => {
      const f = matchField(String(h ?? ""), exact);
      if (f && m[f] === undefined && !Object.values(m).includes(i)) m[f] = i;
    });
  }
  return m;
}

// ---------------------------------------------------------------- kiểm tra từng dòng

export type ImportRow = {
  display_name: string;
  salutation?: string;
  phone_e164?: string;
  email?: string;
  side?: "groom" | "bride" | "host";
  max_party_size?: number;
  notes?: string;
  groups?: string[];
};

export type CheckedRow = {
  line: number; // số dòng trong file (bắt đầu từ 1) để người dùng dò lại
  row: ImportRow;
  status: "ok" | "warning" | "error";
  messages: string[];
  duplicateOf?: "file" | "existing";
};

function cellText(c: Cell) {
  if (c instanceof Date) return c.toLocaleDateString("vi-VN");
  if (typeof c === "number") return String(c);
  return cleanText(c);
}

export function checkRows(
  table: Table,
  headerRow: number,
  mapping: Mapping,
  existingPhones: Set<string>,
  isWedding: boolean,
): CheckedRow[] {
  const get = (r: Cell[], f: Field) => (mapping[f] === undefined ? "" : cellText(r[mapping[f]!]));
  const seenPhones = new Map<string, number>();
  const out: CheckedRow[] = [];

  table.slice(headerRow + 1).forEach((r, idx) => {
    if (!r.some((c) => cellText(c))) return; // dòng trống
    const line = headerRow + idx + 2;
    const messages: string[] = [];
    let status: CheckedRow["status"] = "ok";
    const warn = (m: string) => {
      messages.push(m);
      if (status === "ok") status = "warning";
    };

    const name = get(r, "display_name").slice(0, 150);
    const row: ImportRow = { display_name: name };
    if (!name) {
      messages.push("Thiếu tên khách");
      status = "error";
    }

    const salutation = get(r, "salutation");
    if (salutation) row.salutation = salutation.slice(0, 150);

    let duplicateOf: CheckedRow["duplicateOf"];
    const rawPhone = get(r, "phone");
    const phone = normalizePhone(rawPhone);
    if (phone === "invalid") warn(`SĐT “${rawPhone}” không nhận ra, sẽ để trống`);
    else if (phone) {
      row.phone_e164 = phone;
      if (existingPhones.has(phone)) {
        duplicateOf = "existing";
        warn("Trùng SĐT với khách đã có");
      } else if (seenPhones.has(phone)) {
        duplicateOf = "file";
        warn(`Trùng SĐT với dòng ${seenPhones.get(phone)}`);
      }
      if (!seenPhones.has(phone)) seenPhones.set(phone, line);
    }

    const email = get(r, "email");
    if (email) {
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) row.email = email.slice(0, 200);
      else warn(`Email “${email}” chưa đúng, sẽ để trống`);
    }

    const rawSide = get(r, "side");
    if (rawSide) {
      const side = parseSide(rawSide);
      if (side && (isWedding || side === "host")) row.side = side;
      else warn(`Bên “${rawSide}” không nhận ra (dùng Nhà trai / Nhà gái)`);
    }

    const rawSize = get(r, "max_party_size");
    if (rawSize) {
      const n = Number(rawSize.replace(",", "."));
      if (Number.isInteger(n) && n >= 1 && n <= 50) row.max_party_size = n;
      else warn(`Số người “${rawSize}” không hợp lệ, dùng 1`);
    }

    const groups = splitGroups(get(r, "groups")).slice(0, 10);
    if (groups.length) row.groups = groups;
    const notes = get(r, "notes");
    if (notes) row.notes = notes.slice(0, 1000);

    out.push({ line, row, status, messages, duplicateOf });
  });
  return out;
}
