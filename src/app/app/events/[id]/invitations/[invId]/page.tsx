import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { deleteInvitation } from "@/features/invitations/actions";
import { InvitationEditor } from "@/features/invitations/editor";
import { getInvitationForEdit } from "@/features/invitations/queries";
import { siteUrl } from "@/lib/site-url";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sửa thiệp" };

const UUID = /^[0-9a-f-]{36}$/i;

async function Editor({ params }: { params: PageProps<"/app/events/[id]/invitations/[invId]">["params"] }) {
  const { id, invId } = await params;
  const userId = await getUserId();
  if (!userId) redirect(`/login?next=/app/events/${id}/invitations/${invId}`);
  if (!UUID.test(id) || !UUID.test(invId)) notFound();

  const data = await getInvitationForEdit(invId, userId);
  if (!data || data.event.id !== id) notFound();
  const { invitation, event, sessions, myRole } = data;
  if (myRole !== "owner" && myRole !== "cohost") redirect(`/app/events/${id}`);

  return (
    <>
      <Link href={`/app/events/${id}`} className="text-sm text-muted">
        ← {event.title}
      </Link>
      <h1 className="mt-2 mb-4 font-serif text-2xl">{invitation.name}</h1>
      <InvitationEditor
        key={invitation.updated_at}
        invitationId={invitation.id}
        eventId={event.id}
        event={{ title: event.title, event_type: event.event_type }}
        sessions={sessions}
        initial={{
          name: invitation.name,
          templateKey: invitation.template_key,
          content: invitation.content,
          sessionIds: invitation.session_ids,
        }}
        publishedAt={invitation.published_at}
        publicUrl={`${await siteUrl()}/${invitation.slug}`}
      />
      <div className="mt-12 border-t border-border pt-6">
        <ActionForm action={deleteInvitation.bind(null, invitation.id, event.id)} confirm="Xóa thiệp này? Link đã gửi sẽ không mở được nữa.">
          <SubmitButton className="text-sm text-danger">Xóa thiệp</SubmitButton>
        </ActionForm>
      </div>
    </>
  );
}

export default function EditInvitationPage(props: PageProps<"/app/events/[id]/invitations/[invId]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Đang tải…</p>}>
      <Editor params={props.params} />
    </Suspense>
  );
}
