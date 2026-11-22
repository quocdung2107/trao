import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { getGuestPrivacyView } from "@/features/rsvp/privacy";
import { eraseMyData } from "@/features/rsvp/privacy-actions";
import { RSVP_STATUS } from "@/lib/labels";

export const metadata: Metadata = {
  title: "Thông tin của bạn",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

async function Privacy({ params }: { params: PageProps<"/rieng-tu/[token]">["params"] }) {
  const { token } = await params;
  const view = await getGuestPrivacyView(token);
  if (!view) notFound();

  return (
    <div className="mx-auto w-full max-w-md px-5 py-8">
      <p className="text-xs uppercase tracking-widest text-muted">Quyền riêng tư</p>
      <h1 className="mt-2 font-serif text-2xl">Thông tin của bạn trong “{view.event_title}”</h1>
      <p className="mt-3 text-sm text-muted">
        Chủ tiệc đã thêm bạn vào danh sách khách để gửi thiệp mời. Dưới đây là những gì TRAO đang lưu về bạn cho sự kiện này.
      </p>

      <dl className="mt-6 space-y-3 rounded-xl border border-border bg-surface p-4 text-sm">
        <div>
          <dt className="text-muted">Tên</dt>
          <dd className="font-semibold">{view.name}</dd>
        </div>
        <div>
          <dt className="text-muted">Liên lạc</dt>
          <dd>
            {[view.has_phone && "Số điện thoại", view.has_email && "Email"].filter(Boolean).join(", ") || "Không lưu"}
            {(view.has_phone || view.has_email) && <span className="text-muted"> (chỉ chủ tiệc xem được)</span>}
          </dd>
        </div>
        {view.sessions.map((s, i) => (
          <div key={i}>
            <dt className="text-muted">{s.name}</dt>
            <dd>
              {RSVP_STATUS[s.rsvp]}
              {s.rsvp === "yes" && s.attending ? `, ${s.attending} người` : ""}
              {s.note ? ", có lời nhắn" : ""}
            </dd>
          </div>
        ))}
        <div>
          <dt className="text-muted">Lời chúc đã gửi</dt>
          <dd>{view.wishes}</dd>
        </div>
      </dl>

      <h2 className="mt-8 font-serif text-xl">Xóa thông tin của tôi</h2>
      <p className="mt-2 text-sm">
        TRAO sẽ xóa hẳn tên, số điện thoại, câu trả lời, lời chúc, chỗ ngồi và lượt check-in của bạn khỏi sự kiện này. Chủ tiệc chỉ
        thấy “một khách đã xóa thông tin”. Việc này không hoàn tác được, và link mời của bạn sẽ không mở được nữa.
      </p>
      <ActionForm action={eraseMyData.bind(null, token)} className="mt-4 space-y-3">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="confirm" className="mt-1" required />
          <span>Tôi hiểu thông tin sẽ bị xóa vĩnh viễn.</span>
        </label>
        <SubmitButton
          pendingText="Đang xóa…"
          className="w-full rounded-lg border border-danger/30 bg-surface px-4 py-2.5 text-sm font-semibold text-danger hover:bg-danger/5"
        >
          Xóa thông tin của tôi
        </SubmitButton>
      </ActionForm>

      <p className="mt-8 text-sm text-muted">
        <Link href="/chinh-sach-du-lieu" className="underline">
          Cách TRAO dùng thông tin của bạn
        </Link>
      </p>
    </div>
  );
}

export default function PrivacyPage(props: PageProps<"/rieng-tu/[token]">) {
  return (
    <main className="flex flex-1 flex-col bg-background">
      <Suspense fallback={<p className="p-8 text-center text-sm text-muted">Đang tải…</p>}>
        <Privacy params={props.params} />
      </Suspense>
    </main>
  );
}
