/**
 * Preset của engine thiệp lễ hội: chỉ là dữ liệu. Thêm preset mới = thêm một mục ở đây
 * (và nếu cần một kiểu bìa/album/hạt mới thì thêm vào union tương ứng trong engine).
 */
export type ParticleKind = "snow" | "stars" | "glitter" | "none";
export type CoverKind = "envelope" | "star" | "deco";
export type AlbumKind = "polaroid" | "arch" | "film";

export type FestivePreset = {
  name: string;
  description: string;
  vars: {
    bg: string;
    fg: string;
    muted: string;
    accent: string;
    line: string;
    card: string;
    /** Nền màn bìa (có thể là gradient). */
    coverBg: string;
    /** Màu chữ trên màn bìa. */
    coverFg: string;
    /** Nút "Mở thiệp": nền và chữ. */
    button: string;
    buttonFg: string;
  };
  headingFont: "serif" | "display" | "sans";
  cover: CoverKind;
  album: AlbumKind;
  particles: ParticleKind;
  /** Bài nhạc mặc định, khóa trong music.ts. */
  music: string;
  /** Chữ chạy mặc định khi chủ tiệc không nhập. */
  marquee: string;
  /** Dòng chữ nhỏ trên màn bìa, trên tên sự kiện. */
  coverKicker: string;
};

export const FESTIVE_PRESETS = {
  "noel-lo-suoi": {
    name: "Noel · Lò sưởi",
    description: "Đỏ gạch, kem và gỗ, phong bì sáp niêm, tuyết rơi. Hợp tiệc gia đình, họ hàng.",
    vars: {
      bg: "#f7ede1",
      fg: "#3b2418",
      muted: "#8a6a58",
      accent: "#a4321f",
      line: "#e5cdb6",
      card: "#fdf6ee",
      coverBg: "radial-gradient(120% 80% at 50% 0%, #7a2a1c 0%, #4a1a12 55%, #2c0f0a 100%)",
      coverFg: "#fbeee0",
      button: "#f3c66b",
      buttonFg: "#3b1a10",
    },
    headingFont: "serif",
    cover: "envelope",
    album: "polaroid",
    particles: "snow",
    music: "lo-suoi",
    marquee: "Cả nhà mình cùng đón Noel nhé ✦ Giáng sinh an lành ✦ Merry Christmas",
    coverKicker: "Giáng sinh an lành",
  },
  "noel-dem-thanh": {
    name: "Noel · Đêm Thánh",
    description: "Xanh đêm và ánh nến vàng, ngôi sao sáng, khung ảnh vòm. Hợp giáo xứ, ca đoàn, cộng đoàn.",
    vars: {
      bg: "#0f1a33",
      fg: "#eef0f7",
      muted: "#a9b3cc",
      accent: "#f2cf7a",
      line: "#2a3a60",
      card: "#16244a",
      coverBg: "radial-gradient(90% 60% at 50% 30%, #1f3366 0%, #0d1730 60%, #070d1d 100%)",
      coverFg: "#f6f0dc",
      button: "#f2cf7a",
      buttonFg: "#1a1405",
    },
    headingFont: "display",
    cover: "star",
    album: "arch",
    particles: "stars",
    music: "dem-thanh",
    marquee: "Vinh danh Thiên Chúa trên các tầng trời ✦ Bình an dưới thế cho loài người Chúa thương",
    coverKicker: "Mừng Chúa Giáng Sinh",
  },
  "noel-gala": {
    name: "Noel · Gala cuối năm",
    description: "Đen và vàng ánh kim kiểu Art Deco, kim tuyến rơi, album dạng phim. Hợp tiệc công ty, tất niên.",
    vars: {
      bg: "#0e0e10",
      fg: "#f3efe6",
      muted: "#a39d8f",
      accent: "#d8b56a",
      line: "#3a3426",
      card: "#18171a",
      coverBg: "linear-gradient(180deg, #151418 0%, #0b0b0d 100%)",
      coverFg: "#f3efe6",
      button: "linear-gradient(100deg, #b8913f 0%, #f6dc96 45%, #c79c45 100%)",
      buttonFg: "#1a1405",
    },
    headingFont: "display",
    cover: "deco",
    album: "film",
    particles: "glitter",
    music: "gala",
    marquee: "Year End Party ✦ Cảm ơn một năm đồng hành ✦ Cheers to 2027",
    coverKicker: "Trân trọng kính mời",
  },
} satisfies Record<string, FestivePreset>;

export type FestiveKey = keyof typeof FESTIVE_PRESETS;

export function isFestiveKey(k: string): k is FestiveKey {
  return k in FESTIVE_PRESETS;
}
