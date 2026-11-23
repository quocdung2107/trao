import type { CSSProperties, ElementType } from "react";
import { s } from "./styles";

// Trình duyệt cũ chưa có Intl.Segmenter: tách theo ký tự (chữ Việt gõ dạng dựng sẵn NFC vẫn đúng).
const seg = typeof Intl.Segmenter === "function" ? new Intl.Segmenter("vi", { granularity: "grapheme" }) : null;
const graphemes = (w: string) => (seg ? Array.from(seg.segment(w.normalize("NFC")), (x) => x.segment) : Array.from(w.normalize("NFC")));

/**
 * Chữ hiện dần từng ký tự khi khối chứa nó được hiện ra (lớp fx-revealOn) hoặc khi màn bìa vừa vẽ.
 * Tách theo grapheme để giữ dấu tiếng Việt; mỗi từ không bị ngắt giữa chừng. Trình đọc màn hình đọc nguyên câu.
 */
export function Letters({
  text,
  as: Tag = "span",
  className = "",
  style,
  step = 45,
  delay = 0,
}: {
  text: string;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  step?: number;
  delay?: number;
}) {
  let i = 0;
  const words = text.split(/(\s+)/);
  return (
    <Tag className={`${s.letters} ${className}`} style={style} aria-label={text}>
      {words.map((w, wi) =>
        /^\s+$/.test(w) ? (
          " "
        ) : (
          <span key={wi} className="inline-block whitespace-nowrap" aria-hidden>
            {graphemes(w).map((segment) => (
              <span key={i} className={s.ch} style={{ animationDelay: `${delay + i++ * step}ms` }}>
                {segment}
              </span>
            ))}
          </span>
        ),
      )}
    </Tag>
  );
}
