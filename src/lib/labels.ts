export const EVENT_TYPES = {
  wedding: "Đám cưới",
  birthday: "Sinh nhật",
  first_birthday: "Thôi nôi",
  family: "Tiệc gia đình",
  christmas: "Giáng sinh",
  corporate: "Sự kiện doanh nghiệp",
  greeting: "Lời chúc (không có tiệc)",
  other: "Khác",
} as const;
export type EventType = keyof typeof EVENT_TYPES;

/** "Lời chúc": thiệp chúc mừng không có tiệc — không buổi tiệc, bản đồ, RSVP, xếp bàn, check-in. */
export const hasParty = (eventType: string) => eventType !== "greeting";

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

export const GUEST_SIDES = {
  groom: "Nhà trai",
  bride: "Nhà gái",
  host: "Chủ tiệc",
} as const;
export type GuestSide = keyof typeof GUEST_SIDES;

export const RSVP_STATUS = {
  pending: "Chưa trả lời",
  yes: "Sẽ đến",
  no: "Không đến",
  maybe: "Chưa chắc",
} as const;
export type RsvpStatus = keyof typeof RSVP_STATUS;
