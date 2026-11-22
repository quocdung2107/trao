import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getGuestInvitation, getPublishedInvitation, isGuestToken } from "@/features/invitations/public";
import { RsvpForm } from "@/features/rsvp/rsvp-form";
import { Wishes } from "@/features/rsvp/wishes";
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

async function Invitation({ props }: { props: PageProps<"/[slug]"> }) {
  const [{ slug }, { g }] = await Promise.all([props.params, props.searchParams]);
  const inv = await getPublishedInvitation(slug);
  if (!inv) notFound();
  // Link cá nhân ?g=<token>: thiệp gọi đích danh, chỉ hiện các buổi khách được mời, kèm RSVP.
  const token = isGuestToken(g) ? g : null;
  const guest = token ? await getGuestInvitation(slug, token) : null;
  const view = guest?.invites.length ? { ...inv, sessions: guest.invites.map((i) => ({ ...i, id: i.session_id })) } : inv;
  return (
    <InvitationTemplate
      templateKey={inv.template_key}
      view={view}
      greeting={guest?.salutation}
      rsvp={
        guest && token ? (
          <>
            <RsvpForm slug={slug} token={token} guest={guest} />
            <p className="mt-3 text-center text-sm">
              <Link href={`/c/${token}`} className="font-semibold underline" style={{ color: "var(--inv-accent)" }}>
                Thẻ vào tiệc (mã QR)
              </Link>
            </p>
          </>
        ) : null
      }
      wishes={
        inv.content.showWishes ? (
          <Wishes slug={slug} token={guest ? token : null} wishes={inv.wishes} defaultName={guest?.salutation} />
        ) : null
      }
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
        <Invitation props={props} />
      </Suspense>
    </main>
  );
}
