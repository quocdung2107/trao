import Link from "next/link";
import { Wordmark } from "@/components/brand";

export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-3">
          <Wordmark href="/app" />
          <div className="flex items-center gap-4">
            <Link href="/app/account" className="text-sm text-muted hover:text-foreground">
              Tài khoản
            </Link>
            <form action="/auth/signout" method="post">
              <button className="text-sm text-muted hover:text-foreground">Đăng xuất</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
