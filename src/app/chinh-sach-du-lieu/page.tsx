import type { Metadata } from "next";
import Link from "next/link";
import { POLICY_VERSION } from "@/features/rsvp/policy";

export const metadata: Metadata = { title: "Cách TRAO dùng thông tin của bạn" };

export default function DataPolicyPage() {
  return (
    <main className="mx-auto max-w-2xl flex-1 px-4 py-10 leading-relaxed">
      <Link href="/" className="font-serif text-2xl text-brand">
        TRAO
      </Link>
      <h1 className="mt-6 font-serif text-3xl">Cách TRAO dùng thông tin của bạn</h1>
      <p className="mt-2 text-sm text-muted">Phiên bản {POLICY_VERSION}</p>

      <h2 className="mt-8 font-serif text-xl">Bạn là khách mời</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>
          Chủ tiệc đã nhập tên (và có thể số điện thoại) của bạn vào TRAO để gửi thiệp mời. TRAO chỉ xử lý thông tin này thay cho chủ
          tiệc, để phục vụ đúng sự kiện đó.
        </li>
        <li>
          Khi bạn xác nhận tham dự, câu trả lời, số người đi và lời nhắn được gửi tới chủ tiệc và những người họ cho phép quản lý sự
          kiện.
        </li>
        <li>Lời chúc bạn gửi sẽ hiện công khai trên thiệp cho mọi người có link, trừ khi chủ tiệc ẩn đi.</li>
        <li>Số điện thoại của bạn không bao giờ hiện trên thiệp và không được dùng cho quảng cáo hay sự kiện khác.</li>
        <li>TRAO không đặt công cụ theo dõi hay quảng cáo của bên thứ ba trên trang thiệp.</li>
      </ul>

      <h2 className="mt-8 font-serif text-xl">Muốn sửa hoặc xóa thông tin?</h2>
      <p className="mt-3">
        Bạn có thể mở lại link mời bất kỳ lúc nào để sửa câu trả lời (trước hạn chót). Trên thiệp và thẻ vào tiệc có mục “Thông tin
        của bạn”: ở đó bạn xem TRAO đang lưu gì và tự xóa hẳn thông tin của mình khỏi sự kiện, không cần qua chủ tiệc. Bạn cũng có thể
        báo chủ tiệc xóa trong danh sách khách.
      </p>
    </main>
  );
}
