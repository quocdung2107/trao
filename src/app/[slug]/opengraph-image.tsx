import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getPublishedInvitation } from "@/features/invitations/public";
import { FESTIVE_PRESETS, isFestiveKey } from "@/features/invitations/templates/festive/presets";
import { firstStart, mediaUrl, sessionDate } from "@/features/invitations/view";

export const alt = "Thiệp mời";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const fontsDir = join(process.cwd(), "src/assets/fonts");

/** Tải ảnh bìa thành data URL; lỗi hoặc chậm thì bỏ ảnh để ảnh xem trước vẫn hiện được. */
async function loadCover(path: string): Promise<string | null> {
  try {
    const res = await fetch(mediaUrl(path), { signal: AbortSignal.timeout(4000) });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/^image\/(jpeg|png)$/.test(type)) return null;
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [inv, regular, bold] = await Promise.all([
    getPublishedInvitation(slug),
    readFile(join(fontsDir, "Lora-Regular.ttf")),
    readFile(join(fontsDir, "Lora-Bold.ttf")),
  ]);

  const title = inv ? inv.content.title || inv.event.title : "TRAO";
  const subtitle = inv?.content.subtitle ?? "";
  const d = inv ? sessionDate(firstStart(inv.sessions)) : null;
  // Chỉ dùng ảnh bìa JPEG/PNG; trình dựng ảnh OG không đọc WebP.
  const cover =
    inv?.content.coverImage && /\.(jpe?g|png)$/i.test(inv.content.coverImage) ? await loadCover(inv.content.coverImage) : null;

  // Mẫu lễ hội: ảnh xem trước theo màu của preset (đây là thứ khách thấy đầu tiên khi dán link vào Zalo).
  const fv = inv && isFestiveKey(inv.template_key) ? FESTIVE_PRESETS[inv.template_key].vars : null;
  const c = fv
    ? { bg: fv.bg, fg: fv.fg, muted: fv.muted, title: fv.accent, line: fv.accent }
    : { bg: "#f6f1e6", fg: "#24312a", muted: "#6b756d", title: "#2f5e3e", line: "#c9a96e" };

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: c.bg, fontFamily: "Lora" }}>
        {cover && <img src={cover} alt="" width={472} height={630} style={{ objectFit: "cover" }} />}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            flex: 1,
            padding: 64,
            textAlign: "center",
            color: c.fg,
          }}
        >
          <div style={{ fontSize: 28, letterSpacing: 6, textTransform: "uppercase", color: c.muted }}>
            {inv?.content.heading ?? "Thiệp mời"}
          </div>
          <div style={{ fontSize: cover ? 72 : 92, fontWeight: 700, color: c.title, marginTop: 24, lineHeight: 1.1 }}>
            {title}
          </div>
          {subtitle && <div style={{ fontSize: 34, marginTop: 20 }}>{subtitle}</div>}
          {d && (
            <div style={{ fontSize: 30, marginTop: 36, paddingTop: 24, borderTop: `2px solid ${c.line}`, color: c.fg }}>
              {`${d.time} · ${d.weekday}, ${d.date}`}
            </div>
          )}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Lora", data: regular, style: "normal", weight: 400 },
        { name: "Lora", data: bold, style: "normal", weight: 700 },
      ],
    },
  );
}
