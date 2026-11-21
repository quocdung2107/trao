import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { NewEventForm } from "./new-event-form";

export const metadata: Metadata = { title: "Tạo sự kiện" };

export default function NewEventPage() {
  return (
    <div className="mx-auto max-w-lg">
      <Link href="/app" className="text-sm text-muted">
        ← Sự kiện của tôi
      </Link>
      <h1 className="mt-2 mb-6 font-serif text-2xl">Tạo sự kiện</h1>
      <Card>
        <NewEventForm />
      </Card>
    </div>
  );
}
