import { vnFold } from "@/features/guests/normalize";

type Candidate = { id: string; display_name: string; salutation: string | null; phone_e164: string | null };

// Từ xưng hô hay gặp ở đầu tên: bỏ đi để "Anh Tú" khớp "Tú", "Cô Lan và gia đình" khớp "Lan".
const TITLES = new Set(["anh", "chi", "em", "co", "chu", "bac", "ong", "ba", "thay", "cau", "mo", "di", "duong", "ban", "be", "a", "c"]);
const FILLER = /\b(va|cung|voi)\s+(gia dinh|vo|chong|con|ban|nguoi yeu|nguoi than)\b|\b(gd|gia dinh)\b/g;

function core(name: string) {
  return vnFold(name)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(FILLER, " ")
    .split(/\s+/)
    .filter((w) => w && !TITLES.has(w))
    .join(" ");
}

/**
 * Khách sẵn có có thể là cùng người với người đăng ký: trùng SĐT, hoặc trùng tên sau khi bỏ dấu và
 * xưng hô. Chỉ để gợi ý "Gộp"; chủ tiệc luôn là người quyết định.
 */
export function likelyMatches<T extends Candidate>(req: { name: string; phone_e164: string | null }, guests: T[], limit = 3): T[] {
  const name = core(req.name);
  const scored: [T, number][] = [];
  for (const g of guests) {
    if (req.phone_e164 && g.phone_e164 === req.phone_e164) {
      scored.push([g, 3]);
      continue;
    }
    if (!name) continue;
    const names = [g.display_name, g.salutation ?? ""].map(core).filter(Boolean);
    if (names.some((n) => n === name)) scored.push([g, 2]);
    else if (name.length >= 3 && names.some((n) => (` ${n} `).includes(` ${name} `) || (` ${name} `).includes(` ${n} `)))
      scored.push([g, 1]);
  }
  return scored
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([g]) => g);
}
