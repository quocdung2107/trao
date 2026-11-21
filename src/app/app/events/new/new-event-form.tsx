"use client";

import { useActionState, useState } from "react";
import { Button, FormError, Input, Label, Select } from "@/components/ui";
import { EVENT_TYPES, type EventType } from "@/lib/labels";
import { createEvent } from "../actions";

const DEFAULT_SESSION: Record<EventType, string> = {
  wedding: "Tiệc cưới",
  birthday: "Tiệc sinh nhật",
  first_birthday: "Tiệc thôi nôi",
  family: "Tiệc",
  christmas: "Tiệc Giáng sinh",
  corporate: "Sự kiện chính",
  other: "Buổi chính",
};

export function NewEventForm() {
  const [state, action, pending] = useActionState(createEvent, {});
  const [type, setType] = useState<EventType>("wedding");

  return (
    <form action={action} className="space-y-5">
      <div>
        <Label htmlFor="eventType">Loại sự kiện</Label>
        <Select id="eventType" name="eventType" value={type} onChange={(e) => setType(e.target.value as EventType)}>
          {Object.entries(EVENT_TYPES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="title">Tên sự kiện</Label>
        <Input id="title" name="title" required maxLength={200} placeholder="Đám cưới An & Bình" />
      </div>
      <div>
        <Label htmlFor="firstSession">Buổi tiệc đầu tiên</Label>
        <Input
          id="firstSession"
          name="firstSession"
          maxLength={100}
          key={type}
          defaultValue={DEFAULT_SESSION[type]}
        />
        <p className="mt-1 text-xs text-muted">
          Có nhiều buổi (vd tiệc nhà gái, tiệc nhà trai)? Bạn thêm các buổi còn lại ở bước sau.
        </p>
      </div>
      <FormError message={state.error} />
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Đang tạo…" : "Tạo sự kiện"}
      </Button>
    </form>
  );
}
