import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Chỉ chạy ở khu vực cần phiên đăng nhập; trang thiệp công khai không cần proxy.
  matcher: ["/app/:path*", "/login", "/auth/:path*", "/invite/:path*"],
};
