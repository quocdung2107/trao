import { vnFold } from "@/features/guests/normalize";
import { buildGuestWorkbook, type ExportData } from "@/features/guests/export";
import { createClient } from "@/lib/supabase/server";

/** Tải file Excel danh sách khách. Quyền và nhật ký xuất nằm trong RPC export_event. */
export async function GET(_req: Request, ctx: RouteContext<"/app/events/[id]/export">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Không tìm thấy", { status: 404 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims.sub) return Response.redirect(new URL(`/login?next=/app/events/${id}/guests`, _req.url), 303);

  const { data, error } = await supabase.rpc("export_event", { p_event_id: id });
  if (error || !data) return new Response("Bạn không có quyền xuất dữ liệu sự kiện này.", { status: 403 });
  const exp = data as unknown as ExportData;
  const file = await buildGuestWorkbook(exp);

  const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
  // Tên file không dấu: Chrome bỏ qua filename* (UTF-8) và đặt tên "download" khi tên có dấu.
  const ascii = vnFold(`${exp.title} - khach moi - ${date}.xlsx`)
    .replace(/[^\w .-]+/g, "-")
    .replace(/\s+/g, " ");
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${ascii}"`,
      "Cache-Control": "no-store",
    },
  });
}
