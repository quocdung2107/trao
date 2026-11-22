-- Check-in: tra cứu, chống trùng giữa nhiều máy, gửi lại không nhân đôi, hủy, thẻ vào tiệc.
-- UUID: ...0a owner, ...0c staff Lan, ...0d staff Hùng, ...0e viewer.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.vn'),
  ('00000000-0000-0000-0000-00000000000c', 'lan@test.vn'),
  ('00000000-0000-0000-0000-00000000000d', 'hung@test.vn'),
  ('00000000-0000-0000-0000-00000000000e', 'viewer@test.vn');
update public.profiles set display_name = 'Lan' where id = '00000000-0000-0000-0000-00000000000c';

create temp table ids (k text primary key, v text) on commit drop;
grant all on ids to authenticated, anon;

-- Sự kiện 2 buổi. Anh Minh (tối đa 3, SĐT ...678) mời buổi 1; Cô Lan chỉ buổi 2. Anh Minh ngồi Bàn 5.
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'ev', public.create_event(
  (select workspace_id from public.workspace_members limit 1), 'Cưới', 'wedding', 'Nhà gái')::text;
insert into public.sessions (event_id, name, sort) values ((select v::uuid from ids where k = 'ev'), 'Nhà trai', 1);
insert into ids select 's1', id::text from public.sessions where name = 'Nhà gái';
insert into ids select 's2', id::text from public.sessions where name = 'Nhà trai';
select public.import_guests((select v::uuid from ids where k = 'ev'), 'f',
  '[{"display_name":"Anh Minh và gia đình","salutation":"Anh Minh","max_party_size":3,"phone_e164":"+84912345678"}]'::jsonb,
  array[(select v::uuid from ids where k = 's1')]);
select public.import_guests((select v::uuid from ids where k = 'ev'), 'f', '[{"display_name":"Cô Lan"}]'::jsonb,
  array[(select v::uuid from ids where k = 's2')]);
insert into ids select 'iA', si.id::text from public.session_invites si join public.guests g on g.id = si.guest_id
  where g.display_name like 'Anh Minh%';
insert into ids select 'tA', token from public.guests where display_name like 'Anh Minh%';
insert into ids select 'tB', token from public.guests where display_name = 'Cô Lan';
insert into public.tables (event_id, session_id, label, capacity)
values ((select v::uuid from ids where k = 'ev'), (select v::uuid from ids where k = 's1'), 'Bàn 5', 10);
select public.assign_seats((select id from public.tables), array[(select v::uuid from ids where k = 'iA')]);
reset role;
insert into public.event_members (event_id, user_id, role) values
  ((select v::uuid from ids where k = 'ev'), '00000000-0000-0000-0000-00000000000c', 'staff'),
  ((select v::uuid from ids where k = 'ev'), '00000000-0000-0000-0000-00000000000d', 'staff'),
  ((select v::uuid from ids where k = 'ev'), '00000000-0000-0000-0000-00000000000e', 'viewer');

-- 1–6. nhân viên tra cứu
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select is(jsonb_array_length(public.checkin_find((select v::uuid from ids where k = 's1'), 'anh minh') -> 'items'), 1, 'tìm theo tên không dấu');
select is(jsonb_array_length(public.checkin_find((select v::uuid from ids where k = 's1'), '678') -> 'items'), 1, 'tìm theo 3 số cuối SĐT');
select is(public.checkin_find((select v::uuid from ids where k = 's1'), null, (select v from ids where k = 'tA')) -> 'items' -> 0 -> 'tables',
  '["Bàn 5"]'::jsonb, 'quét QR ra số bàn');
select ok(not (public.checkin_find((select v::uuid from ids where k = 's1'), 'minh')::text ~ '912345'), 'không lộ SĐT đầy đủ');
select is(public.checkin_find((select v::uuid from ids where k = 's1'), null, (select v from ids where k = 'tB')) ->> 'not_invited',
  'Cô Lan', 'QR của khách buổi khác → báo không được mời buổi này');
select is(jsonb_array_length(public.checkin_find((select v::uuid from ids where k = 's1'), 'a') -> 'items'), 0, 'từ khóa quá ngắn không trả gì');

-- 7–8. người chỉ xem không check-in được
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select throws_ok(format($$select public.checkin_find(%L, 'minh')$$, (select v from ids where k = 's1')), '42501', null, 'viewer không tra cứu');
select throws_ok(format($$select public.checkin(gen_random_uuid(), %L, 2)$$, (select v from ids where k = 'iA')), 'P0002', null, 'viewer không check-in');

-- 9–13. 3 máy cùng check-in một khách → đúng 1 lượt accepted
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select is(public.checkin('11111111-1111-1111-1111-111111111111', (select v::uuid from ids where k = 'iA'), 3, 'qr', 'may-1') ->> 'result',
  'ok', 'máy 1: vào');
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select is(public.checkin('22222222-2222-2222-2222-222222222222', (select v::uuid from ids where k = 'iA'), 3, 'search', 'may-2') ->> 'result',
  'duplicate', 'máy 2: trùng');
select is(public.checkin('33333333-3333-3333-3333-333333333333', (select v::uuid from ids where k = 'iA'), 3, 'qr', 'may-3') -> 'first' ->> 'by',
  'Lan', 'máy 3: trùng, báo người check-in đầu');
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select is(public.checkin('11111111-1111-1111-1111-111111111111', (select v::uuid from ids where k = 'iA'), 3, 'qr', 'may-1') ->> 'result',
  'ok', 'máy 1 gửi lại cùng mã → vẫn ok');
select is((select count(*)::int from public.checkins where status = 'accepted'), 1, 'đúng 1 lượt accepted');

-- 14–15. tra cứu và thống kê thấy đã đến
select is(public.checkin_find((select v::uuid from ids where k = 's1'), 'minh') -> 'items' -> 0 -> 'checked_in' ->> 'by', 'Lan',
  'tra cứu thấy đã check-in bởi Lan');
select is(public.checkin_summary((select v::uuid from ids where k = 's1')),
  '{"guests_expected":1,"people_expected":3,"guests_arrived":1,"people_arrived":3}'::jsonb, 'thống kê sảnh');

-- 16–19. hủy: nhân viên khác không hủy được, người check-in hủy được, sau đó check-in lại được
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select throws_ok($$select public.checkin_void('11111111-1111-1111-1111-111111111111', 'nhầm')$$, '42501', null,
  'nhân viên khác không hủy được');
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select lives_ok($$select public.checkin_void('11111111-1111-1111-1111-111111111111', 'nhầm người')$$, 'người check-in tự hủy');
select is(public.checkin(gen_random_uuid(), (select v::uuid from ids where k = 'iA'), 2) ->> 'result', 'ok', 'check-in lại sau khi hủy');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select is((select before ->> 'reason' from public.audit_log where action = 'checkin.void'), 'nhầm người', 'nhật ký ghi lý do hủy');

-- 20–21. RLS: nhân viên đọc được bảng check-in (cho cập nhật tức thì), viewer thì không
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select is((select count(*)::int from public.checkins), 4, 'nhân viên đọc được các lượt check-in');
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select is((select count(*)::int from public.checkins), 0, 'viewer không đọc');

-- 22–24. thẻ vào tiệc
select pg_temp.anon();
select is(public.get_guest_pass((select v from ids where k = 'tA')) ->> 'name', 'Anh Minh', 'thẻ vào tiệc có xưng hô');
select is(public.get_guest_pass((select v from ids where k = 'tA')) -> 'sessions' -> 0 -> 'tables', 'null'::jsonb,
  'mặc định không hiện số bàn');
reset role;
update public.events set settings = settings || '{"showTableToGuest": true}';
select pg_temp.anon();
select is(public.get_guest_pass((select v from ids where k = 'tA')) -> 'sessions' -> 0 -> 'tables', '["Bàn 5"]'::jsonb,
  'chủ tiệc bật → hiện số bàn');

select * from finish();
rollback;
