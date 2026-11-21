import type { ComponentProps } from "react";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: "primary" | "ghost" | "danger" }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50",
        variant === "primary" && "bg-brand text-white hover:bg-brand-strong",
        variant === "ghost" && "border border-border bg-surface text-foreground hover:bg-background",
        variant === "danger" && "border border-danger/30 bg-surface text-danger hover:bg-danger/5",
        className,
      )}
    />
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={cx(
        "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/20",
        className,
      )}
    />
  );
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      {...props}
      className={cx(
        "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/20",
        className,
      )}
    />
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label {...props} className={cx("mb-1 block text-sm font-medium", className)} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={cx("rounded-xl border border-border bg-surface p-5", className)} />;
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-2 text-sm text-danger">
      {message}
    </p>
  );
}
