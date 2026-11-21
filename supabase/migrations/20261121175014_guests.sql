-- M2a — Khách mời: đơn vị khách, nhóm, buổi được mời, lần nhập file.
-- Thiết kế: trao-design/TRAO-thiet-ke-MVP.md §4.2 (Khách mời), §6.2 (Nhập Excel/CSV), §6.5 (link cá nhân).
--
-- Ranh giới sự kiện được DB giữ bằng khóa ngoại kép (id, event_id): một dòng liên kết không thể
-- trỏ tới khách / nhóm / buổi của sự kiện khác, kể cả khi client gửi sai.

-- Bỏ dấu tiếng Việt + chữ thường, để tìm "minh" ra "Minh", "Mính", "MINH"; "dung" ra "Dũng".
create function private.vn_fold(p text)
returns text
language sql immutable parallel safe
set search_path = ''
as $$
  select lower(translate(
    normalize(coalesce(p, ''), NFC),
    'àÀáÁảẢãÃạẠăĂằẰắẮẳẲẵẴặẶâÂầẦấẤẩẨẫẪậẬèÈéÉẻẺẽẼẹẸêÊềỀếẾểỂễỄệỆìÌíÍỉỈĩĨịỊòÒóÓỏỎõÕọỌôÔồỒốỐổỔỗỖộỘơƠờỜớỚởỞỡỠợỢùÙúÚủỦũŨụỤưƯừỪứỨửỬữỮựỰỳỲýÝỷỶỹỸỵỴđĐ',
    'aAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAeEeEeEeEeEeEeEeEeEeEeEiIiIiIiIiIoOoOoOoOoOoOoOoOoOoOoOoOoOoOoOoOoOuUuUuUuUuUuUuUuUuUuUuUyYyYyYyYyYdD'
  ));
$$;
grant execute on function private.vn_fold(text) to authenticated;

-- Buổi tiệc: cần khóa (id, event_id) để session_invites tham chiếu kép.
alter table public.sessions add constraint sessions_id_event_id_key unique (id, event_id);

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  file_name text check (char_length(file_name) <= 200),
  total_rows int not null default 0,
  created_rows int not null default 0,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  undone_at timestamptz
);
create index import_jobs_event_id_idx on public.import_jobs (event_id);

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 150),  -- "Anh Minh và gia đình"
  salutation text check (char_length(salutation) <= 150),                          -- xưng hô trên thiệp
  phone_e164 text check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (char_length(email) <= 200),
  side text check (side in ('bride', 'groom', 'host')),
  max_party_size int not null default 1 check (max_party_size between 1 and 50),
  -- 128 bit ngẫu nhiên, base64url 22 ký tự: link cá nhân và QR.
  token text not null unique
    default translate(encode(extensions.gen_random_bytes(16), 'base64'), '+/=', '-_')
    check (token ~ '^[A-Za-z0-9_-]{22}$'),
  invite_sent_at timestamptz,
  notes text check (char_length(notes) <= 1000),
  source text not null default 'manual' check (source in ('manual', 'import', 'rsvp_open')),
  import_job_id uuid references public.import_jobs (id) on delete set null,
  search_text text generated always as (private.vn_fold(display_name || ' ' || coalesce(salutation, ''))) stored,
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, event_id)
);
create index guests_event_id_idx on public.guests (event_id) where deleted_at is null;
create index guests_import_job_id_idx on public.guests (import_job_id) where import_job_id is not null;

create trigger guests_touch_updated_at
  before update on public.guests
  for each row execute function private.touch_updated_at();

create table public.guest_groups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),   -- "Họ nhà trai", "Bạn đại học"
  color text check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  unique (event_id, name),
  unique (id, event_id)
);

create table public.guest_group_links (
  event_id uuid not null,
  guest_id uuid not null,
  group_id uuid not null,
  primary key (guest_id, group_id),
  foreign key (guest_id, event_id) references public.guests (id, event_id) on delete cascade,
  foreign key (group_id, event_id) references public.guest_groups (id, event_id) on delete cascade
);
create index guest_group_links_group_id_idx on public.guest_group_links (group_id);
create index guest_group_links_event_id_idx on public.guest_group_links (event_id);

-- Khách X được mời buổi Y, kèm trạng thái RSVP cho buổi đó.
create table public.session_invites (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  guest_id uuid not null,
  session_id uuid not null,
  rsvp_status text not null default 'pending' check (rsvp_status in ('pending', 'yes', 'no', 'maybe')),
  attending_count int check (attending_count between 0 and 50),
  rsvp_note text check (char_length(rsvp_note) <= 500),
  responded_at timestamptz,
  responded_via text check (responded_via in ('guest', 'host')),
  created_at timestamptz not null default now(),
  unique (guest_id, session_id),
  foreign key (guest_id, event_id) references public.guests (id, event_id) on delete cascade,
  foreign key (session_id, event_id) references public.sessions (id, event_id) on delete cascade
);
create index session_invites_session_id_idx on public.session_invites (session_id);
create index session_invites_event_id_idx on public.session_invites (event_id);

-- ---------------------------------------------------------------------------
-- RLS: khách mời chỉ owner/cohost thấy và sửa (ma trận §4.3). Nhân viên check-in sẽ đọc qua RPC (M3).
-- ---------------------------------------------------------------------------
alter table public.import_jobs enable row level security;
alter table public.guests enable row level security;
alter table public.guest_groups enable row level security;
alter table public.guest_group_links enable row level security;
alter table public.session_invites enable row level security;

create policy import_jobs_select on public.import_jobs for select to authenticated
  using ((select private.has_event_role(event_id, array['owner', 'cohost'])));

create policy guests_select on public.guests for select to authenticated
  using ((select private.has_event_role(event_id, array['owner', 'cohost'])));
create policy guests_insert on public.guests for insert to authenticated
  with check ((select private.has_event_role(event_id, array['owner', 'cohost'])));
create policy guests_update on public.guests for update to authenticated
  using ((select private.has_event_role(event_id, array['owner', 'cohost'])))
  with check ((select private.has_event_role(event_id, array['owner', 'cohost'])));

create policy guest_groups_all on public.guest_groups for all to authenticated
  using ((select private.has_event_role(event_id, array['owner', 'cohost'])))
  with check ((select private.has_event_role(event_id, array['owner', 'cohost'])));
create policy guest_group_links_all on public.guest_group_links for all to authenticated
  using ((select private.has_event_role(event_id, array['owner', 'cohost'])))
  with check ((select private.has_event_role(event_id, array['owner', 'cohost'])));
create policy session_invites_all on public.session_invites for all to authenticated
  using ((select private.has_event_role(event_id, array['owner', 'cohost'])))
  with check ((select private.has_event_role(event_id, array['owner', 'cohost'])));

revoke all on public.import_jobs, public.guests, public.guest_groups, public.guest_group_links, public.session_invites
  from anon, authenticated;
grant select on public.import_jobs to authenticated;
-- Khách: xóa mềm (deleted_at), không xóa hẳn; token không sửa được.
grant select on public.guests to authenticated;
grant insert (event_id, display_name, salutation, phone_e164, email, side, max_party_size, notes)
  on public.guests to authenticated;
grant update (display_name, salutation, phone_e164, email, side, max_party_size, notes, invite_sent_at, deleted_at)
  on public.guests to authenticated;
grant select, delete on public.guest_groups to authenticated;
grant insert (event_id, name, color), update (name, color) on public.guest_groups to authenticated;
grant select, insert, delete on public.guest_group_links to authenticated;
grant select, delete on public.session_invites to authenticated;
grant insert (event_id, guest_id, session_id) on public.session_invites to authenticated;
grant update (rsvp_status, attending_count, rsvp_note, responded_at, responded_via) on public.session_invites to authenticated;

-- ---------------------------------------------------------------------------
-- Nhập khách theo lô (một giao dịch). File được đọc và chuẩn hóa ở trình duyệt; hàm chỉ ghi.
-- p_rows: [{display_name, salutation?, phone_e164?, email?, side?, max_party_size?, notes?, groups?: [tên]}]
-- p_session_ids: null = mời mọi buổi của sự kiện.
-- ---------------------------------------------------------------------------
create function public.import_guests(
  p_event_id uuid,
  p_file_name text,
  p_rows jsonb,
  p_session_ids uuid[] default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_job uuid;
  v_count int;
  v_rows jsonb;
begin
  if not private.has_event_role(p_event_id, array['owner', 'cohost']) then
    raise exception 'Bạn không có quyền nhập khách cho sự kiện này' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'Không có dòng nào để nhập' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 3000 then
    raise exception 'Mỗi lần nhập tối đa 3000 dòng' using errcode = '22023';
  end if;

  insert into public.import_jobs (event_id, file_name, total_rows, created_by)
  values (p_event_id, left(p_file_name, 200), jsonb_array_length(p_rows), auth.uid())
  returning id into v_job;

  -- Gắn sẵn id cho từng dòng để nối nhóm và buổi với đúng khách.
  select jsonb_agg(jsonb_build_object('id', gen_random_uuid(), 'r', t.r) order by t.ord) into v_rows
  from jsonb_array_elements(p_rows) with ordinality as t (r, ord);

  insert into public.guests (
    id, event_id, display_name, salutation, phone_e164, email, side, max_party_size, notes,
    source, import_job_id, created_by
  )
  select
    (x ->> 'id')::uuid, p_event_id,
    btrim(x -> 'r' ->> 'display_name'),
    nullif(btrim(x -> 'r' ->> 'salutation'), ''),
    nullif(btrim(x -> 'r' ->> 'phone_e164'), ''),
    nullif(btrim(x -> 'r' ->> 'email'), ''),
    nullif(x -> 'r' ->> 'side', ''),
    coalesce((x -> 'r' ->> 'max_party_size')::int, 1),
    nullif(btrim(x -> 'r' ->> 'notes'), ''),
    'import', v_job, auth.uid()
  from jsonb_array_elements(v_rows) as x;
  get diagnostics v_count = row_count;

  -- Nhóm: tạo nhóm chưa có (so tên chính xác sau khi bỏ khoảng trắng hai đầu).
  insert into public.guest_groups (event_id, name)
  select distinct p_event_id, btrim(g)
  from jsonb_array_elements(v_rows) as x
  cross join jsonb_array_elements_text(coalesce(x -> 'r' -> 'groups', '[]'::jsonb)) as g
  where btrim(g) <> ''
  on conflict (event_id, name) do nothing;

  insert into public.guest_group_links (event_id, guest_id, group_id)
  select distinct p_event_id, (x ->> 'id')::uuid, gg.id
  from jsonb_array_elements(v_rows) as x
  cross join jsonb_array_elements_text(coalesce(x -> 'r' -> 'groups', '[]'::jsonb)) as g
  join public.guest_groups gg on gg.event_id = p_event_id and gg.name = btrim(g);

  insert into public.session_invites (event_id, guest_id, session_id)
  select p_event_id, (x ->> 'id')::uuid, s.id
  from jsonb_array_elements(v_rows) as x
  cross join public.sessions s
  where s.event_id = p_event_id and (p_session_ids is null or s.id = any (p_session_ids));

  update public.import_jobs set created_rows = v_count where id = v_job;
  return jsonb_build_object('job_id', v_job, 'created', v_count);
end;
$$;
revoke all on function public.import_guests(uuid, text, jsonb, uuid[]) from public, anon;
grant execute on function public.import_guests(uuid, text, jsonb, uuid[]) to authenticated;

-- Hoàn tác một lần nhập: đưa các khách của lần đó vào thùng rác (xóa mềm).
create function public.undo_import(p_job_id uuid)
returns int
language plpgsql security definer
set search_path = ''
as $$
declare
  v_event uuid;
  v_count int;
begin
  select event_id into v_event from public.import_jobs where id = p_job_id and undone_at is null;
  if v_event is null or not private.has_event_role(v_event, array['owner', 'cohost']) then
    raise exception 'Không tìm thấy lần nhập này' using errcode = '42501';
  end if;
  update public.guests set deleted_at = now()
  where import_job_id = p_job_id and deleted_at is null;
  get diagnostics v_count = row_count;
  update public.import_jobs set undone_at = now() where id = p_job_id;
  return v_count;
end;
$$;
revoke all on function public.undo_import(uuid) from public, anon;
grant execute on function public.undo_import(uuid) to authenticated;
