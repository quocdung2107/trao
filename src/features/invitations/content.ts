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

export const programItemSchema = z.object({
  time: z.string().trim().max(10).default(""),
  title: z.string().trim().max(80).default(""),
});
export type ProgramItem = z.infer<typeof programItemSchema>;

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
  // Chỉ mẫu lễ hội (festive) dùng các trường dưới; mẫu khác bỏ qua.
  /** Tự lướt sau khi khách bấm "Mở thiệp". */
  autoScroll: z.boolean().default(true),
  /** "preset" = nhạc mặc định của mẫu, "none" = tắt nhạc, hoặc khóa trong festive/music.ts. */
  music: z.string().regex(/^[a-z0-9-]{1,40}$/).default("preset"),
  /** Chữ chạy; để trống thì dùng câu mặc định của mẫu. */
  marquee: z.string().trim().max(160).default(""),
  /** Chương trình buổi tiệc theo giờ (vd 18:00 Đón khách). */
  program: z.array(programItemSchema).max(10).default([]),
  /** Hộp quà bấm để mở; lời nhắn trống thì dùng câu mặc định của mẫu. */
  showGift: z.boolean().default(true),
  giftMessage: z.string().trim().max(300).default(""),
});

export type InvitationContent = z.infer<typeof invitationContentSchema>;
export type Person = z.infer<typeof personSchema>;

/** Đọc nội dung đã lưu một cách khoan dung: trường lỗi/thiếu dùng giá trị mặc định. */
export function parseContent(raw: unknown): InvitationContent {
  const parsed = invitationContentSchema.safeParse(raw ?? {});
  if (parsed.success) return parsed.data;
  return invitationContentSchema.parse({});
}

/** Nội dung mặc định khi tạo thiệp, theo loại sự kiện. Chủ tiệc sửa lại trong trình sửa. */
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
    case "family":
      return {
        ...base,
        heading: "Thân mời",
        title: eventTitle,
        subtitle: "Tiệc gia đình",
        message: "Gia đình chúng tôi trân trọng kính mời quý khách đến dùng bữa cơm thân mật.",
        closing: "Rất mong được đón tiếp quý khách.",
      };
    case "christmas":
      return {
        ...base,
        heading: "Thân mời",
        title: eventTitle,
        subtitle: "Tiệc Giáng sinh",
        message: "Mời bạn cùng đón Giáng sinh với chúng tôi: một buổi tối ấm áp, nhiều tiếng cười và những món quà nhỏ.",
        closing: "Giáng sinh an lành!",
      };
    case "corporate":
      return {
        ...base,
        title: eventTitle,
        subtitle: "Sự kiện",
        message: "Trân trọng kính mời Quý khách đến tham dự sự kiện của chúng tôi.",
        closing: "Rất hân hạnh được đón tiếp Quý khách.",
      };
    case "greeting":
      // Thiệp chúc, không có tiệc: không có buổi nên không có đếm ngược.
      return {
        ...base,
        heading: "Thân gửi",
        title: eventTitle,
        subtitle: "Mùa lễ an lành",
        message: "Chúc bạn và gia đình một mùa lễ bình an, ấm áp và tràn đầy yêu thương.",
        closing: "Thân mến!",
        showCountdown: false,
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

/** Gợi ý (placeholder) cho các ô trong trình sửa, theo loại sự kiện. */
export type ContentHints = { title: string; subtitle: string; personLabel: string; personDetail: string };

const HINTS: Record<EventType, ContentHints> = {
  wedding: { title: "An & Bình", subtitle: "Lễ thành hôn", personLabel: "Chú rể", personDetail: "Con ông … và bà … (không bắt buộc)" },
  birthday: { title: "Sinh nhật Minh", subtitle: "Tiệc sinh nhật", personLabel: "Nhân vật chính", personDetail: "Không bắt buộc" },
  first_birthday: { title: "Bé Na", subtitle: "Mừng bé tròn một tuổi", personLabel: "Bé", personDetail: "Con của … (không bắt buộc)" },
  family: { title: "Tân gia nhà Minh", subtitle: "Tiệc tân gia", personLabel: "Chủ nhà", personDetail: "Không bắt buộc" },
  christmas: { title: "Giáng sinh 2026", subtitle: "Tiệc Giáng sinh", personLabel: "Chủ nhà", personDetail: "Không bắt buộc" },
  corporate: { title: "Year End Party 2026", subtitle: "Tiệc tất niên", personLabel: "Đơn vị tổ chức", personDetail: "Không bắt buộc" },
  greeting: { title: "Merry Christmas", subtitle: "Giáng sinh an lành", personLabel: "Người gửi", personDetail: "Gia đình … (không bắt buộc)" },
  other: { title: "Tên sự kiện", subtitle: "Dòng phụ", personLabel: "Vai", personDetail: "Không bắt buộc" },
};

export function contentHints(eventType: string): ContentHints {
  return HINTS[eventType as EventType] ?? HINTS.other;
}
