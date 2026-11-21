export const EVENT_TYPES = {
  wedding: "Đám cưới",
  birthday: "Sinh nhật",
  first_birthday: "Thôi nôi",
  family: "Tiệc gia đình",
  christmas: "Giáng sinh",
  corporate: "Sự kiện doanh nghiệp",
  other: "Khác",
} as const;
export type EventType = keyof typeof EVENT_TYPES;

export const EVENT_ROLES = {
  owner: "Chủ tiệc",
  cohost: "Đồng tổ chức",
  staff: "Nhân viên check-in",
  viewer: "Chỉ xem",
} as const;
export type EventRole = keyof typeof EVENT_ROLES;

export const EVENT_STATUS = {
  draft: "Bản nháp",
  published: "Đã xuất bản",
  archived: "Đã lưu trữ",
} as const;

export function label<T extends Record<string, string>>(map: T, key: string) {
  return (map as Record<string, string>)[key] ?? key;
}
