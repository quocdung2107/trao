/** Thư viện nhạc do TRAO chọn sẵn. Nguồn và giấy phép từng bài: public/music/README.md. */
export const MUSIC_TRACKS = {
  "lo-suoi": { name: "Jingle Bells · hộp nhạc ấm", src: "/music/lo-suoi.mp3" },
  "dem-thanh": { name: "Silent Night · organ", src: "/music/dem-thanh.mp3" },
  gala: { name: "We Wish You a Merry Christmas · rộn ràng", src: "/music/gala.mp3" },
} as const;

export type MusicKey = keyof typeof MUSIC_TRACKS;

/** Giá trị đặc biệt trong content.music. */
export const MUSIC_PRESET = "preset";
export const MUSIC_NONE = "none";

/** Đổi lựa chọn của chủ tiệc thành file nhạc; khóa lạ hoặc "preset" dùng nhạc của preset. */
export function resolveMusic(choice: string, presetMusic: string): string | null {
  if (choice === MUSIC_NONE) return null;
  const key = choice in MUSIC_TRACKS ? choice : presetMusic;
  return key in MUSIC_TRACKS ? MUSIC_TRACKS[key as MusicKey].src : null;
}
