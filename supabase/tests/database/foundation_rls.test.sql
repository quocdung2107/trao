-- RLS và RPC của M0 cho 4 vai trò + người ngoài + khách ẩn danh.
-- UUID: ...0a owner, ...0c cohost, ...05 staff, ...0e viewer, ...0f người ngoài.
begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create function pg_temp.logout() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.vn'),
  ('00000000-0000-0000-0000-00000000000c', 'cohost@test.vn'),
  ('00000000-0000-0000-0000-000000000005', 'staff@test.vn'),
  ('00000000-0000-0000-0000-00000000000e', 'viewer@test.vn'),
  ('00000000-0000-0000-0000-00000000000f', 'outsider@test.vn');

-- 1–2. Đăng ký tạo profile + workspace cá nhân
select is((select count(*)::int from public.profiles), 5, 'mỗi user có profile');
select is(
  (select count(*)::int from public.workspace_members where role = 'owner'), 5,
  'mỗi user sở hữu một workspace cá nhân');

-- ---------------- owner tạo sự kiện ----------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');

create temp table ids (k text primary key, v text) on commit drop;
grant all on ids to authenticated;

insert into ids
select 'ws', id::text from public.workspaces;  -- RLS: chỉ thấy workspace của mình
select is((select count(*)::int from ids where k = 'ws'), 1, 'owner chỉ thấy workspace của mình');

insert into ids
select 'ev', public.create_event((select v::uuid from ids where k = 'ws'), 'Đám cưới An & Bình', 'wedding', 'Tiệc nhà gái')::text;

select is(
  (select role from public.event_members where event_id = (select v::uuid from ids where k = 'ev')
     and user_id = '00000000-0000-0000-0000-00000000000a'),
  'owner', 'người tạo sự kiện thành owner');

select is((select name from public.sessions), 'Tiệc nhà gái', 'create_event tạo buổi tiệc đầu tiên');
insert into public.sessions (event_id, name) values ((select v::uuid from ids where k = 'ev'), 'Tiệc nhà trai');
select is((select count(*)::int from public.sessions), 2, 'owner thêm được buổi tiệc');

-- lời mời
insert into public.event_invites (event_id, role) values
  ((select v::uuid from ids where k = 'ev'), 'cohost'),
  ((select v::uuid from ids where k = 'ev'), 'staff'),
  ((select v::uuid from ids where k = 'ev'), 'viewer');
insert into ids select 'inv_' || role, token from public.event_invites;
insert into public.event_invites (event_id, role, expires_at)
values ((select v::uuid from ids where k = 'ev'), 'cohost', now() - interval '1 day');
insert into ids select 'inv_expired', token from public.event_invites where expires_at < now();
select is((select count(*)::int from public.event_invites), 4, 'owner thấy lời mời của mình');

-- ---------------- người ngoài ----------------
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select is((select count(*)::int from public.events), 0, 'người ngoài không thấy sự kiện');
select throws_ok(
  format($$insert into public.events (workspace_id, title) values (%L, 'x')$$, (select v from ids where k = 'ws')),
  '42501', null, 'người ngoài không tạo được sự kiện trong workspace người khác');
select is((select count(*)::int from public.profiles), 1, 'người ngoài chỉ thấy profile của chính mình');
select throws_ok(
  format($$select public.create_event(%L, 'x')$$, (select v from ids where k = 'ws')),
  '42501', null, 'người ngoài không gọi được create_event vào workspace người khác');
select throws_ok(
  format($$select public.accept_event_invite(%L)$$, (select v from ids where k = 'inv_expired')),
  'P0002', null, 'lời mời hết hạn bị từ chối');

-- ---------------- nhận lời mời ----------------
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select is(public.accept_event_invite((select v from ids where k = 'inv_cohost'))::text,
  (select v from ids where k = 'ev'), 'cohost nhận lời mời');
select pg_temp.login('00000000-0000-0000-0000-000000000005');
select lives_ok(format($$select public.accept_event_invite(%L)$$, (select v from ids where k = 'inv_staff')), 'staff nhận lời mời');
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select lives_ok(format($$select public.accept_event_invite(%L)$$, (select v from ids where k = 'inv_viewer')), 'viewer nhận lời mời');

select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select throws_ok(
  format($$select public.accept_event_invite(%L)$$, (select v from ids where k = 'inv_cohost')),
  'P0002', null, 'lời mời đã dùng không dùng lại được');

-- ---------------- staff ----------------
select pg_temp.login('00000000-0000-0000-0000-000000000005');
select is((select count(*)::int from public.events), 1, 'staff thấy sự kiện');
select is((select count(*)::int from public.sessions), 2, 'staff thấy buổi tiệc');
select is((select count(*)::int from public.event_invites), 0, 'staff không đọc được token lời mời');
select is((select count(*)::int from public.profiles), 4, 'staff thấy tên các thành viên cùng sự kiện');
select is_empty(
  format($$update public.events set title = 'hack' where id = %L returning id$$, (select v from ids where k = 'ev')),
  'staff không sửa được sự kiện');
select throws_ok(
  format($$insert into public.sessions (event_id, name) values (%L, 'x')$$, (select v from ids where k = 'ev')),
  '42501', null, 'staff không tạo được buổi tiệc');
select is_empty(
  format($$update public.event_members set role = 'owner' where event_id = %L returning user_id$$, (select v from ids where k = 'ev')),
  'staff không tự nâng quyền');

-- ---------------- viewer ----------------
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select is_empty(
  format($$update public.sessions set name = 'x' where event_id = %L returning id$$, (select v from ids where k = 'ev')),
  'viewer không sửa được buổi tiệc');

-- ---------------- cohost ----------------
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select isnt_empty(
  format($$update public.events set title = 'Đám cưới An & Bình 2026' where id = %L returning id$$, (select v from ids where k = 'ev')),
  'cohost sửa được sự kiện');
select is_empty(
  format($$update public.event_members set role = 'viewer' where user_id = '00000000-0000-0000-0000-000000000005' and event_id = %L returning user_id$$,
    (select v from ids where k = 'ev')),
  'cohost không đổi được vai trò người khác');
select throws_ok(
  format($$select public.trash_event(%L)$$, (select v from ids where k = 'ev')),
  '42501', null, 'cohost không xóa được sự kiện');
select throws_ok(
  format($$update public.events set deleted_at = now() where id = %L$$, (select v from ids where k = 'ev')),
  '42501', null, 'không ai sửa trực tiếp deleted_at');

-- ---------------- owner ----------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select throws_ok(
  format($$delete from public.event_members where user_id = '00000000-0000-0000-0000-00000000000a' and event_id = %L$$,
    (select v from ids where k = 'ev')),
  'P0001', null, 'không xóa được owner cuối cùng');
select isnt_empty(
  format($$update public.event_members set role = 'cohost' where user_id = '00000000-0000-0000-0000-000000000005' and event_id = %L returning user_id$$,
    (select v from ids where k = 'ev')),
  'owner đổi được vai trò');
select lives_ok(format($$select public.trash_event(%L)$$, (select v from ids where k = 'ev')), 'owner đưa sự kiện vào thùng rác');
select is((select count(*)::int from public.events), 1, 'owner vẫn thấy sự kiện trong thùng rác');

select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select is((select count(*)::int from public.events), 0, 'thành viên khác không thấy sự kiện đã xóa');

-- ---------------- khách ẩn danh ----------------
select pg_temp.logout();
set local role anon;
select throws_ok('select * from public.events', '42501', null, 'anon không đọc được bảng events');

select * from finish();
rollback;
