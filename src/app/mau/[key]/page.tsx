import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { invitationContentSchema } from "@/features/invitations/content";
import { FestiveTemplate } from "@/features/invitations/templates/festive/festive-template";
import { FESTIVE_PRESETS, isFestiveKey, type FestiveKey } from "@/features/invitations/templates/festive/presets";
import type { InvitationView } from "@/features/invitations/view";

/** Trang xem thử mẫu lễ hội với dữ liệu mẫu: để chủ tiệc xem trước khi tạo, và để quay video giới thiệu. */

const SAMPLE: Record<FestiveKey, { photo: string; view: Omit<InvitationView, "content"> & { content: Record<string, unknown> } }> = {
  "noel-lo-suoi": {
    photo: "lo-suoi",
    view: {
      event: { title: "Noel nhà mình", event_type: "christmas" },
      content: {
        heading: "Thân mời cả nhà",
        title: "Noel nhà mình",
        subtitle: "Giáng sinh an lành",
        message: "Năm nay cả nhà mình quây quần đón Noel ở nhà ngoại nhé. Có gà nướng, bánh khúc cây và quà cho các cháu!",
        closing: "Hẹn cả nhà tối 24, nhớ mặc áo đỏ nha!",
      },
      sessions: [
        { id: "s1", name: "Tiệc đêm Giáng sinh", starts_at: "2026-12-24T12:00:00Z", ends_at: null, venue_name: "Nhà ngoại", address: "12 Nguyễn Trãi, Quận 5, TP.HCM", map_url: null },
      ],
    },
  },
  "noel-dem-thanh": {
    photo: "dem-thanh",
    view: {
      event: { title: "Đêm Thánh vô cùng", event_type: "christmas" },
      content: {
        heading: "Trân trọng kính mời",
        title: "Đêm Thánh vô cùng",
        subtitle: "Mừng Chúa Giáng Sinh 2026",
        message: "Ca đoàn Thánh Tâm kính mời cộng đoàn đến tham dự Thánh lễ đêm Giáng sinh và buổi văn nghệ mừng Chúa Hài Đồng.",
        closing: "Nguyện chúc bình an của Chúa Hài Đồng đến với mọi gia đình.",
      },
      sessions: [
        { id: "s1", name: "Thánh lễ đêm Giáng sinh", starts_at: "2026-12-24T13:00:00Z", ends_at: null, venue_name: "Nhà thờ Giáo xứ", address: "Đường số 3, Thủ Đức, TP.HCM", map_url: null },
      ],
    },
  },
  "noel-gala": {
    photo: "gala",
    view: {
      event: { title: "Year End Party 2026", event_type: "corporate" },
      content: {
        heading: "Trân trọng kính mời",
        title: "Year End Party 2026",
        subtitle: "Gala cuối năm",
        message: "Cảm ơn bạn đã cùng công ty đi qua một năm thật đáng nhớ. Mời bạn đến buổi tiệc cuối năm: âm nhạc, trao giải và bốc thăm may mắn.",
        closing: "Dress code: Black & Gold.",
      },
      sessions: [
        { id: "s1", name: "Tiệc Gala", starts_at: "2026-12-27T11:30:00Z", ends_at: null, venue_name: "Sảnh Grand Ballroom", address: "Quận 1, TP.HCM", map_url: null },
      ],
    },
  },
};

export function generateStaticParams() {
  return Object.keys(FESTIVE_PRESETS).map((key) => ({ key }));
}

export async function generateMetadata({ params }: PageProps<"/mau/[key]">): Promise<Metadata> {
  const { key } = await params;
  if (!isFestiveKey(key)) return { title: "Không tìm thấy mẫu" };
  return { title: `Mẫu thiệp ${FESTIVE_PRESETS[key].name}`, description: FESTIVE_PRESETS[key].description };
}

function DemoRsvp() {
  return (
    <div className="rounded-2xl px-5 py-6" style={{ background: "var(--inv-card)", border: "1px solid var(--inv-line)" }}>
      <p className="font-serif text-xl" style={{ color: "var(--inv-accent)" }}>
        Xác nhận tham dự
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-sm font-semibold">
        {["Sẽ đến", "Chưa chắc", "Không đến"].map((x, i) => (
          <span
            key={x}
            className="rounded-xl px-2 py-3"
            style={i === 0 ? { background: "var(--inv-accent)", color: "var(--inv-bg)" } : { border: "1px solid var(--inv-line)" }}
          >
            {x}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs opacity-70">Đây là bản xem thử. Trên thiệp thật, khách bấm để trả lời.</p>
    </div>
  );
}

export default async function TemplateDemo({ params }: PageProps<"/mau/[key]">) {
  const { key } = await params;
  if (!isFestiveKey(key)) notFound();
  const sample = SAMPLE[key];
  const photo = (n: number, ext = "webp") => `${sample.photo}-${n}.${ext}`;
  const content = invitationContentSchema.parse({
    ...sample.view.content,
    coverImage: null,
    gallery: [],
  });
  const view: InvitationView = {
    ...sample.view,
    content: { ...content, coverImage: photo(1, "jpg"), gallery: [photo(1), photo(2), photo(3)] },
  };
  return (
    <main className="flex flex-1 flex-col">
      <FestiveTemplate
        presetKey={key}
        view={view}
        resolveMedia={(p) => `/thiep-mau/${p}`}
        greeting="Anh Minh và gia đình"
        rsvp={<DemoRsvp />}
        footer={
          <footer className="px-6 pt-4 pb-12 text-center text-sm">
            <Link href="/app" className="inline-block rounded-full px-5 py-2.5 font-semibold" style={{ background: "var(--inv-accent)", color: "var(--inv-bg)" }}>
              Dùng mẫu này
            </Link>
            <p className="mt-6 text-xs opacity-60">
              <Link href="/?ref=mau">
                Tạo bằng <strong>TRAO</strong>
              </Link>
            </p>
          </footer>
        }
      />
    </main>
  );
}
