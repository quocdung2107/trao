import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Wordmark } from "@/components/brand";
import { Card } from "@/components/ui";
import { getUserId } from "@/lib/supabase/server";
import { acceptInvite } from "../../app/events/actions";

export const metadata: Metadata = { title: "Lời mời quản lý sự kiện", robots: { index: false } };

async function Invite({ params }: { params: PageProps<"/invite/[token]">["params"] }) {
  const { token } = await params;
  const userId = await getUserId();

  if (!userId) {
    return (
      <>
        <p className="text-sm">Bạn được mời cùng quản lý một sự kiện trên TRAO. Đăng nhập để nhận lời mời.</p>
        <Link
          href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
          className="mt-4 inline-block rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white"
        >
          Đăng nhập
        </Link>
      </>
    );
  }

  return (
    <ActionForm action={acceptInvite.bind(null, token)}>
      <p className="text-sm">Bạn được mời cùng quản lý một sự kiện trên TRAO.</p>
      <SubmitButton
        className="mt-4 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        pendingText="Đang nhận…"
      >
        Nhận lời mời
      </SubmitButton>
    </ActionForm>
  );
}

export default function InvitePage(props: PageProps<"/invite/[token]">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <Wordmark />
      </div>
      <Card>
        <Suspense fallback={<p className="text-sm text-muted">Đang tải…</p>}>
          <Invite params={props.params} />
        </Suspense>
      </Card>
    </main>
  );
}
