import Link from "next/link";

export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="font-serif text-2xl font-semibold tracking-wide text-brand">
      TRAO
    </Link>
  );
}
