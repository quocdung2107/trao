import type { InvitationView } from "../view";
import { BaseTemplate, type TemplateSlots, type Theme } from "./base";

function Leaf({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 64 64" className="mx-auto h-12 w-12" aria-hidden>
      <path d="M50 8C28 10 12 24 14 46c1 6 4 10 4 10s2-14 14-24C22 44 20 54 20 54s22 2 30-20c4-11 0-26 0-26z" fill={color} />
      <path d="M20 54C26 40 34 30 46 16" stroke="#c9a96e" strokeWidth="2" fill="none" />
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
} satisfies Record<string, Theme>;

export type TemplateKey = keyof typeof THEMES;

export const TEMPLATES: { key: TemplateKey; name: string; description: string }[] = [
  { key: "la", name: "Lá", description: "Xanh lá và kem, chữ có chân. Hợp đám cưới, tiệc gia đình." },
  { key: "toi-gian", name: "Tối giản", description: "Trắng đen, ảnh bìa tràn màn hình. Hợp mọi loại sự kiện." },
];

export const DEFAULT_TEMPLATE: TemplateKey = "la";

export function isTemplateKey(k: string): k is TemplateKey {
  return k in THEMES;
}

export function InvitationTemplate({ templateKey, view, ...slots }: { templateKey: string; view: InvitationView } & TemplateSlots) {
  const theme = THEMES[isTemplateKey(templateKey) ? templateKey : DEFAULT_TEMPLATE];
  return <BaseTemplate view={view} theme={theme} {...slots} />;
}
