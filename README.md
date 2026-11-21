# TRAO

Thiệp mời online + quản lý khách mời, xếp bàn và check-in cho sự kiện.
Thiết kế: `trao-design/TRAO-thiet-ke-MVP.md` trong thư mục dự án.

## Công nghệ

- Next.js 16 (App Router, Cache Components) + TypeScript + Tailwind CSS 4
- Supabase: Postgres + RLS, Auth (email OTP / magic link)
- Schema và phân quyền nằm trong `supabase/migrations/`; test pgTAP trong `supabase/tests/database/`

## Chạy ở máy

```bash
pnpm install
cp .env.example .env.local   # điền URL + publishable key của dự án Supabase
pnpm dev                     # http://localhost:3000
```

Hoặc dùng Supabase cục bộ (cần Docker):

```bash
npx supabase start           # in ra API URL và publishable key cục bộ; email xem ở Mailpit
npx supabase test db         # chạy test pgTAP
```

Không có Docker: `DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres pnpm test:db`
chạy migration + test trên Postgres thuần (cần extension pgTAP), dùng một lớp giả lập tối thiểu
`scripts/local-supabase-shim.sql`.

## Quy ước

- Mọi bảng trong `public` bật RLS. Quyền theo sự kiện: `owner`, `cohost`, `staff`, `viewer`
  (hàm `private.has_event_role`). Khách không đăng nhập không đọc trực tiếp bảng nào.
- Thao tác cần kiểm tra quyền phức tạp đi qua RPC `security definer` có kiểm tra `auth.uid()` bên trong
  (`create_event`, `accept_event_invite`, `trash_event`, `restore_event`, `import_guests`, `undo_import`).
- Khách xem thiệp qua `get_invitation(slug)` (chỉ thiệp đã xuất bản). Ảnh thiệp nằm trong bucket
  `event-media`, đường dẫn `<event_id>/<tên file>`; chỉ owner/cohost được ghi.
- Thay đổi schema: thêm file mới trong `supabase/migrations/`, viết test pgTAP đi kèm,
  sinh lại kiểu: `pnpm db:types` (cần `DATABASE_URL` trỏ tới DB đã áp migration).

## Lộ trình

| Giai đoạn | Nội dung | Trạng thái |
|---|---|---|
| M0 | Nền móng: đăng nhập, workspace, sự kiện, buổi tiệc, người quản lý, RLS, CI | xong |
| M1 | Mẫu thiệp, trình sửa, xuất bản, ảnh xem trước Zalo | xong |
| M2 | Khách mời, nhập Excel, link cá nhân, RSVP | đang làm (khách + nhập Excel xong) |
| M3 | Xếp bàn, check-in | |
| M4 | Hoàn thiện, xuất Excel, thử với sự kiện thật | |

## Triển khai

- Đặt `NEXT_PUBLIC_SITE_URL` (vd `https://trao.vn`): dùng cho link thiệp, link đăng nhập và ảnh xem trước.
- Trong Supabase → Authentication → URL Configuration: Site URL = domain trên, thêm Redirect URL `<domain>/auth/callback`.
