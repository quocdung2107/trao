const TZ = "Asia/Ho_Chi_Minh";

export function formatDateTime(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: TZ,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Giá trị `datetime-local` (giờ Việt Nam) → ISO có múi giờ. */
export function localVnToIso(value: string | null | undefined) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  return `${value}:00+07:00`;
}
