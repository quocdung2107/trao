import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, Input, Label } from "@/components/ui";
import { updateDisplayName } from "@/features/events/profile-actions";
import { createClient, getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Tài khoản" };

async function Account() {
  const userId = await getUserId();
  if (!userId) redirect("/login?next=/app/account");
  const supabase = await createClient();
  const [{ data: profile }, { data: user }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    supabase.auth.getUser(),
  ]);

  return (
    <div className="max-w-md space-y-5">
      <Link href="/app" className="text-sm text-muted">
        ← Sự kiện của tôi
      </Link>
      <h1 className="font-serif text-2xl">Tài khoản</h1>
      <Card>
        <ActionForm action={updateDisplayName} className="space-y-3">
          <div>
            <Label htmlFor="displayName">Tên hiển thị</Label>
            <Input id="displayName" name="displayName" defaultValue={profile?.display_name ?? ""} maxLength={100} required />
            <p className="mt-1 text-xs text-muted">Người cùng quản lý sự kiện thấy tên này, ví dụ “Đã check-in bởi Lan”.</p>
          </div>
          <SubmitButton className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" pendingText="Đang lưu…">
            Lưu
          </SubmitButton>
        </ActionForm>
        {user.user?.email && <p className="mt-4 text-sm text-muted">Email đăng nhập: {user.user.email}</p>}
      </Card>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Đang tải…</p>}>
      <Account />
    </Suspense>
  );
}
