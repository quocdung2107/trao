-- M2b — RSVP qua link cá nhân, đồng ý dữ liệu, lời chúc, thống kê sự kiện.
-- Thiết kế: trao-design/TRAO-thiet-ke-MVP.md §4.2, §4.4, §5.2, §6.6.
--
-- Khách không đăng nhập: mọi đọc/ghi đi qua RPC security definer, xác thực bằng token 128 bit của khách.
-- Không RPC nào trả SĐT, email hay ghi chú nội bộ.

-- Bằng chứng khách đồng ý chính sách dữ liệu khi trả lời (một dòng cho mỗi phiên bản chính sách).
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  guest_id uuid not null,
  policy_version text not null check (char_length(policy_version) <= 40),
  consented_at timestamptz not null default now(),
  unique (guest_id, policy_version),
  foreign key (guest_id, event_id) references public.guests (id, event_id) on delete cascade
);
create index consents_event_id_idx on public.consents (event_id);

create table public.wishes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  guest_id uuid references public.guests (id) on delete set null,
  author_name text not null check (char_length(author_name) between 1 and 80),
  message text not null check (char_length(message) between 1 and 500),
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now()
);
create index wishes_invitation_id_idx on public.wishes (invitation_id, created_at desc);
create index wishes_event_id_idx on public.wishes (event_id);
create index wishes_guest_id_idx on public.wishes (guest_id) where guest_id is not null;

alter table public.consents enable row level security;
alter table public.wishes enable row level security;

create policy consents_select on public.consents for select to authenticated
  using ((select private.has_event_role(event_id, array['owner', 'cohost'])));
-- Lời chúc: mọi vai trò xem được (hiện công khai trên thiệp); owner/cohost ẩn hoặc xóa.
create policy wishes_select on public.wishes for select to authenticated
  using ((select private.has_event_role(event_id, array['owner', 'cohost', 'staff', 'viewer'])));
create policy wishes_update on public.wishes for update to authenticated
  using ((select private.has_event_role(event_id, array['owner', 'cohost'])))
  with check ((select private.has_event_role(event_id, array['owner', 'cohost'])));
create policy wishes_delete on public.wishes for delete to authenticated
  using ((select private.has_event_role(event_id, array['owner', 'cohost'])));

revoke all on public.consents, public.wishes from anon, authenticated;
grant select on public.consents to authenticated;
grant select, delete on public.wishes to authenticated;
grant update (status) on public.wishes to authenticated;

-- ---------------------------------------------------------------------------
-- Khách theo token: chỉ khi token thuộc đúng sự kiện của thiệp đã xuất bản, khách chưa bị xóa.
-- ---------------------------------------------------------------------------
create function private.guest_for_invitation(p_slug text, p_token text)
returns table (guest_id uuid, event_id uuid, invitation_id uuid, max_party_size int)
language sql stable security definer
set search_path = ''
as $$
  select g.id, g.event_id, i.id, g.max_party_size
  from public.invitations i
  join public.events e on e.id = i.event_id
  join public.guests g on g.event_id = i.event_id
  where i.slug = p_slug
    and i.published_at is not null
    and e.deleted_at is null
    and e.status <> 'archived'
    and g.token = p_token
    and g.deleted_at is null;
$$;
revoke all on function private.guest_for_invitation(text, text) from public, anon, authenticated;

-- Phần riêng của khách trên thiệp: xưng hô, buổi được mời, câu trả lời hiện tại.
create function public.get_guest_invitation(p_slug text, p_token text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'salutation', coalesce(g.salutation, g.display_name),
    'max_party_size', g.max_party_size,
    'rsvp_deadline', e.settings ->> 'rsvpDeadline',
    'rsvp_closed', coalesce((e.settings ->> 'rsvpDeadline')::timestamptz < now(), false),
    'consented', exists (select 1 from public.consents c where c.guest_id = g.id),
    'invites', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'session_id', s.id, 'name', s.name, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
          'venue_name', s.venue_name, 'address', s.address, 'map_url', s.map_url,
          'rsvp_status', si.rsvp_status, 'attending_count', si.attending_count, 'rsvp_note', si.rsvp_note
        ) order by s.sort, s.starts_at nulls last, s.created_at)
      from public.session_invites si
      join public.sessions s on s.id = si.session_id
      where si.guest_id = g.id
    ), '[]'::jsonb)
  )
  from private.guest_for_invitation(p_slug, p_token) k
  join public.guests g on g.id = k.guest_id
  join public.events e on e.id = k.event_id;
$$;
revoke all on function public.get_guest_invitation(text, text) from public;
grant execute on function public.get_guest_invitation(text, text) to anon, authenticated;

-- Khách trả lời. p_responses: [{session_id, status: yes|no|maybe, count}]; chỉ các buổi khách được mời.
create function public.submit_rsvp(
  p_slug text,
  p_token text,
  p_responses jsonb,
  p_note text default null,
  p_consent_version text default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  k record;
  r jsonb;
  v_status text;
  v_count int;
  v_deadline timestamptz;
  v_updated int;
begin
  select * into k from private.guest_for_invitation(p_slug, p_token);
  if k.guest_id is null then
    raise exception 'Link mời không còn hiệu lực' using errcode = 'P0002';
  end if;

  select (settings ->> 'rsvpDeadline')::timestamptz into v_deadline from public.events where id = k.event_id;
  if v_deadline is not null and v_deadline < now() then
    raise exception 'Đã quá hạn trả lời. Vui lòng liên hệ trực tiếp chủ tiệc.' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.consents where guest_id = k.guest_id) then
    if p_consent_version is null then
      raise exception 'Vui lòng đồng ý với cách TRAO dùng thông tin của bạn' using errcode = 'P0001';
    end if;
  end if;
  if p_consent_version is not null then
    insert into public.consents (event_id, guest_id, policy_version)
    values (k.event_id, k.guest_id, left(p_consent_version, 40))
    on conflict (guest_id, policy_version) do nothing;
  end if;

  if jsonb_typeof(p_responses) is distinct from 'array' or jsonb_array_length(p_responses) = 0 then
    raise exception 'Chưa có câu trả lời' using errcode = 'P0001';
  end if;

  for r in select * from jsonb_array_elements(p_responses) loop
    v_status := r ->> 'status';
    if v_status not in ('yes', 'no', 'maybe') then
      raise exception 'Câu trả lời không hợp lệ' using errcode = 'P0001';
    end if;
    v_count := case
      when v_status = 'no' then 0
      else least(greatest(coalesce((r ->> 'count')::int, 1), 1), k.max_party_size)
    end;
    update public.session_invites
    set rsvp_status = v_status,
        attending_count = v_count,
        rsvp_note = nullif(left(btrim(coalesce(p_note, '')), 500), ''),
        responded_at = now(),
        responded_via = 'guest'
    where guest_id = k.guest_id and session_id = (r ->> 'session_id')::uuid;
    get diagnostics v_updated = row_count;
    if v_updated = 0 then
      raise exception 'Bạn không được mời buổi này' using errcode = 'P0001';
    end if;
  end loop;

  return public.get_guest_invitation(p_slug, p_token);
end;
$$;
revoke all on function public.submit_rsvp(text, text, jsonb, text, text) from public;
grant execute on function public.submit_rsvp(text, text, jsonb, text, text) to anon, authenticated;

-- Gửi lời chúc. Có token → gắn với khách. Giới hạn tần suất để chống spam trên link công khai.
create function public.post_wish(p_slug text, p_name text, p_message text, p_token text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_inv record;
  v_guest uuid;
begin
  select i.id, i.event_id into v_inv
  from public.invitations i
  join public.events e on e.id = i.event_id
  where i.slug = p_slug and i.published_at is not null and e.deleted_at is null and e.status <> 'archived';
  if v_inv.id is null then
    raise exception 'Không tìm thấy thiệp' using errcode = 'P0002';
  end if;

  if p_token is not null then
    select guest_id into v_guest from private.guest_for_invitation(p_slug, p_token);
  end if;

  if v_guest is not null then
    if (select count(*) from public.wishes where guest_id = v_guest) >= 5 then
      raise exception 'Bạn đã gửi đủ lời chúc. Cảm ơn bạn!' using errcode = 'P0001';
    end if;
  elsif (select count(*) from public.wishes where invitation_id = v_inv.id and created_at > now() - interval '10 minutes') >= 20 then
    raise exception 'Đang có nhiều lời chúc, vui lòng thử lại sau ít phút' using errcode = 'P0001';
  end if;

  insert into public.wishes (event_id, invitation_id, guest_id, author_name, message)
  values (v_inv.event_id, v_inv.id, v_guest, btrim(p_name), btrim(p_message));
end;
$$;
revoke all on function public.post_wish(text, text, text, text) from public;
grant execute on function public.post_wish(text, text, text, text) to anon, authenticated;

-- Thiệp công khai: thêm lời chúc đang hiện (50 lời gần nhất). Cùng chữ ký nên thay tại chỗ.
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

-- Thống kê cho trang tổng quan: mọi vai trò của sự kiện xem được (viewer không đọc bảng khách).
create function public.event_stats(p_event_id uuid)
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
          coalesce(sum(si.attending_count) filter (where si.rsvp_status = 'yes' and g.id is not null), 0) as attending
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
revoke all on function public.event_stats(uuid) from public, anon;
grant execute on function public.event_stats(uuid) to authenticated;
