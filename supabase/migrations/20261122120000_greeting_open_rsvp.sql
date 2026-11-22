-- M5a — Loại sự kiện "Lời chúc" (không có tiệc) và RSVP mở qua link chung, có hàng chờ duyệt.
-- Quyết định: trao-research/giang-sinh-2026-mau-thiep-va-quang-ba.md §6 (2), (3).
-- Thiết kế hàng chờ: trao-research/local-first-va-tai-khoan-nhan-vien.md §3.3a.
--
-- Người đăng ký qua link chung KHÔNG thành khách ngay. Họ nằm ở bảng riêng rsvp_requests, nên mọi chức năng
-- đọc bảng guests (danh sách, xếp bàn, check-in, xuất Excel, thống kê) không phải lọc thêm trạng thái.
-- Chủ tiệc duyệt → sinh khách thật (source = 'rsvp_open', có token, xếp bàn được) hoặc gộp vào khách sẵn có.

-- ---------------------------------------------------------------------------
-- 1. Loại sự kiện "Lời chúc"
-- ---------------------------------------------------------------------------
alter table public.events drop constraint events_event_type_check;
alter table public.events add constraint events_event_type_check
  check (event_type in ('wedding', 'birthday', 'first_birthday', 'family', 'christmas', 'corporate', 'other', 'greeting'));

-- Lời chúc không có buổi tiệc: bỏ qua tên buổi đầu tiên nếu client lỡ gửi.
create or replace function public.create_event(
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

  if p_event_type <> 'greeting' and nullif(btrim(p_first_session_name), '') is not null then
    insert into public.sessions (event_id, name) values (v_id, btrim(p_first_session_name));
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Hàng chờ đăng ký qua link chung
-- ---------------------------------------------------------------------------
create table public.rsvp_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 150),
  phone_e164 text check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),               -- không bắt buộc
  party_size int not null check (party_size between 1 and 10),
  session_ids uuid[] not null check (cardinality(session_ids) between 1 and 20),
  note text check (char_length(note) <= 500),
  policy_version text not null check (char_length(policy_version) <= 40),
  -- Người đăng ký giữ token này (trong trình duyệt) để xem đã được duyệt chưa.
  token text not null unique
    default translate(encode(extensions.gen_random_bytes(16), 'base64'), '+/=', '-_')
    check (token ~ '^[A-Za-z0-9_-]{22}$'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  guest_id uuid,
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  -- Khách bị xóa hẳn (thùng rác, khách tự xóa) thì bản đăng ký đã duyệt cũng đi theo.
  foreign key (guest_id, event_id) references public.guests (id, event_id) on delete cascade
);
create index rsvp_requests_event_idx on public.rsvp_requests (event_id, status, created_at);
create index rsvp_requests_invitation_idx on public.rsvp_requests (invitation_id, created_at);
create index rsvp_requests_guest_idx on public.rsvp_requests (guest_id) where guest_id is not null;

alter table public.rsvp_requests enable row level security;
create policy rsvp_requests_select on public.rsvp_requests for select to authenticated
  using ((select private.has_event_role(event_id, array['owner', 'cohost'])));
revoke all on public.rsvp_requests from anon, authenticated;
grant select on public.rsvp_requests to authenticated;
-- Mọi thay đổi đi qua RPC bên dưới.

-- Thiệp công khai: thêm cờ RSVP mở để trang biết có hiện form đăng ký hay không.
create or replace function public.get_invitation(p_slug text)
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
    'open_rsvp', e.event_type <> 'greeting' and coalesce((e.settings ->> 'openRsvp')::boolean, false),
    'rsvp_deadline', e.settings ->> 'rsvpDeadline',
    'sessions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id, 'name', s.name, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
          'venue_name', s.venue_name, 'address', s.address, 'map_url', s.map_url
        ) order by s.sort, s.starts_at nulls last, s.created_at)
      from public.sessions s
      where s.event_id = e.id and (i.session_ids is null or s.id = any (i.session_ids))
    ), '[]'::jsonb),
    'wishes', coalesce((
      select jsonb_agg(jsonb_build_object('author_name', w.author_name, 'message', w.message, 'created_at', w.created_at)
                       order by w.created_at desc)
      from (
        select author_name, message, created_at from public.wishes
        where invitation_id = i.id and status = 'visible'
        order by created_at desc limit 50
      ) w
    ), '[]'::jsonb)
  )
  from public.invitations i
  join public.events e on e.id = i.event_id
  where i.slug = p_slug
    and i.published_at is not null
    and e.deleted_at is null
    and e.status <> 'archived';
$$;

-- Đăng ký tham dự qua link chung. Trả token để người đăng ký xem trạng thái sau.
create function public.submit_open_rsvp(
  p_slug text,
  p_name text,
  p_party_size int,
  p_session_ids uuid[],
  p_phone text default null,
  p_note text default null,
  p_consent_version text default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_inv record;
  v_sessions uuid[];
  v_token text;
begin
  select i.id, i.event_id, i.session_ids, e.event_type, e.settings into v_inv
  from public.invitations i
  join public.events e on e.id = i.event_id
  where i.slug = p_slug and i.published_at is not null and e.deleted_at is null and e.status <> 'archived';
  if v_inv.id is null then
    raise exception 'Không tìm thấy thiệp' using errcode = 'P0002';
  end if;
  if v_inv.event_type = 'greeting' or not coalesce((v_inv.settings ->> 'openRsvp')::boolean, false) then
    raise exception 'Chủ tiệc chưa mở đăng ký qua link này. Vui lòng liên hệ trực tiếp chủ tiệc.' using errcode = 'P0001';
  end if;
  if (v_inv.settings ->> 'rsvpDeadline')::timestamptz < now() then
    raise exception 'Đã quá hạn đăng ký. Vui lòng liên hệ trực tiếp chủ tiệc.' using errcode = 'P0001';
  end if;
  if p_consent_version is null then
    raise exception 'Vui lòng đồng ý với cách TRAO dùng thông tin của bạn' using errcode = 'P0001';
  end if;
  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'Hãy cho biết tên bạn' using errcode = 'P0001';
  end if;
  if p_party_size is null or p_party_size not between 1 and 10 then
    raise exception 'Số người đi từ 1 đến 10. Đông hơn, vui lòng báo trực tiếp chủ tiệc.' using errcode = 'P0001';
  end if;
  if p_phone is not null and p_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Số điện thoại chưa đúng' using errcode = 'P0001';
  end if;

  -- Chỉ các buổi thiệp này mời.
  select coalesce(array_agg(s.id), '{}') into v_sessions
  from public.sessions s
  where s.event_id = v_inv.event_id
    and s.id = any (p_session_ids)
    and (v_inv.session_ids is null or s.id = any (v_inv.session_ids));
  if cardinality(v_sessions) = 0 or cardinality(v_sessions) <> (select count(distinct x) from unnest(p_session_ids) x) then
    raise exception 'Hãy chọn buổi bạn sẽ đến' using errcode = 'P0001';
  end if;

  -- Chống spam trên link công khai.
  if (select count(*) from public.rsvp_requests
      where invitation_id = v_inv.id and created_at > now() - interval '10 minutes') >= 30 then
    raise exception 'Đang có nhiều người đăng ký, vui lòng thử lại sau ít phút' using errcode = 'P0001';
  end if;
  if (select count(*) from public.rsvp_requests where event_id = v_inv.event_id and status = 'pending') >= 1000 then
    raise exception 'Danh sách chờ đã đầy. Vui lòng liên hệ trực tiếp chủ tiệc.' using errcode = 'P0001';
  end if;
  if p_phone is not null and exists (
    select 1 from public.rsvp_requests where event_id = v_inv.event_id and phone_e164 = p_phone and status = 'pending'
  ) then
    raise exception 'Số điện thoại này đã đăng ký và đang chờ chủ tiệc xác nhận' using errcode = 'P0001';
  end if;

  insert into public.rsvp_requests (event_id, invitation_id, name, phone_e164, party_size, session_ids, note, policy_version)
  values (v_inv.event_id, v_inv.id, left(btrim(p_name), 150), p_phone, p_party_size, v_sessions,
          nullif(left(btrim(coalesce(p_note, '')), 500), ''), left(p_consent_version, 40))
  returning token into v_token;

  return jsonb_build_object('token', v_token, 'status', 'pending');
end;
$$;
revoke all on function public.submit_open_rsvp(text, text, int, uuid[], text, text, text) from public;
grant execute on function public.submit_open_rsvp(text, text, int, uuid[], text, text, text) to anon, authenticated;

-- Người đăng ký xem trạng thái. Đã duyệt → trả token khách để mở thiệp cá nhân (RSVP, thẻ QR).
create function public.get_open_rsvp(p_slug text, p_token text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'status', r.status,
    'name', r.name,
    'party_size', r.party_size,
    'guest_token', case when r.status = 'approved' then g.token end
  )
  from public.rsvp_requests r
  join public.invitations i on i.id = r.invitation_id
  left join public.guests g on g.id = r.guest_id and g.deleted_at is null
  where p_token ~ '^[A-Za-z0-9_-]{22}$' and r.token = p_token and i.slug = p_slug;
$$;
revoke all on function public.get_open_rsvp(text, text) from public;
grant execute on function public.get_open_rsvp(text, text) to anon, authenticated;

-- Duyệt: tạo khách mới, hoặc gộp vào khách sẵn có (p_merge_guest_id) khi trùng người.
-- Câu trả lời được ghi là "Sẽ đến" cho các buổi người đó chọn.
create function public.approve_rsvp_request(p_request_id uuid, p_merge_guest_id uuid default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  r public.rsvp_requests;
  v_guest uuid;
  v_max int;
begin
  select * into r from public.rsvp_requests where id = p_request_id for update;
  if not found or not private.has_event_role(r.event_id, array['owner', 'cohost']) then
    raise exception 'Bạn không có quyền duyệt đăng ký này' using errcode = '42501';
  end if;
  if r.status <> 'pending' then
    raise exception 'Đăng ký này đã được xử lý' using errcode = 'P0001';
  end if;

  if p_merge_guest_id is not null then
    update public.guests
    set phone_e164 = coalesce(phone_e164, r.phone_e164),
        max_party_size = greatest(max_party_size, r.party_size)
    where id = p_merge_guest_id and event_id = r.event_id and deleted_at is null
    returning id, max_party_size into v_guest, v_max;
    if v_guest is null then
      raise exception 'Không tìm thấy khách để gộp' using errcode = 'P0002';
    end if;
  else
    insert into public.guests (event_id, display_name, phone_e164, max_party_size, source, created_by)
    values (r.event_id, r.name, r.phone_e164, r.party_size, 'rsvp_open', auth.uid())
    returning id, max_party_size into v_guest, v_max;
  end if;

  insert into public.session_invites
    (event_id, guest_id, session_id, rsvp_status, attending_count, rsvp_note, responded_at, responded_via)
  select r.event_id, v_guest, s.id, 'yes', least(r.party_size, v_max), r.note, r.created_at, 'guest'
  from public.sessions s
  where s.event_id = r.event_id and s.id = any (r.session_ids)
  on conflict (guest_id, session_id) do update
    set rsvp_status = 'yes',
        attending_count = excluded.attending_count,
        rsvp_note = coalesce(excluded.rsvp_note, public.session_invites.rsvp_note),
        responded_at = excluded.responded_at,
        responded_via = 'guest';

  insert into public.consents (event_id, guest_id, policy_version)
  values (r.event_id, v_guest, r.policy_version)
  on conflict (guest_id, policy_version) do nothing;

  -- SĐT và lời nhắn đã chuyển sang khách; không giữ bản thứ hai.
  update public.rsvp_requests
  set status = 'approved', guest_id = v_guest, phone_e164 = null, note = null,
      decided_by = auth.uid(), decided_at = now()
  where id = r.id;

  return v_guest;
end;
$$;
revoke all on function public.approve_rsvp_request(uuid, uuid) from public, anon;
grant execute on function public.approve_rsvp_request(uuid, uuid) to authenticated;

-- Từ chối: xóa ngay SĐT và lời nhắn; bản ghi tự xóa hẳn sau 30 ngày.
create function public.reject_rsvp_request(p_request_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  r public.rsvp_requests;
begin
  select * into r from public.rsvp_requests where id = p_request_id for update;
  if not found or not private.has_event_role(r.event_id, array['owner', 'cohost']) then
    raise exception 'Bạn không có quyền xử lý đăng ký này' using errcode = '42501';
  end if;
  if r.status <> 'pending' then
    raise exception 'Đăng ký này đã được xử lý' using errcode = 'P0001';
  end if;
  update public.rsvp_requests
  set status = 'rejected', phone_e164 = null, note = null, decided_by = auth.uid(), decided_at = now()
  where id = r.id;
end;
$$;
revoke all on function public.reject_rsvp_request(uuid) from public, anon;
grant execute on function public.reject_rsvp_request(uuid) to authenticated;

-- Dọn hằng đêm: thêm bản đăng ký bị từ chối quá 30 ngày.
create or replace function private.purge_trash()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_guests int;
  v_events int;
  v_requests int;
begin
  delete from public.guests where deleted_at < now() - interval '30 days';
  get diagnostics v_guests = row_count;
  delete from public.events where deleted_at < now() - interval '30 days';
  get diagnostics v_events = row_count;
  delete from public.rsvp_requests where status = 'rejected' and decided_at < now() - interval '30 days';
  get diagnostics v_requests = row_count;
  return jsonb_build_object('guests', v_guests, 'events', v_events, 'requests', v_requests);
end;
$$;
revoke all on function private.purge_trash() from public, authenticated;

-- Tổng quan sự kiện: thêm số đăng ký đang chờ duyệt (chỉ owner/cohost thấy số này).
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
    'requests_pending', case when private.has_event_role(p_event_id, array['owner', 'cohost'])
      then (select count(*) from public.rsvp_requests where event_id = p_event_id and status = 'pending') else 0 end,
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
