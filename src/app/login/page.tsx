import type { Metadata } from "next";
import { Suspense } from "react";
import { Wordmark } from "@/components/brand";
import { Card } from "@/components/ui";
import { safeNext } from "@/lib/safe-next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Đăng nhập" };

async function Form({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { next, error } = await searchParams;
  return (
    <>
      {error === "link" && (
        <p role="alert" className="mb-4 text-sm text-danger">
          Liên kết đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng gửi lại.
        </p>
      )}
      <LoginForm next={safeNext(typeof next === "string" ? next : null)} />
    </>
  );
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <Wordmark />
        <p className="mt-2 text-sm text-muted">Đăng nhập để quản lý sự kiện</p>
      </div>
      <Card>
        <Suspense>
          <Form searchParams={props.searchParams} />
        </Suspense>
      </Card>
    </main>
  );
}
