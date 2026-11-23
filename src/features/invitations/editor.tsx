"use client";

/* eslint-disable @next/next/no-img-element -- ảnh thu nhỏ từ Storage */
import { useState, useTransition } from "react";
import { Button, FormError, Input, Label } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { createClient } from "@/lib/supabase/client";
import { saveInvitation, setInvitationPublished } from "./actions";
import { compressImage } from "./compress";
import { MAX_GALLERY, contentHints, type InvitationContent, type Person } from "./content";
import { MUSIC_NONE, MUSIC_PRESET, MUSIC_TRACKS } from "./templates/festive/music";
import { InvitationTemplate, isFestiveTemplate, TEMPLATES } from "./templates/registry";
import { mediaUrl, withoutPartyIfGreeting, type InvitationSession } from "./view";

type Props = {
  invitationId: string;
  eventId: string;
  event: { title: string; event_type: string };
  sessions: InvitationSession[];
  initial: { name: string; templateKey: string; content: InvitationContent; sessionIds: string[] | null };
  publishedAt: string | null;
  publicUrl: string;
};

const textarea =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export function InvitationEditor(props: Props) {
  const [name, setName] = useState(props.initial.name);
  const [templateKey, setTemplateKey] = useState(props.initial.templateKey);
  const [content, setContent] = useState(props.initial.content);
  const [sessionIds, setSessionIds] = useState<string[] | null>(props.initial.sessionIds);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [saving, startSave] = useTransition();
  const [publishing, startPublish] = useTransition();
  const published = Boolean(props.publishedAt);
  const hints = contentHints(props.event.event_type);
  const party = props.event.event_type !== "greeting";

  const touch = () => {
    setDirty(true);
    setNotice(null);
  };
  const set = <K extends keyof InvitationContent>(k: K, val: InvitationContent[K]) => {
    setContent((c) => ({ ...c, [k]: val }));
    touch();
  };
  const setPerson = (i: number, patch: Partial<Person>) =>
    set(
      "people",
      content.people.map((p, j) => (j === i ? { ...p, ...patch } : p)),
    );

  const visibleSessions = sessionIds ? props.sessions.filter((s) => sessionIds.includes(s.id)) : props.sessions;

  function save(after?: () => void) {
    setError(null);
    startSave(async () => {
      const res = await saveInvitation(props.invitationId, { name, templateKey, content, sessionIds });
      if (res.error) return setError(res.error);
      setDirty(false);
      setNotice("Đã lưu");
      after?.();
    });
  }

  function togglePublish() {
    const run = () =>
      startPublish(async () => {
        const res = await setInvitationPublished(props.invitationId, !published);
        if (res.error) setError(res.error);
        else setNotice(published ? "Đã ngừng xuất bản" : "Đã xuất bản. Link thiệp đã sẵn sàng để gửi.");
      });
    // Xuất bản luôn kèm bản mới nhất.
    if (dirty) save(run);
    else run();
  }

  async function upload(files: FileList | null, target: "cover" | "gallery") {
    if (!files?.length) return;
    setError(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const room = target === "cover" ? 1 : MAX_GALLERY - content.gallery.length;
      const paths: string[] = [];
      for (const file of Array.from(files).slice(0, room)) {
        if (!file.type.startsWith("image/")) continue;
        const { blob, ext } = await compressImage(file, { format: target === "cover" ? "jpeg" : "webp" });
        const path = `${props.eventId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("event-media")
          .upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
        if (upErr) throw upErr;
        paths.push(path);
      }
      if (target === "cover") set("coverImage", paths[0] ?? content.coverImage);
      else set("gallery", [...content.gallery, ...paths]);
    } catch {
      setError("Không tải được ảnh lên. Ảnh tối đa 3MB sau khi nén; hãy thử ảnh khác.");
    } finally {
      setUploading(false);
    }
  }

  const preview = (
    <div className="mx-auto w-full max-w-[400px] overflow-hidden rounded-[2rem] border-8 border-foreground/90 bg-white shadow-xl">
      <div className="h-[720px] overflow-y-auto">
        <InvitationTemplate
          // Đổi key khi đổi mẫu để màn bìa "Mở thiệp" hiện lại từ đầu.
          key={templateKey}
          templateKey={templateKey}
          frame="preview"
          view={withoutPartyIfGreeting({ content, event: props.event, sessions: visibleSessions })}
        />
      </div>
    </div>
  );

  return (
    <div>
      {/* Thanh trạng thái */}
      <div className="sticky top-0 z-10 -mx-4 mb-4 flex flex-wrap items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${published ? "bg-brand/10 text-brand" : "bg-border text-muted"}`}>
          {published ? "Đã xuất bản" : "Bản nháp"}
        </span>
        <span className="text-xs text-muted">{dirty ? "Có thay đổi chưa lưu" : notice}</span>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={() => save()} disabled={saving || !dirty}>
            {saving ? "Đang lưu…" : "Lưu"}
          </Button>
          <Button onClick={togglePublish} disabled={publishing || saving} variant={published ? "ghost" : "primary"}>
            {publishing ? "…" : published ? "Ngừng xuất bản" : "Xuất bản"}
          </Button>
        </div>
        {error && (
          <div className="w-full">
            <FormError message={error} />
          </div>
        )}
      </div>

      {published && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-brand/30 bg-brand/5 p-3">
          <span className="text-sm font-medium">Link thiệp:</span>
          <code className="min-w-0 flex-1 truncate text-sm">{props.publicUrl}</code>
          <CopyButton text={props.publicUrl} />
          <a href={props.publicUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-brand">
            Mở
          </a>
        </div>
      )}

      <div className="mb-4 flex rounded-lg border border-border bg-surface p-1 lg:hidden">
        {(["edit", "preview"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md py-2 text-sm font-medium ${tab === t ? "bg-brand text-white" : "text-muted"}`}
          >
            {t === "edit" ? "Sửa" : "Xem trước"}
          </button>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
        <div className={`space-y-6 ${tab === "preview" ? "hidden lg:block" : ""}`}>
          {/* Mẫu */}
          <fieldset>
            <legend className="mb-2 font-serif text-lg">Mẫu thiệp</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {TEMPLATES.map((t) => (
                <label
                  key={t.key}
                  className={`cursor-pointer rounded-xl border p-3 ${templateKey === t.key ? "border-brand ring-2 ring-brand/20" : "border-border"} bg-surface`}
                >
                  <input
                    type="radio"
                    name="template"
                    value={t.key}
                    checked={templateKey === t.key}
                    onChange={() => {
                      setTemplateKey(t.key);
                      touch();
                    }}
                    className="sr-only"
                  />
                  <span className="font-medium">{t.name}</span>
                  <span className="mt-1 block text-xs text-muted">{t.description}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Tùy chọn riêng của mẫu lễ hội */}
          {isFestiveTemplate(templateKey) && (
            <fieldset className="space-y-3">
              <legend className="mb-2 font-serif text-lg">Nhạc, chương trình và hiệu ứng</legend>
              <div>
                <Label htmlFor="music">Nhạc nền</Label>
                <select
                  id="music"
                  className={textarea}
                  value={content.music}
                  onChange={(e) => set("music", e.target.value)}
                >
                  <option value={MUSIC_PRESET}>Theo mẫu</option>
                  {Object.entries(MUSIC_TRACKS).map(([k, t]) => (
                    <option key={k} value={k}>
                      {t.name}
                    </option>
                  ))}
                  <option value={MUSIC_NONE}>Không có nhạc</option>
                </select>
                <p className="mt-1 text-xs text-muted">Nhạc chỉ phát sau khi khách bấm &quot;Mở thiệp&quot;. Khách tắt được bất cứ lúc nào.</p>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={content.autoScroll} onChange={(e) => set("autoScroll", e.target.checked)} />
                <span>
                  Tự lướt sau khi mở thiệp
                  <span className="block text-xs text-muted">Dừng ngay khi khách chạm màn hình, và dừng hẳn trước phần thông tin buổi tiệc.</span>
                </span>
              </label>
              <div>
                <Label htmlFor="marquee">Chữ chạy</Label>
                <Input id="marquee" value={content.marquee} maxLength={160} onChange={(e) => set("marquee", e.target.value)} placeholder="Để trống để dùng câu mặc định của mẫu" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Chương trình (không bắt buộc)</p>
                {content.program.map((it, i) => (
                  <div key={i} className="grid grid-cols-[80px_1fr_auto] gap-2">
                    <Input
                      aria-label="Giờ"
                      value={it.time}
                      maxLength={10}
                      placeholder="18:00"
                      onChange={(e) => set("program", content.program.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))}
                    />
                    <Input
                      aria-label="Nội dung"
                      value={it.title}
                      maxLength={80}
                      placeholder="Đón khách"
                      onChange={(e) => set("program", content.program.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                    />
                    <button type="button" className="text-sm text-danger" onClick={() => set("program", content.program.filter((_, j) => j !== i))}>
                      Bỏ
                    </button>
                  </div>
                ))}
                {content.program.length < 10 && (
                  <button type="button" className="text-sm font-medium text-brand" onClick={() => set("program", [...content.program, { time: "", title: "" }])}>
                    + Thêm mục
                  </button>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={content.showGift} onChange={(e) => set("showGift", e.target.checked)} />
                Hộp quà bấm để mở, có lời chúc bất ngờ
              </label>
              {content.showGift && (
                <div>
                  <Label htmlFor="giftMessage">Lời chúc trong hộp quà</Label>
                  <textarea
                    id="giftMessage"
                    className={textarea}
                    rows={2}
                    maxLength={300}
                    value={content.giftMessage}
                    onChange={(e) => set("giftMessage", e.target.value)}
                    placeholder="Để trống để dùng câu mặc định của mẫu"
                  />
                </div>
              )}
            </fieldset>
          )}

          {/* Nội dung chính */}
          <fieldset className="space-y-3">
            <legend className="mb-2 font-serif text-lg">Nội dung</legend>
            <div>
              <Label htmlFor="title">Tiêu đề lớn</Label>
              <Input id="title" value={content.title} maxLength={80} onChange={(e) => set("title", e.target.value)} placeholder={hints.title} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="subtitle">Dòng phụ</Label>
                <Input id="subtitle" value={content.subtitle} maxLength={80} onChange={(e) => set("subtitle", e.target.value)} placeholder={hints.subtitle} />
              </div>
              <div>
                <Label htmlFor="heading">Lời mở</Label>
                <Input id="heading" value={content.heading} maxLength={80} onChange={(e) => set("heading", e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Nhân vật chính</p>
              {content.people.map((p, i) => (
                <div key={i} className="grid gap-2 rounded-lg border border-border bg-surface p-3 sm:grid-cols-[120px_1fr]">
                  <Input aria-label="Vai" value={p.label} maxLength={40} onChange={(e) => setPerson(i, { label: e.target.value })} placeholder={hints.personLabel} />
                  <Input aria-label="Tên" value={p.name} maxLength={80} onChange={(e) => setPerson(i, { name: e.target.value })} placeholder="Họ tên" />
                  <Input
                    aria-label="Ghi chú"
                    className="sm:col-span-2"
                    value={p.detail}
                    maxLength={160}
                    onChange={(e) => setPerson(i, { detail: e.target.value })}
                    placeholder={hints.personDetail}
                  />
                  <button
                    type="button"
                    className="justify-self-start text-sm text-danger sm:col-span-2"
                    onClick={() => set("people", content.people.filter((_, j) => j !== i))}
                  >
                    Bỏ
                  </button>
                </div>
              ))}
              {content.people.length < 4 && (
                <button
                  type="button"
                  className="text-sm font-medium text-brand"
                  onClick={() => set("people", [...content.people, { label: "", name: "", detail: "" }])}
                >
                  + Thêm người
                </button>
              )}
            </div>

            <div>
              <Label htmlFor="message">{party ? "Lời mời" : "Lời chúc"}</Label>
              <textarea id="message" className={textarea} rows={4} maxLength={1000} value={content.message} onChange={(e) => set("message", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="closing">Lời kết</Label>
              <textarea id="closing" className={textarea} rows={2} maxLength={300} value={content.closing} onChange={(e) => set("closing", e.target.value)} />
            </div>
            {party && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={content.showCountdown} onChange={(e) => set("showCountdown", e.target.checked)} />
                Hiện đồng hồ đếm ngược tới buổi đầu tiên
              </label>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={content.showWishes} onChange={(e) => set("showWishes", e.target.checked)} />
              Cho khách gửi lời chúc trên thiệp
            </label>
          </fieldset>

          {/* Ảnh */}
          <fieldset className="space-y-3">
            <legend className="mb-2 font-serif text-lg">Ảnh</legend>
            <div>
              <p className="mb-1 text-sm font-medium">Ảnh bìa</p>
              <div className="flex items-center gap-3">
                {content.coverImage && (
                  <img src={mediaUrl(content.coverImage)} alt="Ảnh bìa" className="h-20 w-16 rounded-lg object-cover" />
                )}
                <label className="cursor-pointer rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium">
                  {content.coverImage ? "Đổi ảnh" : "Chọn ảnh"}
                  <input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={(e) => upload(e.target.files, "cover")} />
                </label>
                {content.coverImage && (
                  <button type="button" className="text-sm text-danger" onClick={() => set("coverImage", null)}>
                    Bỏ ảnh
                  </button>
                )}
              </div>
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">
                Album ({content.gallery.length}/{MAX_GALLERY})
              </p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {content.gallery.map((p) => (
                  <div key={p} className="relative">
                    <img src={mediaUrl(p)} alt="" className="aspect-square w-full rounded-lg object-cover" />
                    <button
                      type="button"
                      aria-label="Bỏ ảnh"
                      className="absolute top-1 right-1 rounded-full bg-black/60 px-1.5 text-xs text-white"
                      onClick={() => set("gallery", content.gallery.filter((g) => g !== p))}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {content.gallery.length < MAX_GALLERY && (
                  <label className="flex aspect-square cursor-pointer items-center justify-center rounded-lg border border-dashed border-border bg-surface text-2xl text-muted">
                    +
                    <input type="file" accept="image/*" multiple className="sr-only" disabled={uploading} onChange={(e) => upload(e.target.files, "gallery")} />
                  </label>
                )}
              </div>
            </div>
            {uploading && <p className="text-sm text-muted">Đang nén và tải ảnh lên…</p>}
          </fieldset>

          {/* Buổi hiển thị + tên nội bộ */}
          <fieldset className="space-y-3">
            <legend className="mb-2 font-serif text-lg">{party ? "Thiệp này mời dự" : "Thông tin khác"}</legend>
            {!party ? null : props.sessions.length === 0 ? (
              <p className="text-sm text-muted">Sự kiện chưa có buổi tiệc nào. Thêm buổi ở trang sự kiện.</p>
            ) : (
              <div className="space-y-2">
                {props.sessions.map((s) => {
                  const checked = sessionIds === null || sessionIds.includes(s.id);
                  return (
                    <label key={s.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const current = sessionIds ?? props.sessions.map((x) => x.id);
                          const next = e.target.checked ? [...current, s.id] : current.filter((id) => id !== s.id);
                          setSessionIds(next.length === props.sessions.length ? null : next);
                          touch();
                        }}
                      />
                      {s.name}
                    </label>
                  );
                })}
                <p className="text-xs text-muted">Tạo thiệp riêng cho nhà trai/nhà gái bằng cách chỉ chọn buổi tương ứng.</p>
              </div>
            )}
            <div>
              <Label htmlFor="name">Tên thiệp (chỉ bạn thấy)</Label>
              <Input
                id="name"
                value={name}
                maxLength={100}
                onChange={(e) => {
                  setName(e.target.value);
                  touch();
                }}
              />
            </div>
          </fieldset>
        </div>

        <div className={`${tab === "edit" ? "hidden lg:block" : ""}`}>
          <div className="lg:sticky lg:top-20">{preview}</div>
        </div>
      </div>
    </div>
  );
}
