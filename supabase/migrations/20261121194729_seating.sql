-- M3a: bàn tiệc, xếp chỗ, nhật ký thay đổi.
-- Quy tắc (thiết kế §4.2, §6.3):
--   * Cả đơn vị khách ngồi một bàn; không tự tách.
--   * Số chỗ cần = attending_count nếu đã trả lời "Sẽ đến", ngược lại = max_party_size.
--   * Vượt sức chứa không bị chặn cứng: assign_seats trả về cảnh báo, chủ tiệc xác nhận thì gọi lại với p_allow_over.
--   * Mọi lần xếp / bỏ xếp / xóa bàn được ghi vào audit_log bằng trigger.

-- Cho phép khóa ngoại (id, session_id) từ seat_assignments.
alter table public.session_invites add constraint session_invites_id_session_id_key unique (id, session_id);

-- ---------------------------------------------------------------------------
-- Bảng
-- ---------------------------------------------------------------------------

create table public.tables (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  session_id uuid not null,
  label text not null check (char_length(label) between 1 and 40),     -- "Bàn 12", "VIP 1"
  capacity int not null check (capacity between 1 and 100),
  zone text check (char_length(zone) <= 60),                           -- "Tầng 2", "Khu A"
  sort int not null default 0,
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  unique (session_id, label),
  unique (id, session_id),
  foreign key (session_id, event_id) references public.sessions (id, event_id) on delete cascade
);
create index tables_event_id_idx on public.tables (event_id);

create table public.seat_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  session_id uuid not null,
  session_invite_id uuid not null,
  table_id uuid not null,
  seats int not null check (seats between 1 and 50),
  assigned_by uuid default auth.uid() references auth.users (id) on delete set null,
  assigned_at timestamptz not null default now(),
  unique (session_invite_id, table_id),
  foreign key (session_invite_id, session_id) references public.session_invites (id, session_id) on delete cascade,
  foreign key (table_id, session_id) references public.tables (id, session_id) on delete cascade
);
create index seat_assignments_table_id_idx on public.seat_assignments (table_id);
create index seat_assignments_session_id_idx on public.seat_assignments (session_id);
create index seat_assignments_event_id_idx on public.seat_assignments (event_id);
create index seat_assignments_assigned_by_idx on public.seat_assignments (assigned_by);

-- Nhật ký: không khóa ngoại tới events để bản ghi không chặn việc xóa hẳn sự kiện.
create table public.audit_log (
  id bigint generated always as identity primary key,
  event_id uuid not null,
  actor_id uuid default auth.uid(),
  action text not null check (char_length(action) <= 40),   -- 'seat.assign', 'seat.unassign', 'table.delete'
  entity text not null check (char_length(entity) <= 40),
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_event_id_idx on public.audit_log (event_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS: chỉ chủ tiệc / đồng tổ chức (ma trận §4.3). Nhân viên check-in đọc số bàn qua RPC (M3b).
-- ---------------------------------------------------------------------------
alter table public.tables enable row level security;
alter table public.seat_assignments enable row level security;
alter table public.audit_log enable row level security;

create policy tables_all on public.tables for all to authenticated
  using ((select private.has_event_role(event_id, array['owner', 'cohost'])))
  with check ((select private.has_event_role(event_id, array['owner', 'cohost'])));
create policy seat_assignments_all on public.seat_assignments for all to authenticated
  using ((select private.has_event_role(event_id, array['owner', 'cohost'])))
  with check ((select private.has_event_role(event_id, array['owner', 'cohost'])));
create policy audit_log_select on public.audit_log for select to authenticated
  using ((select private.has_event_role(event_id, array['owner', 'cohost'])));

grant select, delete on public.tables to authenticated;
grant insert (event_id, session_id, label, capacity, zone, sort, note),
  update (label, capacity, zone, sort, note) on public.tables to authenticated;
grant select, delete on public.seat_assignments to authenticated;
grant insert (event_id, session_id, session_invite_id, table_id, seats) on public.seat_assignments to authenticated;
grant select on public.audit_log to authenticated;

-- ---------------------------------------------------------------------------
-- Số chỗ cần cho một lượt mời
-- ---------------------------------------------------------------------------
create function private.seats_needed(p_status text, p_attending int, p_max int)
returns int
language sql immutable
set search_path = ''
as $$
  select case when p_status = 'yes' and coalesce(p_attending, 0) > 0 then p_attending else p_max end;
$$;

-- ---------------------------------------------------------------------------
-- Xếp khách vào bàn (security invoker: RLS quyết định ai được xếp)
-- ---------------------------------------------------------------------------
create function public.assign_seats(p_table_id uuid, p_invite_ids uuid[], p_allow_over boolean default false)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_table public.tables;
  v_needed int;
  v_used int;
  v_count int;
begin
  -- Khóa bàn để hai người xếp cùng lúc không cùng thấy "còn chỗ".
  select * into v_table from public.tables where id = p_table_id for update;
  if not found then
    raise exception 'Không tìm thấy bàn' using errcode = 'P0002';
  end if;

  select count(*), coalesce(sum(private.seats_needed(si.rsvp_status, si.attending_count, g.max_party_size)), 0)
    into v_count, v_needed
  from public.session_invites si
  join public.guests g on g.id = si.guest_id and g.deleted_at is null
  where si.id = any (p_invite_ids) and si.session_id = v_table.session_id;

  if v_count = 0 or v_count <> cardinality(array(select distinct unnest(p_invite_ids))) then
    raise exception 'Có khách không thuộc buổi tiệc này' using errcode = '22023';
  end if;

  select coalesce(sum(sa.seats), 0) into v_used
  from public.seat_assignments sa
  join public.session_invites si on si.id = sa.session_invite_id
  join public.guests g on g.id = si.guest_id and g.deleted_at is null
  where sa.table_id = p_table_id and not (sa.session_invite_id = any (p_invite_ids));

  if v_used + v_needed > v_table.capacity and not p_allow_over then
    return jsonb_build_object('ok', false, 'reason', 'over_capacity',
      'label', v_table.label, 'capacity', v_table.capacity, 'used', v_used, 'needed', v_needed);
  end if;

  -- Đổi bàn = bỏ chỗ cũ trong buổi này rồi xếp chỗ mới.
  delete from public.seat_assignments sa
  where sa.session_invite_id = any (p_invite_ids) and sa.table_id <> p_table_id;

  insert into public.seat_assignments (event_id, session_id, session_invite_id, table_id, seats)
  select v_table.event_id, v_table.session_id, si.id, p_table_id,
    private.seats_needed(si.rsvp_status, si.attending_count, g.max_party_size)
  from public.session_invites si
  join public.guests g on g.id = si.guest_id
  where si.id = any (p_invite_ids)
  on conflict (session_invite_id, table_id) do nothing;

  return jsonb_build_object('ok', true, 'label', v_table.label,
    'over', greatest(v_used + v_needed - v_table.capacity, 0));
end;
$$;
revoke all on function public.assign_seats(uuid, uuid[], boolean) from public, anon;
grant execute on function public.assign_seats(uuid, uuid[], boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Khi khách đổi câu trả lời / số người tối đa: cập nhật số chỗ của khách ngồi một bàn.
-- ---------------------------------------------------------------------------
create function private.sync_seats_from_invite()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.seat_assignments sa
  set seats = private.seats_needed(new.rsvp_status, new.attending_count, g.max_party_size)
  from public.guests g
  where sa.session_invite_id = new.id and g.id = new.guest_id
    and (select count(*) from public.seat_assignments x where x.session_invite_id = new.id) = 1;
  return null;
end;
$$;
create trigger session_invites_sync_seats
  after update of rsvp_status, attending_count on public.session_invites
  for each row execute function private.sync_seats_from_invite();

create function private.sync_seats_from_guest()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.seat_assignments sa
  set seats = private.seats_needed(si.rsvp_status, si.attending_count, new.max_party_size)
  from public.session_invites si
  where sa.session_invite_id = si.id and si.guest_id = new.id
    and (select count(*) from public.seat_assignments x where x.session_invite_id = si.id) = 1;
  return null;
end;
$$;
create trigger guests_sync_seats
  after update of max_party_size on public.guests
  for each row when (old.max_party_size is distinct from new.max_party_size)
  execute function private.sync_seats_from_guest();

-- ---------------------------------------------------------------------------
-- Nhật ký
-- ---------------------------------------------------------------------------
create function private.log_seat_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  r public.seat_assignments := coalesce(new, old);
  v_info jsonb;
begin
  select jsonb_build_object('table_id', r.table_id, 'table', t.label, 'seats', r.seats,
      'guest', g.display_name, 'session', s.name)
    into v_info
  from (select 1) one
  left join public.tables t on t.id = r.table_id
  left join public.session_invites si on si.id = r.session_invite_id
  left join public.guests g on g.id = si.guest_id
  left join public.sessions s on s.id = r.session_id;

  insert into public.audit_log (event_id, action, entity, entity_id, before, after)
  values (r.event_id,
    case when tg_op = 'INSERT' then 'seat.assign' else 'seat.unassign' end,
    'session_invite', r.session_invite_id,
    case when tg_op = 'DELETE' then v_info end,
    case when tg_op = 'INSERT' then v_info end);
  return null;
end;
$$;
create trigger seat_assignments_log
  after insert or delete on public.seat_assignments
  for each row execute function private.log_seat_change();

create function private.log_table_delete()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (event_id, action, entity, entity_id, before)
  values (old.event_id, 'table.delete', 'table', old.id,
    jsonb_build_object('table', old.label, 'capacity', old.capacity));
  return old;
end;
$$;
-- BEFORE để chạy trước khi xóa dây chuyền seat_assignments: lịch sử ghi "xóa bàn" trước các dòng "bỏ xếp".
create trigger tables_log_delete
  before delete on public.tables
  for each row execute function private.log_table_delete();

-- ---------------------------------------------------------------------------
-- Thống kê: thêm số bàn và số khách đã xếp cho từng buổi.
-- ---------------------------------------------------------------------------
create or replace function public.event_stats(p_event_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not private.has_event_role(p_event_id, array['owner', 'cohost', 'staff', 'viewer']) then
    raise exception 'Bạn không có quyền xem sự kiện này' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'guests', (select count(*) from public.guests where event_id = p_event_id and deleted_at is null),
    'max_people', (select coalesce(sum(max_party_size), 0) from public.guests where event_id = p_event_id and deleted_at is null),
    'sent', (select count(*) from public.guests where event_id = p_event_id and deleted_at is null and invite_sent_at is not null),
    'wishes', (select count(*) from public.wishes where event_id = p_event_id and status = 'visible'),
    'sessions', coalesce((
      select jsonb_agg(x order by x.sort, x.created_at) from (
        select s.id, s.name, s.sort, s.created_at,
          count(g.id) as invited,
          count(g.id) filter (where si.rsvp_status = 'yes') as yes,
          count(g.id) filter (where si.rsvp_status = 'no') as no,
          count(g.id) filter (where si.rsvp_status = 'maybe') as maybe,
          count(g.id) filter (where si.rsvp_status = 'pending') as pending,
          coalesce(sum(si.attending_count) filter (where si.rsvp_status = 'yes' and g.id is not null), 0) as attending,
          count(g.id) filter (where si.rsvp_status <> 'no'
            and exists (select 1 from public.seat_assignments sa where sa.session_invite_id = si.id)) as seated,
          count(g.id) filter (where si.rsvp_status <> 'no') as to_seat,
          (select count(*) from public.tables t where t.session_id = s.id) as tables
        from public.sessions s
        left join public.session_invites si on si.session_id = s.id
        left join public.guests g on g.id = si.guest_id and g.deleted_at is null
        where s.event_id = p_event_id
        group by s.id
      ) x
    ), '[]'::jsonb)
  );
end;
$$;
