import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { renderSVG } from "uqr";
import { getGuestPass } from "@/features/checkin/pass";
import { sessionDate } from "@/features/invitations/view";
import { siteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Thẻ vào tiệc",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

async function Pass({ params }: { params: PageProps<"/c/[token]">["params"] }) {
  const { token } = await params;
  const pass = await getGuestPass(token);
  if (!pass) notFound();
  const url = `${await siteUrl()}/c/${token}`;
  const svg = renderSVG(url, { ecc: "M", border: 2 });

  return (
    <div className="mx-auto w-full max-w-sm px-5 py-8 text-center">
      <p className="text-xs uppercase tracking-widest text-muted">Thẻ vào tiệc</p>
      <h1 className="mt-2 font-serif text-2xl">{pass.event_title}</h1>
      <p className="mt-4 text-lg">
        Kính mời <b>{pass.name}</b>
      </p>
      <div
        className="mx-auto mt-6 w-64 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-border [&>svg]:h-auto [&>svg]:w-full"
        role="img"
        aria-label="Mã QR vào tiệc"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="mt-3 text-sm text-muted">Đưa mã này cho lễ tân khi đến tiệc. Có thể chụp màn hình để dùng khi không có mạng.</p>

      <ul className="mt-6 space-y-3 text-left">
        {pass.sessions.map((s, i) => {
          const d = sessionDate(s.starts_at);
          return (
            <li key={i} className="rounded-xl border border-border bg-surface p-4">
              <p className="font-semibold">{s.name}</p>
              {d && (
                <p className="text-sm">
                  {d.time} · {d.weekday}, {d.date}
                </p>
              )}
              {(s.venue_name || s.address) && <p className="text-sm text-muted">{[s.venue_name, s.address].filter(Boolean).join(", ")}</p>}
              {s.tables && s.tables.length > 0 && (
                <p className="mt-2 text-lg">
                  Bàn của bạn: <b className="text-brand">{s.tables.join(", ")}</b>
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-8 text-xs text-muted">
        <Link href={`/rieng-tu/${token}`} className="underline">
          Thông tin của bạn và quyền riêng tư
        </Link>
      </p>
    </div>
  );
}

export default function PassPage(props: PageProps<"/c/[token]">) {
  return (
    <main className="flex flex-1 flex-col bg-background">
      <Suspense fallback={<p className="p-8 text-center text-sm text-muted">Đang tải…</p>}>
        <Pass params={props.params} />
      </Suspense>
    </main>
  );
}
