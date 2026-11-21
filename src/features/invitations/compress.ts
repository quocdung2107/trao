/**
 * Thu nhỏ ảnh ở trình duyệt trước khi tải lên: cạnh dài ≤ 1600px, WebP (hoặc JPEG nếu trình duyệt không hỗ trợ).
 * Ảnh bìa dùng JPEG vì ảnh xem trước khi dán link (OG) không đọc được WebP.
 */
export async function compressImage(
  file: File,
  { maxSide = 1600, format = "webp" }: { maxSide?: number; format?: "webp" | "jpeg" } = {},
): Promise<{ blob: Blob; ext: "webp" | "jpg" }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const toBlob = (type: string, q: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, q));
  if (format === "webp") {
    const webp = await toBlob("image/webp", 0.82);
    if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp" };
  }
  const jpg = await toBlob("image/jpeg", 0.85);
  if (!jpg) throw new Error("Không xử lý được ảnh");
  return { blob: jpg, ext: "jpg" };
}
