// Chuẩn hóa dữ liệu khách — dùng chung cho form thêm khách (server) và nhập file (trình duyệt).

/** Bỏ dấu tiếng Việt + chữ thường, khớp với private.vn_fold trong DB. */
export function vnFold(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

/** Gộp khoảng trắng thừa, chuẩn hóa Unicode (Excel đôi khi lưu chữ có dấu ở dạng tổ hợp). */
export function cleanText(s: unknown) {
  if (s == null) return "";
  return String(s).normalize("NFC").replace(/\s+/g, " ").trim();
}

/**
 * SĐT về dạng E.164. Số Việt Nam: 0912 345 678 / 84912345678 / +84 912… → +84912345678.
 * Trả null khi trống; "invalid" khi có nội dung nhưng không nhận ra.
 */
export function normalizePhone(raw: unknown): string | null | "invalid" {
  const s = cleanText(raw);
  if (!s) return null;
  const plus = s.startsWith("+");
  let d = s.replace(/[^\d]/g, "");
  if (!d) return "invalid";
  // Excel hay làm mất số 0 đầu: 912345678 (9 số, đầu 3/5/7/8/9) → 0912345678.
  if (!plus && d.length === 9 && /^[35789]/.test(d)) d = "0" + d;
  if (!plus && d.length === 10 && d.startsWith("0")) return "+84" + d.slice(1);
  if (!plus && d.length === 11 && d.startsWith("84")) return "+" + d;
  if (plus && /^[1-9]\d{7,14}$/.test(d)) return "+" + d;
  return "invalid";
}

/** "0912345678" để hiển thị cho số Việt Nam; số nước ngoài giữ dạng +… */
export function displayPhone(e164: string | null) {
  if (!e164) return "";
  if (e164.startsWith("+84")) {
    const d = "0" + e164.slice(3);
    return d.length === 10 ? `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : d;
  }
  return e164;
}

const SIDE_WORDS: Record<string, "groom" | "bride" | "host"> = {
  "nha trai": "groom",
  trai: "groom",
  "chu re": "groom",
  groom: "groom",
  "nha gai": "bride",
  gai: "bride",
  "co dau": "bride",
  bride: "bride",
  "chu tiec": "host",
  host: "host",
};

/** "Nhà trai" / "trai" / "chú rể" → groom … ; không nhận ra → null. */
export function parseSide(raw: unknown) {
  const k = vnFold(cleanText(raw));
  return k ? (SIDE_WORDS[k] ?? null) : null;
}

/** Tách "Họ nhà trai, Bạn đại học; Hàng xóm" thành danh sách nhóm. */
export function splitGroups(raw: unknown) {
  return [...new Set(cleanText(raw).split(/[,;|]/).map((g) => g.trim()).filter(Boolean))].map((g) => g.slice(0, 60));
}
