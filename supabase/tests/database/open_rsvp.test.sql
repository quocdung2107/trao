-- Loại "Lời chúc" và RSVP mở qua link chung (hàng chờ duyệt).
-- UUID: ...0a owner, ...0b viewer.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

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
  ('00000000-0000-0000-0000-00000000000b', 'viewer@test.vn');

create temp table ids (k text primary key, v text) on commit drop;
grant all on ids to authenticated, anon;

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
-- Tiệc Noel 2 buổi, thiệp đã xuất bản; một khách sẵn có.
insert into ids select 'ev', public.create_event(
  (select workspace_id from public.workspace_members limit 1), 'Noel giáo xứ', 'christmas', 'Thánh lễ')::text;
insert into public.sessions (event_id, name, sort) values ((select v::uuid from ids where k = 'ev'), 'Tiệc tối', 1);
insert into ids select 's1', id::text from public.sessions where name = 'Thánh lễ';
insert into ids select 's2', id::text from public.sessions where name = 'Tiệc tối';
insert into public.invitations (event_id, template_key) values ((select v::uuid from ids where k = 'ev'), 'la');
update public.invitations set published_at = now();
insert into ids select 'slug', slug from public.invitations;
select public.import_guests((select v::uuid from ids where k = 'ev'), 'f',
  '[{"display_name":"Cô Lan","max_party_size":1}]'::jsonb);
insert into ids select 'lan', id::text from public.guests where display_name = 'Cô Lan';

-- Sự kiện Lời chúc: không tạo buổi dù client gửi tên buổi.
insert into ids select 'gr', public.create_event(
  (select workspace_id from public.workspace_members limit 1), 'Chúc mừng Giáng sinh', 'greeting', 'Buổi chính')::text;
insert into public.invitations (event_id, template_key) values ((select v::uuid from ids where k = 'gr'), 'la');
update public.invitations set published_at = now() where published_at is null;
insert into ids select 'gslug', slug from public.invitations where event_id = (select v::uuid from ids where k = 'gr');
reset role;
update public.events set settings = '{"openRsvp": true}' where id = (select v::uuid from ids where k = 'gr');
insert into public.event_members (event_id, user_id, role)
values ((select v::uuid from ids where k = 'ev'), '00000000-0000-0000-0000-00000000000b', 'viewer');

-- 1–2. Lời chúc
select is((select count(*)::int from public.sessions where event_id = (select v::uuid from ids where k = 'gr')), 0,
  'sự kiện Lời chúc không có buổi tiệc');
select pg_temp.anon();
select is((public.get_invitation((select v from ids where k = 'gslug')) ->> 'open_rsvp')::boolean, false,
  'Lời chúc không bao giờ mở RSVP, kể cả khi cài đặt bật');

-- 3–4. RSVP mở đang tắt
select is((public.get_invitation((select v from ids where k = 'slug')) ->> 'open_rsvp')::boolean, false, 'mặc định tắt');
select throws_ok(
  format($$select public.submit_open_rsvp(%L, 'Anh Tú', 2, array['%s']::uuid[], null, null, 'v1')$$,
    (select v from ids where k = 'slug'), (select v from ids where k = 's1')),
  'P0001', null, 'tắt thì không đăng ký được');

reset role;
update public.events set settings = '{"openRsvp": true}' where id = (select v::uuid from ids where k = 'ev');
select pg_temp.anon();

-- 5–9. kiểm tra đầu vào
select is((public.get_invitation((select v from ids where k = 'slug')) ->> 'open_rsvp')::boolean, true, 'bật thì thiệp báo mở');
select throws_ok(
  format($$select public.submit_open_rsvp(%L, 'Anh Tú', 2, array['%s']::uuid[])$$,
    (select v from ids where k = 'slug'), (select v from ids where k = 's1')),
  'P0001', 'Vui lòng đồng ý với cách TRAO dùng thông tin của bạn', 'phải đồng ý dữ liệu');
select throws_ok(
  format($$select public.submit_open_rsvp(%L, 'Anh Tú', 11, array['%s']::uuid[], null, null, 'v1')$$,
    (select v from ids where k = 'slug'), (select v from ids where k = 's1')),
  'P0001', null, 'tối đa 10 người');
select throws_ok(
  format($$select public.submit_open_rsvp(%L, 'Anh Tú', 2, array['%s']::uuid[], null, null, 'v1')$$,
    (select v from ids where k = 'slug'), gen_random_uuid()),
  'P0001', 'Hãy chọn buổi bạn sẽ đến', 'buổi không thuộc thiệp');
select throws_ok(
  format($$select public.submit_open_rsvp(%L, '  ', 2, array['%s']::uuid[], null, null, 'v1')$$,
    (select v from ids where k = 'slug'), (select v from ids where k = 's1')),
  'P0001', 'Hãy cho biết tên bạn', 'phải có tên');

-- 10–13. đăng ký hợp lệ (SĐT không bắt buộc)
insert into ids select 'rA', public.submit_open_rsvp((select v from ids where k = 'slug'), ' Anh Tú ', 2,
  array[(select v::uuid from ids where k = 's1'), (select v::uuid from ids where k = 's2')], '+84901234567', 'Đi cùng vợ', 'v1') ->> 'token';
insert into ids select 'rB', public.submit_open_rsvp((select v from ids where k = 'slug'), 'Cô Lan', 1,
  array[(select v::uuid from ids where k = 's2')], null, null, 'v1') ->> 'token';
insert into ids select 'rC', public.submit_open_rsvp((select v from ids where k = 'slug'), 'Người lạ', 1,
  array[(select v::uuid from ids where k = 's1')], null, null, 'v1') ->> 'token';
select is(public.get_open_rsvp((select v from ids where k = 'slug'), (select v from ids where k = 'rA')) ->> 'status', 'pending',
  'người đăng ký thấy đang chờ');
select is(public.get_open_rsvp((select v from ids where k = 'slug'), (select v from ids where k = 'rA')) ->> 'guest_token', null,
  'chưa duyệt thì chưa có link cá nhân');
select is(public.get_open_rsvp((select v from ids where k = 'gslug'), (select v from ids where k = 'rA')), null,
  'token không dùng được ở thiệp khác');
select throws_ok(
  format($$select public.submit_open_rsvp(%L, 'Tú', 1, array['%s']::uuid[], '+84901234567', null, 'v1')$$,
    (select v from ids where k = 'slug'), (select v from ids where k = 's1')),
  'P0001', 'Số điện thoại này đã đăng ký và đang chờ chủ tiệc xác nhận', 'chặn đăng ký trùng SĐT đang chờ');

-- 14–15. khách vô danh không đọc được hàng chờ, chưa thành khách
select throws_ok('select count(*) from public.rsvp_requests', '42501', null, 'anon không đọc bảng');
reset role;
select is((select count(*)::int from public.guests where event_id = (select v::uuid from ids where k = 'ev')), 1,
  'đăng ký chưa duyệt không nằm trong danh sách khách');

insert into ids select 'idA', id::text from public.rsvp_requests where token = (select v from ids where k = 'rA');
insert into ids select 'idB', id::text from public.rsvp_requests where token = (select v from ids where k = 'rB');
insert into ids select 'idC', id::text from public.rsvp_requests where token = (select v from ids where k = 'rC');

-- 16–17. viewer không thấy, không duyệt được
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.rsvp_requests), 0, 'viewer không thấy hàng chờ');
select throws_ok(
  format($$select public.approve_rsvp_request('%s')$$, (select v from ids where k = 'idA')),
  '42501', null, 'viewer không duyệt được');
reset role;

-- 18–21. chủ tiệc duyệt A thành khách mới
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select is((public.event_stats((select v::uuid from ids where k = 'ev')) ->> 'requests_pending')::int, 3, 'thống kê đếm 3 chờ duyệt');
insert into ids select 'gA', public.approve_rsvp_request(
  (select id from public.rsvp_requests where token = (select v from ids where k = 'rA')))::text;
select results_eq(
  format($$select g.source, g.max_party_size, g.phone_e164, si.rsvp_status, si.attending_count
           from public.guests g join public.session_invites si on si.guest_id = g.id
           where g.id = '%s' order by si.session_id = '%s' desc$$,
    (select v from ids where k = 'gA'), (select v from ids where k = 's1')),
  $$values ('rsvp_open'::text, 2, '+84901234567'::text, 'yes'::text, 2), ('rsvp_open', 2, '+84901234567', 'yes', 2)$$,
  'thành khách: 2 buổi, sẽ đến 2 người, giữ SĐT');
select is((select phone_e164 from public.rsvp_requests where token = (select v from ids where k = 'rA')), null,
  'bản đăng ký không giữ SĐT sau khi duyệt');
select throws_ok(
  format($$select public.approve_rsvp_request('%s')$$,
    (select id from public.rsvp_requests where token = (select v from ids where k = 'rA'))),
  'P0001', 'Đăng ký này đã được xử lý', 'không duyệt hai lần');

-- 22–23. gộp B vào khách "Cô Lan" sẵn có; từ chối C
select public.approve_rsvp_request(
  (select id from public.rsvp_requests where token = (select v from ids where k = 'rB')),
  (select v::uuid from ids where k = 'lan'));
select results_eq(
  format($$select (select count(*)::int from public.guests where display_name = 'Cô Lan'), si.rsvp_status
           from public.session_invites si where si.guest_id = '%s' and si.session_id = '%s'$$,
    (select v from ids where k = 'lan'), (select v from ids where k = 's2')),
  $$values (1, 'yes'::text)$$,
  'gộp: không tạo khách mới, ghi "sẽ đến" cho buổi đã chọn');
select public.reject_rsvp_request((select id from public.rsvp_requests where token = (select v from ids where k = 'rC')));
select is((public.event_stats((select v::uuid from ids where k = 'ev')) ->> 'requests_pending')::int, 0, 'hết hàng chờ');
insert into ids select 'tA', token from public.guests where id = (select v::uuid from ids where k = 'gA');
reset role;

-- 24–26. người đăng ký xem kết quả
select pg_temp.anon();
select is(public.get_open_rsvp((select v from ids where k = 'slug'), (select v from ids where k = 'rA')) ->> 'guest_token',
  (select v from ids where k = 'tA'), 'đã duyệt → có link cá nhân');
select is(public.get_open_rsvp((select v from ids where k = 'slug'), (select v from ids where k = 'rC')) ->> 'status', 'rejected',
  'bị từ chối thì thấy trạng thái');
select is(public.get_open_rsvp((select v from ids where k = 'slug'), (select v from ids where k = 'rC')) ->> 'guest_token', null,
  'bị từ chối thì không có link cá nhân');

select * from finish();
rollback;
