-- M0 — Nền móng: tài khoản, workspace, sự kiện, buổi tiệc, thành viên và lời mời quản lý.
-- Thiết kế: trao-design/TRAO-thiet-ke-MVP.md §4.

create extension if not exists pgcrypto with schema extensions;

-- Schema private: hàm hỗ trợ RLS, không lộ qua Data API.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Bảng
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 100),
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  kind text not null default 'personal' check (kind in ('personal', 'team')),
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_id_idx on public.workspace_members (user_id);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  event_type text not null default 'wedding'
    check (event_type in ('wedding', 'birthday', 'first_birthday', 'family', 'christmas', 'corporate', 'other')),
  title text not null check (char_length(title) between 1 and 200),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  timezone text not null default 'Asia/Ho_Chi_Minh',
  settings jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index events_workspace_id_idx on public.events (workspace_id);
create index events_created_by_idx on public.events (created_by);

create table public.event_members (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'cohost', 'staff', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index event_members_user_id_idx on public.event_members (user_id);

-- Lời mời quản lý tách khỏi event_members: chỉ owner đọc được token,
-- nên nhân viên không thể tự lấy token của lời mời "đồng tổ chức" để nâng quyền.
create table public.event_invites (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  role text not null check (role in ('cohost', 'staff', 'viewer')),
  token text not null unique default encode(extensions.gen_random_bytes(18), 'base64'),
  note text check (char_length(note) <= 200),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_by uuid references auth.users (id),
  accepted_at timestamptz,
  revoked_at timestamptz
);
create index event_invites_event_id_idx on public.event_invites (event_id);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  starts_at timestamptz,
  ends_at timestamptz,
  venue_name text check (char_length(venue_name) <= 200),
  address text check (char_length(address) <= 500),
  map_url text check (char_length(map_url) <= 1000),
  seating_enabled boolean not null default true,
  checkin_enabled boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);
create index sessions_event_id_idx on public.sessions (event_id);

-- ---------------------------------------------------------------------------
-- Hàm hỗ trợ phân quyền
-- ---------------------------------------------------------------------------

create function private.event_role(p_event_id uuid)
returns text
language sql stable security definer
set search_path = ''
as $$
  select m.role from public.event_members m
  where m.event_id = p_event_id and m.user_id = (select auth.uid());
$$;

create function private.has_event_role(p_event_id uuid, p_roles text[])
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.event_members m
    where m.event_id = p_event_id
      and m.user_id = (select auth.uid())
      and m.role = any (p_roles)
  );
$$;

create function private.has_workspace_role(p_workspace_id uuid, p_roles text[])
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = (select auth.uid())
      and m.role = any (p_roles)
  );
$$;

-- Hai người dùng có cùng quản lý ít nhất một sự kiện (để hiện tên thành viên).
create function private.shares_event_with(p_user_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.event_members a
    join public.event_members b on b.event_id = a.event_id
    where a.user_id = (select auth.uid()) and b.user_id = p_user_id
  );
$$;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Trigger
-- ---------------------------------------------------------------------------

-- Người dùng mới: tạo profile + workspace cá nhân.
create function private.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_ws uuid;
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(split_part(coalesce(new.email, ''), '@', 1), ''));

  insert into public.workspaces (name, kind) values ('Cá nhân', 'personal')
  returning id into v_ws;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_ws, new.id, 'owner');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Người tạo sự kiện thành owner.
create function private.handle_new_event()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.event_members (event_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger on_event_created
  after insert on public.events
  for each row execute function private.handle_new_event();

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger events_touch_updated_at
  before update on public.events
  for each row execute function private.touch_updated_at();

-- Không để sự kiện mất owner cuối cùng.
create function private.protect_last_owner()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and not exists (
       select 1 from public.event_members
       where event_id = old.event_id and role = 'owner' and user_id <> old.user_id
     )
     -- Cho phép khi chính sự kiện đang bị xóa (cascade).
     and exists (select 1 from public.events where id = old.event_id)
  then
    raise exception 'Sự kiện phải còn ít nhất một chủ tiệc' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger event_members_protect_last_owner
  before update or delete on public.event_members
  for each row execute function private.protect_last_owner();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.events enable row level security;
alter table public.event_members enable row level security;
alter table public.event_invites enable row level security;
alter table public.sessions enable row level security;

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.shares_event_with(id)));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- workspaces
create policy workspaces_select on public.workspaces for select to authenticated
  using ((select private.has_workspace_role(id, array['owner', 'admin', 'member'])));
create policy workspaces_update on public.workspaces for update to authenticated
  using ((select private.has_workspace_role(id, array['owner', 'admin'])))
  with check ((select private.has_workspace_role(id, array['owner', 'admin'])));

-- workspace_members
create policy workspace_members_select on public.workspace_members for select to authenticated
  using ((select private.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

-- events: thành viên thấy sự kiện; sự kiện trong thùng rác chỉ owner thấy.
create policy events_select on public.events for select to authenticated
  using (
    (deleted_at is null and (select private.has_event_role(id, array['owner', 'cohost', 'staff', 'viewer'])))
    or (select private.has_event_role(id, array['owner']))
  );
create policy events_insert on public.events for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (select private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']))
  );
create policy events_update on public.events for update to authenticated
  using (deleted_at is null and (select private.has_event_role(id, array['owner', 'cohost'])))
  with check ((select private.has_event_role(id, array['owner', 'cohost'])));

-- event_members
create policy event_members_select on public.event_members for select to authenticated
  using ((select private.has_event_role(event_id, array['owner', 'cohost', 'staff', 'viewer'])));
create policy event_members_update on public.event_members for update to authenticated
  using ((select private.has_event_role(event_id, array['owner'])))
  with check ((select private.has_event_role(event_id, array['owner'])));
create policy event_members_delete on public.event_members for delete to authenticated
  using (
    (select private.has_event_role(event_id, array['owner']))
    or user_id = (select auth.uid())  -- tự rời sự kiện
  );

-- event_invites: chỉ owner
create policy event_invites_select on public.event_invites for select to authenticated
  using ((select private.has_event_role(event_id, array['owner'])));
create policy event_invites_insert on public.event_invites for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (select private.has_event_role(event_id, array['owner']))
  );
create policy event_invites_update on public.event_invites for update to authenticated
  using ((select private.has_event_role(event_id, array['owner'])))
  with check ((select private.has_event_role(event_id, array['owner'])));

-- sessions
create policy sessions_select on public.sessions for select to authenticated
  using ((select private.has_event_role(event_id, array['owner', 'cohost', 'staff', 'viewer'])));
create policy sessions_insert on public.sessions for insert to authenticated
  with check ((select private.has_event_role(event_id, array['owner', 'cohost'])));
create policy sessions_update on public.sessions for update to authenticated
  using ((select private.has_event_role(event_id, array['owner', 'cohost'])))
  with check ((select private.has_event_role(event_id, array['owner', 'cohost'])));
create policy sessions_delete on public.sessions for delete to authenticated
  using ((select private.has_event_role(event_id, array['owner', 'cohost'])));

-- ---------------------------------------------------------------------------
-- Quyền bảng (Data API). Khách không đăng nhập (anon) không đọc trực tiếp bảng nào.
-- ---------------------------------------------------------------------------

revoke all on public.profiles, public.workspaces, public.workspace_members, public.events,
  public.event_members, public.event_invites, public.sessions from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select on public.workspaces to authenticated;
grant update (name) on public.workspaces to authenticated;
grant select on public.workspace_members to authenticated;
grant select on public.events to authenticated;
grant insert (workspace_id, event_type, title, timezone, settings) on public.events to authenticated;
grant update (event_type, title, status, timezone, settings) on public.events to authenticated;
grant select, delete on public.event_members to authenticated;
grant update (role) on public.event_members to authenticated;
grant select (id, event_id, role, token, note, created_by, created_at, expires_at, accepted_by, accepted_at, revoked_at)
  on public.event_invites to authenticated;
grant insert (event_id, role, note, expires_at) on public.event_invites to authenticated;
grant update (revoked_at) on public.event_invites to authenticated;
grant select, insert, update, delete on public.sessions to authenticated;

-- ---------------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------------

-- Nhận lời mời quản lý sự kiện bằng token.
create function public.accept_event_invite(p_token text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_inv public.event_invites;
begin
  if v_uid is null then
    raise exception 'Cần đăng nhập' using errcode = '42501';
  end if;

  select * into v_inv from public.event_invites
  where token = p_token
  for update;

  if not found or v_inv.revoked_at is not null or v_inv.expires_at < now() then
    raise exception 'Lời mời không hợp lệ hoặc đã hết hạn' using errcode = 'P0002';
  end if;
  if v_inv.accepted_by is not null and v_inv.accepted_by <> v_uid then
    raise exception 'Lời mời đã được sử dụng' using errcode = 'P0002';
  end if;

  -- Không hạ quyền người đã là thành viên (vd owner bấm nhầm link staff).
  insert into public.event_members (event_id, user_id, role)
  values (v_inv.event_id, v_uid, v_inv.role)
  on conflict (event_id, user_id) do nothing;

  update public.event_invites
  set accepted_by = v_uid, accepted_at = coalesce(accepted_at, now())
  where id = v_inv.id;

  return v_inv.event_id;
end;
$$;

-- Đưa sự kiện vào thùng rác (chỉ owner). Dọn hẳn sau 30 ngày (job riêng).
create function public.trash_event(p_event_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not private.has_event_role(p_event_id, array['owner']) then
    raise exception 'Chỉ chủ tiệc được xóa sự kiện' using errcode = '42501';
  end if;
  update public.events set deleted_at = now() where id = p_event_id and deleted_at is null;
end;
$$;

create function public.restore_event(p_event_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not private.has_event_role(p_event_id, array['owner']) then
    raise exception 'Chỉ chủ tiệc được khôi phục sự kiện' using errcode = '42501';
  end if;
  update public.events set deleted_at = null where id = p_event_id;
end;
$$;

revoke all on function public.accept_event_invite(text), public.trash_event(uuid), public.restore_event(uuid)
  from public, anon;
grant execute on function public.accept_event_invite(text), public.trash_event(uuid), public.restore_event(uuid)
  to authenticated;

-- Tạo sự kiện (+ buổi tiệc đầu tiên). Dùng RPC thay cho insert trực tiếp vì
-- `insert ... returning` bị RLS chặn: quyền owner chỉ có sau trigger AFTER INSERT.
create function public.create_event(
  p_workspace_id uuid,
  p_title text,
  p_event_type text default 'wedding',
  p_first_session_name text default null
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid := gen_random_uuid();
begin
  if v_uid is null
     or not private.has_workspace_role(p_workspace_id, array['owner', 'admin', 'member']) then
    raise exception 'Không có quyền tạo sự kiện trong workspace này' using errcode = '42501';
  end if;

  insert into public.events (id, workspace_id, title, event_type, created_by)
  values (v_id, p_workspace_id, p_title, p_event_type, v_uid);

  if nullif(btrim(p_first_session_name), '') is not null then
    insert into public.sessions (event_id, name) values (v_id, btrim(p_first_session_name));
  end if;

  return v_id;
end;
$$;

revoke all on function public.create_event(uuid, text, text, text) from public, anon;
grant execute on function public.create_event(uuid, text, text, text) to authenticated;
