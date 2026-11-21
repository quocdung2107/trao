import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { siteUrl } from "@/lib/site-url";

// Nhận liên kết trong email đăng nhập: PKCE (`code`) hoặc mẫu email dùng `token_hash`.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  // request.nextUrl.origin có thể là host nội bộ (vd sau proxy); dùng URL công khai của site.
  const origin = await siteUrl();
  const next = safeNext(searchParams.get("next"));
  const supabase = await createClient();

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("missing token") };

  if (error) return NextResponse.redirect(`${origin}/login?error=link&next=${encodeURIComponent(next)}`);
  return NextResponse.redirect(`${origin}${next}`);
}
