-- Khách mời: RLS theo vai trò, ranh giới sự kiện, nhập theo lô, hoàn tác.
-- UUID: ...0a owner, ...0c cohost, ...05 staff, ...0b viewer, ...0f chủ sự kiện khác.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.vn'),
  ('00000000-0000-0000-0000-00000000000c', 'cohost@test.vn'),
  ('00000000-0000-0000-0000-000000000005', 'staff@test.vn'),
  ('00000000-0000-0000-0000-00000000000b', 'viewer@test.vn'),
  ('00000000-0000-0000-0000-00000000000f', 'other@test.vn');

create temp table ids (k text primary key, v text) on commit drop;
grant all on ids to authenticated, anon;

-- 1. vn_fold
select is(private.vn_fold('Nguyễn Thị ĐÀO Dũng'), 'nguyen thi dao dung', 'vn_fold bỏ dấu, đ → d, chữ thường');

-- sự kiện A (owner) có 2 buổi; sự kiện B của người khác có 1 buổi
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'ev', public.create_event(
  (select workspace_id from public.workspace_members limit 1), 'Cưới A', 'wedding', 'Nhà gái')::text;
insert into public.sessions (event_id, name, sort) values ((select v::uuid from ids where k = 'ev'), 'Nhà trai', 1);
insert into ids select 's1', id::text from public.sessions where name = 'Nhà gái';
insert into ids select 's2', id::text from public.sessions where name = 'Nhà trai';
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
insert into ids select 'evb', public.create_event(
  (select workspace_id from public.workspace_members where user_id = '00000000-0000-0000-0000-00000000000f'), 'Cưới B', 'wedding', 'Tiệc B')::text;
insert into ids select 'sb', id::text from public.sessions where event_id = (select v::uuid from ids where k = 'evb');
reset role;
insert into public.event_members (event_id, user_id, role) values
  ((select v::uuid from ids where k = 'ev'), '00000000-0000-0000-0000-00000000000c', 'cohost'),
  ((select v::uuid from ids where k = 'ev'), '00000000-0000-0000-0000-000000000005', 'staff'),
  ((select v::uuid from ids where k = 'ev'), '00000000-0000-0000-0000-00000000000b', 'viewer');

-- 2–6. owner thêm khách tay
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into public.guests (event_id, display_name, salutation, phone_e164, side, max_party_size)
values ((select v::uuid from ids where k = 'ev'), 'Anh Minh và gia đình', 'Anh Minh', '+84912345678', 'groom', 4);
insert into ids select 'g1', id::text from public.guests where display_name = 'Anh Minh và gia đình';
select matches((select token from public.guests where id = (select v::uuid from ids where k = 'g1')),
  '^[A-Za-z0-9_-]{22}$', 'token 22 ký tự base64url');
select is((select search_text from public.guests where id = (select v::uuid from ids where k = 'g1')),
  'anh minh va gia dinh anh minh', 'search_text không dấu');
select throws_ok(
  format($$insert into public.guests (event_id, display_name, phone_e164) values (%L, 'X', '0912345678')$$, (select v from ids where k = 'ev')),
  '23514', null, 'SĐT phải ở dạng +84…');
select throws_ok(
  format($$update public.guests set token = 'aaaaaaaaaaaaaaaaaaaaaa' where id = %L$$, (select v from ids where k = 'g1')),
  '42501', null, 'không sửa được token');
select throws_ok(
  format($$delete from public.guests where id = %L$$, (select v from ids where k = 'g1')),
  '42501', null, 'không xóa hẳn khách (chỉ xóa mềm)');

-- 7–8. ranh giới sự kiện: không mời khách A vào buổi của sự kiện B, kể cả khi ghi event_id của A
select lives_ok(
  format($$insert into public.session_invites (event_id, guest_id, session_id) values (%L, %L, %L)$$,
    (select v from ids where k = 'ev'), (select v from ids where k = 'g1'), (select v from ids where k = 's1')),
  'mời khách vào buổi cùng sự kiện');
select throws_ok(
  format($$insert into public.session_invites (event_id, guest_id, session_id) values (%L, %L, %L)$$,
    (select v from ids where k = 'ev'), (select v from ids where k = 'g1'), (select v from ids where k = 'sb')),
  '23503', null, 'không mời vào buổi của sự kiện khác');

-- 9–14. nhập theo lô
select is(
  (public.import_guests(
    (select v::uuid from ids where k = 'ev'), 'khach.xlsx',
    '[{"display_name":"Cô Lan","phone_e164":"+84901000001","groups":["Họ nhà gái","Hàng xóm"]},
      {"display_name":"Bác Hùng","max_party_size":2,"side":"bride","groups":["Họ nhà gái"]},
      {"display_name":"Bạn Tú","groups":[" Bạn đại học "]}]'::jsonb,
    array[(select v::uuid from ids where k = 's2')]) ->> 'created')::int,
  3, 'nhập 3 khách');
insert into ids select 'job', id::text from public.import_jobs;
select is((select count(*)::int from public.guest_groups where event_id = (select v::uuid from ids where k = 'ev')),
  3, 'tạo 3 nhóm (tên đã bỏ khoảng trắng)');
select is((select count(*)::int from public.guest_group_links l join public.guest_groups g on g.id = l.group_id where g.name = 'Họ nhà gái'),
  2, '2 khách thuộc Họ nhà gái');
select is((select count(*)::int from public.session_invites where session_id = (select v::uuid from ids where k = 's2')),
  3, 'khách nhập được mời đúng buổi đã chọn');
select is((select count(*)::int from public.session_invites where session_id = (select v::uuid from ids where k = 's1')),
  1, 'không mời buổi không chọn');
select is(
  (public.import_guests((select v::uuid from ids where k = 'ev'), 'b.csv', '[{"display_name":"Chú Ba","groups":["Hàng xóm"]}]'::jsonb) ->> 'created')::int,
  1, 'lần nhập sau dùng lại nhóm sẵn có; không chọn buổi = mời mọi buổi');

-- 15. một dòng sai → cả lần nhập không ghi gì
select throws_ok(
  format($$select public.import_guests(%L, 'x.csv', '[{"display_name":"OK"},{"display_name":""}]'::jsonb)$$, (select v from ids where k = 'ev')),
  '23514', null, 'dòng thiếu tên làm hỏng cả lô');
select is((select count(*)::int from public.guests where event_id = (select v::uuid from ids where k = 'ev')),
  5, 'không có khách nào của lô lỗi được ghi');

-- 17–19. cohost thấy và sửa; staff / viewer không thấy
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.guests), 5, 'cohost thấy khách');
select pg_temp.login('00000000-0000-0000-0000-000000000005');
select is((select count(*)::int from public.guests), 0, 'staff không đọc bảng khách');
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.session_invites), 0, 'viewer không đọc lời mời theo buổi');

-- 20–21. staff không nhập / hoàn tác được
select pg_temp.login('00000000-0000-0000-0000-000000000005');
select throws_ok(
  format($$select public.import_guests(%L, 'x.csv', '[{"display_name":"Hack"}]'::jsonb)$$, (select v from ids where k = 'ev')),
  '42501', null, 'staff không nhập khách');
select throws_ok(
  format($$select public.undo_import(%L)$$, (select v from ids where k = 'job')),
  '42501', null, 'staff không hoàn tác');

-- 22. chủ sự kiện khác không thấy gì
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select is((select count(*)::int from public.guests), 0, 'chủ sự kiện khác không thấy khách');

-- 23–25. owner hoàn tác lần nhập đầu
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select is(public.undo_import((select v::uuid from ids where k = 'job')), 3, 'hoàn tác đưa 3 khách vào thùng rác');
select is((select count(*)::int from public.guests where deleted_at is null), 2, 'còn 2 khách');
select throws_ok(
  format($$select public.undo_import(%L)$$, (select v from ids where k = 'job')),
  '42501', null, 'không hoàn tác hai lần');

-- 26. anon không gọi được
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok(
  format($$select public.import_guests(%L, 'x', '[]'::jsonb)$$, (select v from ids where k = 'ev')),
  '42501', null, 'anon không gọi import_guests');

select * from finish();
rollback;
