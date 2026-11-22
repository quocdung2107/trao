import "server-only";
import writeXlsxFile, { type Cell, type SheetData } from "write-excel-file/node";
import { GUEST_SIDES, RSVP_STATUS, label } from "@/lib/labels";
import { displayPhone } from "./normalize";

type Invite = {
  session_id: string;
  rsvp: string;
  attending: number | null;
  note: string | null;
  responded_at: string | null;
  tables: string[];
  arrived_at: string | null;
  arrived_count: number | null;
};
export type ExportData = {
  title: string;
  sessions: { id: string; name: string }[];
  guests: {
    name: string;
    salutation: string | null;
    phone: string | null;
    email: string | null;
    side: string | null;
    max_party_size: number;
    notes: string | null;
    invite_sent_at: string | null;
    groups: string[];
    invites: Invite[];
  }[];
};

const header = (titles: string[]): Cell[] => titles.map((t) => ({ value: t, fontWeight: "bold" as const }));
// Excel không có múi giờ: ghi ngày giờ Việt Nam dưới dạng chữ cho dễ đọc, không lệch giờ.
const vnTime = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(iso))
    : null;
// Tên sheet: tối đa 31 ký tự, không có : \ / ? * [ ]
const sheetName = (s: string, used: Set<string>) => {
  const base = s.replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 28) || "Buổi";
  let name = base;
  for (let i = 2; used.has(name); i++) name = `${base.slice(0, 26)} ${i}`;
  used.add(name);
  return name;
};

/** File Excel: sheet "Khách mời" + một sheet cho mỗi buổi tiệc (trả lời, bàn, check-in). */
export async function buildGuestWorkbook(data: ExportData) {
  const used = new Set<string>(["Khách mời"]);
  const all: SheetData = [
    header(["Tên khách", "Xưng hô", "Số điện thoại", "Email", "Bên", "Nhóm", "Số người tối đa", "Đã gửi thiệp", "Ghi chú"]),
    ...data.guests.map((g) => [
      g.name,
      g.salutation,
      displayPhone(g.phone) || null,
      g.email,
      g.side ? label(GUEST_SIDES, g.side) : null,
      g.groups.join(", ") || null,
      g.max_party_size,
      vnTime(g.invite_sent_at),
      g.notes,
    ]),
  ];

  const perSession = data.sessions.map((s) => {
    const rows: SheetData = [
      header(["Tên khách", "Số điện thoại", "Bên", "Nhóm", "Trả lời", "Số người", "Lời nhắn", "Trả lời lúc", "Bàn", "Đã đến lúc", "Số người đến"]),
    ];
    for (const g of data.guests) {
      const i = g.invites.find((x) => x.session_id === s.id);
      if (!i) continue;
      rows.push([
        g.name,
        displayPhone(g.phone) || null,
        g.side ? label(GUEST_SIDES, g.side) : null,
        g.groups.join(", ") || null,
        label(RSVP_STATUS, i.rsvp),
        i.rsvp === "yes" ? i.attending : null,
        i.note,
        vnTime(i.responded_at),
        i.tables.join(", ") || null,
        vnTime(i.arrived_at),
        i.arrived_count,
      ]);
    }
    return { data: rows, sheet: sheetName(s.name, used), columns: [{ width: 28 }, { width: 14 }, { width: 10 }, { width: 18 }, { width: 13 }, { width: 9 }, { width: 30 }, { width: 17 }, { width: 12 }, { width: 17 }, { width: 12 }] };
  });

  return writeXlsxFile([
    {
      data: all,
      sheet: "Khách mời",
      columns: [{ width: 28 }, { width: 16 }, { width: 14 }, { width: 24 }, { width: 10 }, { width: 18 }, { width: 10 }, { width: 17 }, { width: 30 }],
      stickyRowsCount: 1,
    },
    ...perSession.map((p) => ({ ...p, stickyRowsCount: 1 })),
  ]).toBuffer();
}
