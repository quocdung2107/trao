const TOKEN = /^[A-Za-z0-9_-]{22}$/;

/** Đọc token khách từ nội dung mã QR: link thẻ /c/<token>, link thiệp ?g=<token>, hoặc token trần. */
export function tokenFromQr(text: string): string | null {
  const s = text.trim();
  const m = /\/c\/([A-Za-z0-9_-]{22})(?:[/?#]|$)/.exec(s) ?? /[?&]g=([A-Za-z0-9_-]{22})(?:&|#|$)/.exec(s);
  if (m) return m[1];
  return TOKEN.test(s) ? s : null;
}
