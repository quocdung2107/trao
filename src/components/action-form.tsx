"use client";

import { useActionState, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { FormError } from "./ui";

type State = { error?: string | null; ok?: boolean };

/** Form gọi một Server Action trả về `{ error }`, hiện lỗi ngay dưới form. */
export function ActionForm({
  action,
  children,
  className,
  confirm,
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
  children: ReactNode;
  className?: string;
  confirm?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      <FormError message={state.error} />
    </form>
  );
}

/** Nút submit tự vô hiệu khi form đang gửi. */
export function SubmitButton({ pendingText, children, ...props }: ComponentProps<"button"> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || props.disabled} {...props}>
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
