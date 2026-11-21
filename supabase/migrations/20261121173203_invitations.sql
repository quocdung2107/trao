-- M1 — Thiệp mời: biến thể thiệp theo sự kiện, ảnh trong Storage, hàm đọc thiệp công khai.
-- Thiết kế: trao-design/TRAO-thiet-ke-MVP.md §4.2, §6.1.

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null default 'Thiệp chính' check (char_length(name) between 1 and 100),
  template_key text not null check (template_key ~ '^[a-z0-9-]{1,40}$'),
  template_version int not null default 1,
  -- 12 ký tự base64url ngẫu nhiên (72 bit): không đoán được, đủ ngắn để gửi qua Zalo.
  slug text not null unique
    default translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/', '-_')
    check (slug ~ '^[A-Za-z0-9_-]{12}$'),
  content jsonb not null default '{}'::jsonb
    check (jsonb_typeof(content) = 'object' and octet_length(content::text) <= 65536),
  -- null = hiện mọi buổi; có giá trị = chỉ các buổi này (vd thiệp nhà trai).
  session_ids uuid[],
  published_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index invitations_event_id_idx on public.invitations (event_id);

create trigger invitations_touch_updated_at
  before update on public.invitations
  for each row execute function private.touch_updated_at();

alter table public.invitations enable row level security;

create policy invitations_select on public.invitations for select to authenticated
  using ((select private.has_event_role(event_id, array['owner', 'cohost', 'staff', 'viewer'])));
create policy invitations_insert on public.invitations for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (select private.has_event_role(event_id, array['owner', 'cohost']))
  );
create policy invitations_update on public.invitations for update to authenticated
  using ((select private.has_event_role(event_id, array['owner', 'cohost'])))
  with check ((select private.has_event_role(event_id, array['owner', 'cohost'])));
create policy invitations_delete on public.invitations for delete to authenticated
  using ((select private.has_event_role(event_id, array['owner', 'cohost'])));

revoke all on public.invitations from anon, authenticated;
grant select, delete on public.invitations to authenticated;
grant insert (event_id, name, template_key, template_version, content, session_ids) on public.invitations to authenticated;
grant update (name, template_key, template_version, content, session_ids, published_at) on public.invitations to authenticated;

-- Thiệp đã xuất bản cho khách (không đăng nhập). Chỉ trả dữ liệu hiển thị, không có ID nội bộ của người dùng.
create function public.get_invitation(p_slug text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'slug', i.slug,
    'template_key', i.template_key,
    'template_version', i.template_version,
    'content', i.content,
    'updated_at', i.updated_at,
    'event', jsonb_build_object('title', e.title, 'event_type', e.event_type, 'timezone', e.timezone),
    'sessions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id, 'name', s.name, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
          'venue_name', s.venue_name, 'address', s.address, 'map_url', s.map_url
        ) order by s.sort, s.starts_at nulls last, s.created_at)
      from public.sessions s
      where s.event_id = e.id and (i.session_ids is null or s.id = any (i.session_ids))
    ), '[]'::jsonb)
  )
  from public.invitations i
  join public.events e on e.id = i.event_id
  where i.slug = p_slug
    and i.published_at is not null
    and e.deleted_at is null
    and e.status <> 'archived';
$$;

revoke all on function public.get_invitation(text) from public;
grant execute on function public.get_invitation(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: ảnh thiệp. Đường dẫn: <event_id>/<tên file>. Đọc công khai (ảnh nằm trên thiệp công khai,
-- tên file ngẫu nhiên); chỉ owner/cohost của sự kiện được ghi.
-- Khối do: bỏ qua khi chạy trên Postgres thuần không có Storage (test cục bộ).
-- ---------------------------------------------------------------------------
-- Thư mục đầu của đường dẫn là event_id; trả null thay vì lỗi khi không phải UUID.
create function private.event_id_from_path(p_name text)
returns uuid
language sql immutable
set search_path = ''
as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid
  end;
$$;
revoke all on function private.event_id_from_path(text) from public, anon;
grant execute on function private.event_id_from_path(text) to authenticated;

do $$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'storage.objects không tồn tại, bỏ qua cấu hình Storage';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('event-media', 'event-media', true, 3145728, array['image/webp', 'image/jpeg', 'image/png'])
  on conflict (id) do nothing;

  execute $p$
    create policy event_media_insert on storage.objects for insert to authenticated
    with check (
      bucket_id = 'event-media'
      and (select private.has_event_role(private.event_id_from_path(name), array['owner', 'cohost']))
    )
  $p$;
  execute $p$
    create policy event_media_update on storage.objects for update to authenticated
    using (
      bucket_id = 'event-media'
      and (select private.has_event_role(private.event_id_from_path(name), array['owner', 'cohost']))
    )
  $p$;
  execute $p$
    create policy event_media_delete on storage.objects for delete to authenticated
    using (
      bucket_id = 'event-media'
      and (select private.has_event_role(private.event_id_from_path(name), array['owner', 'cohost']))
    )
  $p$;
  -- Đọc qua URL công khai không cần policy; policy select để người quản lý liệt kê/upsert.
  execute $p$
    create policy event_media_select on storage.objects for select to authenticated
    using (
      bucket_id = 'event-media'
      and (select private.has_event_role(private.event_id_from_path(name), array['owner', 'cohost', 'staff', 'viewer']))
    )
  $p$;
end
$$;
