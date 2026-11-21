import { z } from "zod";
import type { EventType } from "@/lib/labels";

export const MAX_GALLERY = 12;

// Đường dẫn ảnh trong bucket event-media: <event_id>/<tên file>.
const mediaPath = z.string().regex(/^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,100}$/);

export const personSchema = z.object({
  label: z.string().trim().max(40).default(""),
  name: z.string().trim().max(80).default(""),
  detail: z.string().trim().max(160).default(""),
});

/** Nội dung thiệp dùng chung cho mọi mẫu; mẫu chỉ khác cách trình bày. */
export const invitationContentSchema = z.object({
  heading: z.string().trim().max(80).default("Trân trọng kính mời"),
  title: z.string().trim().max(80).default(""),
  subtitle: z.string().trim().max(80).default(""),
  people: z.array(personSchema).max(4).default([]),
  message: z.string().trim().max(1000).default(""),
  closing: z.string().trim().max(300).default(""),
  coverImage: mediaPath.nullable().default(null),
  gallery: z.array(mediaPath).max(MAX_GALLERY).default([]),
  showCountdown: z.boolean().default(true),
  showWishes: z.boolean().default(true),
});

export type InvitationContent = z.infer<typeof invitationContentSchema>;
export type Person = z.infer<typeof personSchema>;

/** Đọc nội dung đã lưu một cách khoan dung: trường lỗi/thiếu dùng giá trị mặc định. */
export function parseContent(raw: unknown): InvitationContent {
  const parsed = invitationContentSchema.safeParse(raw ?? {});
  if (parsed.success) return parsed.data;
  return invitationContentSchema.parse({});
}

export function defaultContent(eventType: EventType, eventTitle: string): InvitationContent {
  const base = invitationContentSchema.parse({});
  switch (eventType) {
    case "wedding":
      return {
        ...base,
        title: eventTitle.replace(/^đám cưới\s*/i, "") || eventTitle,
        subtitle: "Lễ thành hôn",
        people: [
          { label: "Chú rể", name: "", detail: "" },
          { label: "Cô dâu", name: "", detail: "" },
        ],
        message: "Trân trọng kính mời quý khách đến dự bữa tiệc chung vui cùng gia đình chúng tôi.",
        closing: "Sự hiện diện của quý khách là niềm vinh hạnh cho gia đình chúng tôi.",
      };
    case "first_birthday":
    case "birthday":
      return {
        ...base,
        heading: "Thân mời",
        title: eventTitle,
        subtitle: eventType === "first_birthday" ? "Mừng bé tròn một tuổi" : "Tiệc sinh nhật",
        message: "Rất mong bạn đến chung vui cùng gia đình.",
        closing: "Hẹn gặp bạn nhé!",
      };
    default:
      return {
        ...base,
        title: eventTitle,
        message: "Trân trọng kính mời quý khách đến tham dự.",
        closing: "Rất hân hạnh được đón tiếp.",
      };
  }
}
