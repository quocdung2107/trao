import type { InvitationView } from "../view";
import { BaseTemplate, type TemplateSlots, type Theme } from "./base";
import { FestiveTemplate } from "./festive/festive-template";
import { FESTIVE_PRESETS, isFestiveKey, type FestiveKey } from "./festive/presets";

function Leaf({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 64 64" className="mx-auto h-12 w-12" aria-hidden>
      <path d="M50 8C28 10 12 24 14 46c1 6 4 10 4 10s2-14 14-24C22 44 20 54 20 54s22 2 30-20c4-11 0-26 0-26z" fill={color} />
      <path d="M20 54C26 40 34 30 46 16" stroke="#c9a96e" strokeWidth="2" fill="none" />
    </svg>
  );
}

function Confetti() {
  const dots: [number, number, number, string][] = [
    [10, 20, 5, "#ff7a59"], [26, 8, 4, "#ffc145"], [40, 24, 6, "#3fb8af"], [54, 10, 4, "#ff7a59"],
    [18, 38, 4, "#3fb8af"], [48, 40, 5, "#ffc145"], [32, 44, 3, "#ff7a59"],
  ];
  return (
    <svg viewBox="0 0 64 52" className="mx-auto h-12 w-14" aria-hidden>
      {dots.map(([x, y, r, c], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={c} />
      ))}
    </svg>
  );
}

function Blossom() {
  return (
    <svg viewBox="0 0 64 64" className="mx-auto h-12 w-12" aria-hidden>
      {[0, 72, 144, 216, 288].map((deg) => (
        <ellipse key={deg} cx="32" cy="18" rx="8" ry="13" fill="#c8553d" transform={`rotate(${deg} 32 32)`} />
      ))}
      <circle cx="32" cy="32" r="6" fill="#e0b05c" />
    </svg>
  );
}

const THEMES = {
  la: {
    vars: { bg: "#f6f1e6", fg: "#24312a", muted: "#6b756d", accent: "#2f5e3e", line: "#d9cfb8", card: "#fbf8f1" },
    headingFont: "serif",
    cover: "framed",
    ornament: <Leaf color="#2f5e3e" />,
  },
  "toi-gian": {
    vars: { bg: "#ffffff", fg: "#1c1c1c", muted: "#7a7a7a", accent: "#1c1c1c", line: "#e6e6e6", card: "#fafafa" },
    headingFont: "sans",
    cover: "full",
  },
  "vui-tuoi": {
    vars: { bg: "#fffaf3", fg: "#2b2a33", muted: "#77717f", accent: "#e8553a", line: "#f3d9c4", card: "#ffffff" },
    headingFont: "sans",
    cover: "framed",
    ornament: <Confetti />,
  },
  "am-ap": {
    vars: { bg: "#f8ede3", fg: "#3a2418", muted: "#87695a", accent: "#a63d2a", line: "#e3c9b3", card: "#fdf6ef" },
    headingFont: "serif",
    cover: "framed",
    ornament: <Blossom />,
  },
} satisfies Record<string, Theme>;

export type TemplateKey = keyof typeof THEMES | FestiveKey;

export const TEMPLATES: { key: TemplateKey; name: string; description: string }[] = [
  { key: "la", name: "Lá", description: "Xanh lá và kem, chữ có chân. Hợp đám cưới, tiệc gia đình." },
  { key: "toi-gian", name: "Tối giản", description: "Trắng đen, ảnh bìa tràn màn hình. Hợp mọi loại sự kiện." },
  { key: "vui-tuoi", name: "Vui tươi", description: "Màu cam và vàng, chữ không chân. Hợp sinh nhật, đầy tháng, thôi nôi." },
  { key: "am-ap", name: "Ấm áp", description: "Đỏ gạch và vàng đồng, chữ có chân. Hợp đám hỏi, tân gia, mừng thọ." },
  // Mẫu lễ hội: bìa "Chạm để mở thiệp", nhạc, tự lướt, album động.
  ...(Object.entries(FESTIVE_PRESETS) as [FestiveKey, (typeof FESTIVE_PRESETS)[FestiveKey]][]).map(([key, p]) => ({
    key,
    name: p.name,
    description: p.description,
  })),
];

export const DEFAULT_TEMPLATE: keyof typeof THEMES = "la";

export function isTemplateKey(k: string): k is TemplateKey {
  return k in THEMES || isFestiveKey(k);
}

/** Mẫu có màn bìa, nhạc và tự lướt (dùng để hiện các tùy chọn tương ứng trong trình sửa). */
export const isFestiveTemplate = isFestiveKey;

export function InvitationTemplate({
  templateKey,
  view,
  frame = "page",
  ...slots
}: { templateKey: string; view: InvitationView; frame?: "page" | "preview" } & TemplateSlots) {
  if (isFestiveKey(templateKey)) return <FestiveTemplate presetKey={templateKey} view={view} frame={frame} {...slots} />;
  const theme = THEMES[templateKey in THEMES ? (templateKey as keyof typeof THEMES) : DEFAULT_TEMPLATE];
  return <BaseTemplate view={view} theme={theme} {...slots} />;
}
