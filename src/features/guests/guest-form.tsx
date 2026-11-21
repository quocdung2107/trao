import { ActionForm, SubmitButton } from "@/components/action-form";
import { Input, Label } from "@/components/ui";
import type { ActionState } from "@/app/app/events/actions";
import { GUEST_SIDES } from "@/lib/labels";
import { displayPhone } from "./normalize";

type Defaults = {
  display_name: string;
  salutation: string | null;
  phone_e164: string | null;
  email: string | null;
  side: string | null;
  max_party_size: number;
  notes: string | null;
  groupIds: string[];
  sessionIds: string[];
};

const primaryBtn = "rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-50";
const ghostBtn = "rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold disabled:opacity-50";

/** Form thêm/sửa một đơn vị khách (1 người hoặc 1 hộ). */
export function GuestForm({
  action,
  groups,
  sessions,
  defaults,
  isWedding,
  submitLabel,
  allowAddAnother,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  groups: { id: string; name: string }[];
  sessions: { id: string; name: string }[];
  defaults?: Defaults;
  isWedding: boolean;
  submitLabel: string;
  allowAddAnother?: boolean;
}) {
  const d = defaults;
  const sides = Object.entries(GUEST_SIDES).filter(([k]) => isWedding || k === "host");
  return (
    <ActionForm action={action} className="space-y-5">
      <div>
        <Label htmlFor="displayName">Tên khách</Label>
        <Input id="displayName" name="displayName" required maxLength={150} defaultValue={d?.display_name} placeholder="Anh Minh và gia đình" />
        <p className="mt-1 text-xs text-muted">Một dòng khách có thể là một người hoặc cả gia đình.</p>
      </div>
      <div>
        <Label htmlFor="salutation">Xưng hô trên thiệp</Label>
        <Input id="salutation" name="salutation" maxLength={150} defaultValue={d?.salutation ?? ""} placeholder="Anh Minh" />
        <p className="mt-1 text-xs text-muted">Thiệp sẽ ghi “Trân trọng kính mời …”. Để trống thì dùng tên khách.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="phone">Số điện thoại</Label>
          <Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={displayPhone(d?.phone_e164 ?? null)} placeholder="0912 345 678" />
        </div>
        <div>
          <Label htmlFor="maxPartySize">Số người tối đa</Label>
          <Input id="maxPartySize" name="maxPartySize" type="number" min={1} max={50} required defaultValue={d?.max_party_size ?? 1} />
        </div>
      </div>
      {sides.length > 1 && (
        <fieldset>
          <legend className="mb-1 text-sm font-medium">Khách của</legend>
          <div className="flex flex-wrap gap-2">
            {[["", "Chưa chọn"], ...sides].map(([k, v]) => (
              <label key={k} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm has-checked:border-brand has-checked:bg-brand/5">
                <input type="radio" name="side" value={k} defaultChecked={(d?.side ?? "") === k} />
                {v}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {sides.length === 1 && <input type="hidden" name="side" value={d?.side ?? ""} />}
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Nhóm</legend>
        {groups.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {groups.map((g) => (
              <label key={g.id} className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm has-checked:border-brand has-checked:bg-brand/5">
                <input type="checkbox" name="groups" value={g.id} defaultChecked={d?.groupIds.includes(g.id)} />
                {g.name}
              </label>
            ))}
          </div>
        )}
        <Input name="newGroups" aria-label="Nhóm mới" maxLength={200} placeholder={groups.length ? "Thêm nhóm mới (cách nhau bằng dấu phẩy)" : "Họ nhà trai, Bạn đại học…"} />
      </fieldset>
      {sessions.length > 0 && (
        <fieldset>
          <legend className="mb-1 text-sm font-medium">Mời dự buổi</legend>
          <div className="flex flex-wrap gap-2">
            {sessions.map((s) => (
              <label key={s.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm has-checked:border-brand has-checked:bg-brand/5">
                <input type="checkbox" name="sessions" value={s.id} defaultChecked={d ? d.sessionIds.includes(s.id) : true} />
                {s.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <details className="text-sm" open={Boolean(d?.email || d?.notes)}>
        <summary className="cursor-pointer text-muted">Email, ghi chú</summary>
        <div className="mt-3 space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" maxLength={200} defaultValue={d?.email ?? ""} />
          </div>
          <div>
            <Label htmlFor="notes">Ghi chú (chỉ bạn thấy)</Label>
            <textarea
              id="notes"
              name="notes"
              maxLength={1000}
              rows={3}
              defaultValue={d?.notes ?? ""}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-base outline-none focus:border-brand"
            />
          </div>
        </div>
      </details>
      <div className="flex flex-wrap gap-2">
        <SubmitButton className={primaryBtn} pendingText="Đang lưu…">
          {submitLabel}
        </SubmitButton>
        {allowAddAnother && (
          <SubmitButton name="next" value="again" className={ghostBtn}>
            Lưu và thêm khách khác
          </SubmitButton>
        )}
      </div>
    </ActionForm>
  );
}
