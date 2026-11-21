import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getPublishedInvitation } from "@/features/invitations/public";
import { InvitationTemplate } from "@/features/invitations/templates/registry";
import { sessionDate, firstStart } from "@/features/invitations/view";

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const inv = await getPublishedInvitation(slug);
  if (!inv) return { title: "Không tìm thấy thiệp", robots: { index: false } };
  const title = inv.content.title || inv.event.title;
  const d = sessionDate(firstStart(inv.sessions));
  const description = [inv.content.subtitle, d && `${d.time} · ${d.weekday}, ${d.date}`].filter(Boolean).join(" — ");
  return {
    title: { absolute: `${inv.content.heading} · ${title}` },
    description: description || inv.content.message.slice(0, 150),
    // Thiệp là trang riêng tư theo link: không cho công cụ tìm kiếm lập chỉ mục.
    robots: { index: false, follow: false },
    openGraph: { type: "website", title, description: description || undefined },
  };
}

async function Invitation({ params }: { params: PageProps<"/[slug]">["params"] }) {
  const { slug } = await params;
  const inv = await getPublishedInvitation(slug);
  if (!inv) notFound();
  return (
    <InvitationTemplate
      templateKey={inv.template_key}
      view={inv}
      footer={
        <footer className="px-6 pt-4 pb-10 text-center text-xs opacity-60">
          Thiệp tạo bằng{" "}
          <Link href="/" className="font-semibold underline">
            TRAO
          </Link>
        </footer>
      }
    />
  );
}

export default function InvitationPage(props: PageProps<"/[slug]">) {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<div className="flex-1" />}>
        <Invitation params={props.params} />
      </Suspense>
    </main>
  );
}
