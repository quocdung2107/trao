import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Đã xóa thông tin", robots: { index: false, follow: false } };

export default function ErasedPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 py-16 text-center">
      <h1 className="font-serif text-2xl">Đã xóa thông tin của bạn</h1>
      <p className="mt-3 text-sm text-muted">
        TRAO không còn lưu tên, câu trả lời hay lời chúc của bạn cho sự kiện này. Nếu vẫn muốn tham dự, hãy liên hệ trực tiếp chủ tiệc.
      </p>
      <Link href="/chinh-sach-du-lieu" className="mt-6 inline-block text-sm underline">
        Cách TRAO dùng thông tin
      </Link>
    </main>
  );
}
