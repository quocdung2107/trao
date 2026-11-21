import Link from "next/link";

export default function InvitationNotFound() {
  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center px-4 text-center">
      <p className="font-serif text-xl">Không tìm thấy thiệp</p>
      <p className="mt-2 text-sm text-muted">Link có thể đã sai, hoặc chủ tiệc đã ngừng chia sẻ thiệp này.</p>
      <Link href="/" className="mt-6 text-sm font-medium text-brand">
        Về trang chủ TRAO
      </Link>
    </main>
  );
}
