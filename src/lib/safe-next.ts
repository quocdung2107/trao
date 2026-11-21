/** Chỉ chấp nhận đường dẫn nội bộ để tránh open redirect. */
export function safeNext(next: string | null | undefined, fallback = "/app") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
