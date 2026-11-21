import Link from "next/link";
import { Wordmark } from "@/components/brand";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-16 text-center">
      <div>
        <Wordmark />
      </div>
      <h1 className="mt-6 font-serif text-3xl leading-tight sm:text-4xl">
        Thiệp mời đẹp để khách muốn mở. Công cụ đơn giản để bạn đón khách.
      </h1>
      <p className="mt-4 text-muted">
        Tạo thiệp online, gửi link riêng cho từng khách qua Zalo, theo dõi xác nhận tham dự, xếp bàn và check-in tại sảnh.
      </p>
      <div className="mt-8">
        <Link href="/app" className="rounded-lg bg-brand px-5 py-3 font-semibold text-white">
          Bắt đầu
        </Link>
      </div>
      <p className="mt-10 text-xs text-muted">Không quảng cáo trên thiệp. Không bán danh bạ khách mời.</p>
    </main>
  );
}
