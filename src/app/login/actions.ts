"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

export type LoginState = { step: "email" | "code"; email?: string; next?: string; error?: string; info?: string };

const emailSchema = z.email("Email không hợp lệ");

export async function sendCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const next = safeNext(formData.get("next") as string | null);
  const parsed = emailSchema.safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { step: "email", next, error: parsed.error.issues[0].message };

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { step: "email", next, error: "Không gửi được email. Vui lòng thử lại sau ít phút." };

  return {
    step: "code",
    email: parsed.data,
    next,
    info: "Đã gửi email đăng nhập. Bấm vào liên kết trong email, hoặc nhập mã nếu email có mã.",
  };
}

export async function verifyCode(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "");
  const next = safeNext(formData.get("next") as string | null);
  const token = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!/^\d{6,10}$/.test(token)) return { error: "Mã gồm 6–10 chữ số" };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { error: "Mã không đúng hoặc đã hết hạn" };

  redirect(next);
}
