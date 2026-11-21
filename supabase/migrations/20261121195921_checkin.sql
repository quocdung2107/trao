-- M3b: check-in tại sảnh, thẻ vào tiệc (QR), chống check-in trùng giữa nhiều máy.
-- Thiết kế §4.2, §4.5, §6.4:
--   * Chốt chống trùng nằm ở DB: index duy nhất có điều kiện, chỉ một lượt "accepted" cho mỗi lượt mời.
--   * id do máy nhân viên tự sinh → gửi lại (mạng chập chờn, bấm hai lần) không nhân đôi.
--   * Lượt đến sau thành "duplicate", kèm thông tin lần đầu để nhân viên quyết định.

create table public.checkins (
  id uuid primary key,
  event_id uuid not null references public.events (id) on delete cascade,
  session_id uuid not null,
  session_invite_id uuid not null,
  arrived_count int not null check (arrived_count between 0 and 50),
  method text not null check (method in ('qr', 'search')),
  status text not null check (status in ('accepted', 'duplicate', 'voided')),
  note text check (char_length(note) <= 200),
  performed_by uuid default auth.uid() references auth.users (id) on delete set null,
  device_id text check (char_length(device_id) <= 64),
  client_at timestamptz,
  server_at timestamptz not null default now(),
  voided_by uuid references auth.users (id) on delete set null,
  voided_at timestamptz,
  voided_reason text check (char_length(voided_reason) <= 200),
  foreign key (session_invite_id, session_id) references public.session_invites (id, session_id) on delete cascade
);
create unique index checkins_one_accepted on public.checkins (session_invite_id) where status = 'accepted';
create index checkins_session_id_idx on public.checkins (session_id, server_at desc);
create index checkins_event_id_idx on public.checkins (event_id);
create index checkins_performed_by_idx on public.checkins (performed_by);
create index checkins_voided_by_idx on public.checkins (voided_by);

-- Đọc để máy khác thấy ngay (Realtime tôn trọng RLS); ghi chỉ qua RPC.
alter table public.checkins enable row level security;
create policy checkins_select on public.checkins for select to authenticated
  using ((select private.has_event_role(event_id, array['owner', 'cohost', 'staff'])));
grant select on public.checkins to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.checkins;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Tra cứu khách của một buổi: theo tên không dấu, 3–4 số cuối SĐT, hoặc token trong mã QR.
-- Nhân viên chỉ thấy 3 số cuối SĐT.
-- ---------------------------------------------------------------------------
create function public.checkin_find(p_session_id uuid, p_query text default null, p_token text default null)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_q text := private.vn_fold(coalesce(trim(p_query), ''));
  v_digits text := regexp_replace(coalesce(p_query, ''), '\D', '', 'g');
  v_items jsonb;
  v_other text;
begin
  select event_id into v_event_id from public.sessions where id = p_session_id;
  if v_event_id is null or not private.has_event_role(v_event_id, array['owner', 'cohost', 'staff']) then
    raise exception 'Bạn không có quyền check-in buổi này' using errcode = '42501';
  end if;
  if p_token is null and char_length(v_q) < 2 and char_length(v_digits) < 3 then
    return jsonb_build_object('items', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(x order by x.name), '[]'::jsonb) into v_items from (
    select si.id as invite_id, g.display_name as name, g.salutation, si.rsvp_status as rsvp,
      private.seats_needed(si.rsvp_status, si.attending_count, g.max_party_size) as party,
      case when g.phone_e164 is not null then right(g.phone_e164, 3) end as phone_last3,
      coalesce((
        select jsonb_agg(t.label order by t.sort, t.label)
        from public.seat_assignments sa join public.tables t on t.id = sa.table_id
        where sa.session_invite_id = si.id
      ), '[]'::jsonb) as tables,
      (
        select jsonb_build_object('id', c.id, 'at', c.server_at, 'count', c.arrived_count,
          'by', coalesce(p.display_name, 'Nhân viên'), 'mine', c.performed_by = (select auth.uid()))
        from public.checkins c left join public.profiles p on p.id = c.performed_by
        where c.session_invite_id = si.id and c.status = 'accepted'
      ) as checked_in
    from public.session_invites si
    join public.guests g on g.id = si.guest_id and g.deleted_at is null
    where si.session_id = p_session_id
      and case
        when p_token is not null then g.token = p_token
        when char_length(v_digits) >= 3 and v_digits = regexp_replace(p_query, '[\s.]', '', 'g')
          then g.phone_e164 like '%' || v_digits
        else g.search_text like '%' || v_q || '%'
      end
    order by g.display_name
    limit 30
  ) x;

  -- Mã QR đúng nhưng khách không được mời buổi này: nói rõ để nhân viên hướng dẫn.
  if p_token is not null and jsonb_array_length(v_items) = 0 then
    select g.display_name into v_other from public.guests g
    where g.token = p_token and g.event_id = v_event_id and g.deleted_at is null;
  end if;

  return jsonb_build_object('items', v_items, 'not_invited', v_other);
end;
$$;
revoke all on function public.checkin_find(uuid, text, text) from public, anon;
grant execute on function public.checkin_find(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Ghi một lượt check-in. Gọi lại cùng p_id trả về đúng kết quả cũ.
-- ---------------------------------------------------------------------------
create function public.checkin(
  p_id uuid,
  p_invite_id uuid,
  p_arrived int,
  p_method text default 'search',
  p_device_id text default null,
  p_client_at timestamptz default null,
  p_note text default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_inv record;
  v_row public.checkins;
  v_first jsonb;
begin
  select si.id, si.session_id, si.event_id into v_inv
  from public.session_invites si
  join public.guests g on g.id = si.guest_id and g.deleted_at is null
  where si.id = p_invite_id;
  if v_inv.id is null or not private.has_event_role(v_inv.event_id, array['owner', 'cohost', 'staff']) then
    raise exception 'Không tìm thấy khách trong buổi này' using errcode = 'P0002';
  end if;
  if p_arrived is null or p_arrived < 0 or p_arrived > 50 then
    raise exception 'Số người đến chưa hợp lệ' using errcode = '22023';
  end if;

  select * into v_row from public.checkins where id = p_id;
  if v_row.id is null then
    begin
      insert into public.checkins (id, event_id, session_id, session_invite_id, arrived_count, method, status,
        note, device_id, client_at)
      values (p_id, v_inv.event_id, v_inv.session_id, p_invite_id, p_arrived, p_method, 'accepted',
        nullif(trim(p_note), ''), left(p_device_id, 64), p_client_at)
      returning * into v_row;
    exception when unique_violation then
      insert into public.checkins (id, event_id, session_id, session_invite_id, arrived_count, method, status,
        note, device_id, client_at)
      values (p_id, v_inv.event_id, v_inv.session_id, p_invite_id, p_arrived, p_method, 'duplicate',
        nullif(trim(p_note), ''), left(p_device_id, 64), p_client_at)
      returning * into v_row;
    end;
  elsif v_row.session_invite_id <> p_invite_id then
    raise exception 'Mã lượt check-in bị trùng' using errcode = '22023';
  end if;

  if v_row.status = 'duplicate' then
    select jsonb_build_object('at', c.server_at, 'count', c.arrived_count, 'by', coalesce(p.display_name, 'Nhân viên'))
      into v_first
    from public.checkins c left join public.profiles p on p.id = c.performed_by
    where c.session_invite_id = p_invite_id and c.status = 'accepted';
  end if;

  return jsonb_build_object('result', case when v_row.status = 'accepted' then 'ok' else v_row.status end,
    'id', v_row.id, 'at', v_row.server_at, 'first', v_first);
end;
$$;
revoke all on function public.checkin(uuid, uuid, int, text, text, timestamptz, text) from public, anon;
grant execute on function public.checkin(uuid, uuid, int, text, text, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Hủy check-in: nhân viên hủy được lượt của chính mình; chủ tiệc / đồng tổ chức hủy được mọi lượt.
-- ---------------------------------------------------------------------------
create function public.checkin_void(p_checkin_id uuid, p_reason text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_row public.checkins;
begin
  select * into v_row from public.checkins where id = p_checkin_id;
  if v_row.id is null
    or not (private.has_event_role(v_row.event_id, array['owner', 'cohost'])
      or (private.has_event_role(v_row.event_id, array['staff']) and v_row.performed_by = (select auth.uid()))) then
    raise exception 'Bạn không hủy được lượt check-in này' using errcode = '42501';
  end if;
  if v_row.status = 'voided' then
    return;
  end if;
  update public.checkins
  set status = 'voided', voided_by = (select auth.uid()), voided_at = now(), voided_reason = nullif(trim(p_reason), '')
  where id = p_checkin_id;
  insert into public.audit_log (event_id, action, entity, entity_id, before)
  select v_row.event_id, 'checkin.void', 'session_invite', v_row.session_invite_id,
    jsonb_build_object('guest', g.display_name, 'count', v_row.arrived_count, 'reason', nullif(trim(p_reason), ''),
      'session', s.name)
  from public.session_invites si
  join public.guests g on g.id = si.guest_id
  join public.sessions s on s.id = si.session_id
  where si.id = v_row.session_invite_id;
end;
$$;
revoke all on function public.checkin_void(uuid, text) from public, anon;
grant execute on function public.checkin_void(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Số liệu sảnh: đã đến / dự kiến.
-- ---------------------------------------------------------------------------
create function public.checkin_summary(p_session_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
begin
  select event_id into v_event_id from public.sessions where id = p_session_id;
  if v_event_id is null or not private.has_event_role(v_event_id, array['owner', 'cohost', 'staff', 'viewer']) then
    raise exception 'Bạn không có quyền xem buổi này' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'guests_expected', count(*) filter (where si.rsvp_status <> 'no'),
      'people_expected', coalesce(sum(private.seats_needed(si.rsvp_status, si.attending_count, g.max_party_size))
        filter (where si.rsvp_status <> 'no'), 0),
      'guests_arrived', count(c.id),
      'people_arrived', coalesce(sum(c.arrived_count), 0))
    from public.session_invites si
    join public.guests g on g.id = si.guest_id and g.deleted_at is null
    left join public.checkins c on c.session_invite_id = si.id and c.status = 'accepted'
    where si.session_id = p_session_id
  );
end;
$$;
revoke all on function public.checkin_summary(uuid) from public, anon;
grant execute on function public.checkin_summary(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Thẻ vào tiệc của khách (trang /c/<token>): công khai với ai có token, không trả SĐT.
-- Số bàn chỉ hiện khi chủ tiệc bật settings.showTableToGuest.
-- ---------------------------------------------------------------------------
create function public.get_guest_pass(p_token text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'event_title', e.title,
    'name', coalesce(g.salutation, g.display_name),
    'party', g.max_party_size,
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
          'name', s.name, 'starts_at', s.starts_at, 'venue_name', s.venue_name, 'address', s.address,
          'rsvp', si.rsvp_status,
          'tables', case when coalesce((e.settings ->> 'showTableToGuest')::boolean, false) then coalesce((
            select jsonb_agg(t.label order by t.sort, t.label)
            from public.seat_assignments sa join public.tables t on t.id = sa.table_id
            where sa.session_invite_id = si.id), '[]'::jsonb) end)
        order by s.sort, s.starts_at)
      from public.session_invites si join public.sessions s on s.id = si.session_id
      where si.guest_id = g.id and si.rsvp_status <> 'no'
    ), '[]'::jsonb))
  from public.guests g
  join public.events e on e.id = g.event_id and e.deleted_at is null
  where p_token ~ '^[A-Za-z0-9_-]{22}$' and g.token = p_token and g.deleted_at is null;
$$;
revoke all on function public.get_guest_pass(text) from public;
grant execute on function public.get_guest_pass(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tổng quan sự kiện: thêm số khách đã đến từng buổi.
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
          (select count(*) from public.tables t where t.session_id = s.id) as tables,
          count(g.id) filter (where exists (
            select 1 from public.checkins c where c.session_invite_id = si.id and c.status = 'accepted')) as arrived
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
