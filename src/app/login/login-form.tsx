"use client";

import { useActionState } from "react";
import { Button, FormError, Input, Label } from "@/components/ui";
import { sendCode, verifyCode, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, send, sending] = useActionState(sendCode, { step: "email", next } as LoginState);
  const [codeState, verify, verifying] = useActionState(verifyCode, {});

  if (state.step === "code") {
    return (
      <form action={verify} className="space-y-4">
        <input type="hidden" name="email" value={state.email} />
        <input type="hidden" name="next" value={next} />
        <p className="text-sm text-muted">{state.info}</p>
        <p className="text-sm">
          Email: <strong>{state.email}</strong>
        </p>
        <div>
          <Label htmlFor="code">Mã đăng nhập</Label>
          <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" />
          <FormError message={codeState.error} />
        </div>
        <Button type="submit" disabled={verifying} className="w-full">
          {verifying ? "Đang kiểm tra…" : "Đăng nhập"}
        </Button>
      </form>
    );
  }

  return (
    <form action={send} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="ban@vidu.vn" />
        <FormError message={state.error} />
      </div>
      <Button type="submit" disabled={sending} className="w-full">
        {sending ? "Đang gửi…" : "Gửi email đăng nhập"}
      </Button>
      <p className="text-xs text-muted">Không cần mật khẩu. Tài khoản được tạo tự động ở lần đăng nhập đầu tiên.</p>
    </form>
  );
}
