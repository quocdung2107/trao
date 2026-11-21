-- Thiệp: RLS cho người quản lý, get_invitation cho khách ẩn danh.
-- UUID: ...0a owner, ...05 staff, ...0f người ngoài.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.vn'),
  ('00000000-0000-0000-0000-000000000005', 'staff@test.vn'),
  ('00000000-0000-0000-0000-00000000000f', 'outsider@test.vn');

create temp table ids (k text primary key, v text) on commit drop;
grant all on ids to authenticated, anon;

-- owner tạo sự kiện có 2 buổi
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'ev', public.create_event(
  (select workspace_id from public.workspace_members limit 1), 'Đám cưới An & Bình', 'wedding', 'Tiệc nhà gái')::text;
insert into public.sessions (event_id, name, sort) values ((select v::uuid from ids where k = 'ev'), 'Tiệc nhà trai', 1);
insert into ids select 's_gai', id::text from public.sessions where name = 'Tiệc nhà gái';
insert into ids select 's_trai', id::text from public.sessions where name = 'Tiệc nhà trai';

-- staff tham gia trực tiếp (bỏ qua luồng lời mời, đã test ở foundation)
reset role;
insert into public.event_members (event_id, user_id, role)
values ((select v::uuid from ids where k = 'ev'), '00000000-0000-0000-0000-000000000005', 'staff');

-- 1–3. owner tạo thiệp
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into public.invitations (event_id, template_key, content)
values ((select v::uuid from ids where k = 'ev'), 'la', '{"title": "An & Bình"}');
insert into ids select 'slug', slug from public.invitations;
select matches((select v from ids where k = 'slug'), '^[A-Za-z0-9_-]{12}$', 'slug ngẫu nhiên 12 ký tự base64url');
select throws_ok(
  format($$insert into public.invitations (event_id, template_key, content) values (%L, 'la', '[1]')$$, (select v from ids where k = 'ev')),
  '23514', null, 'content phải là object');
select throws_ok(
  format($$update public.invitations set slug = 'aaaaaaaaaaaa' where event_id = %L$$, (select v from ids where k = 'ev')),
  '42501', null, 'không ai đổi được slug');

-- 4–6. staff / người ngoài
select pg_temp.login('00000000-0000-0000-0000-000000000005');
select is((select count(*)::int from public.invitations), 1, 'staff thấy thiệp');
select is_empty(
  $$update public.invitations set content = '{"title":"hack"}' returning id$$,
  'staff không sửa được thiệp');
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select is((select count(*)::int from public.invitations), 0, 'người ngoài không thấy thiệp');

-- 7–8. anon: chưa xuất bản thì không đọc được; không đọc bảng trực tiếp
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select is(public.get_invitation((select v from ids where k = 'slug')), null, 'thiệp nháp: khách không đọc được');
select throws_ok('select * from public.invitations', '42501', null, 'anon không đọc bảng invitations');

-- xuất bản
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
update public.invitations set published_at = now();

-- 9–13. anon đọc thiệp đã xuất bản
reset role;
set local role anon;
select is(public.get_invitation((select v from ids where k = 'slug')) ->> 'template_key', 'la', 'khách đọc được thiệp đã xuất bản');
select is(public.get_invitation((select v from ids where k = 'slug')) -> 'content' ->> 'title', 'An & Bình', 'nội dung thiệp');
select is(jsonb_array_length(public.get_invitation((select v from ids where k = 'slug')) -> 'sessions'), 2, 'mặc định hiện mọi buổi');
select is(
  public.get_invitation((select v from ids where k = 'slug')) -> 'sessions' -> 0 ->> 'name', 'Tiệc nhà gái', 'buổi xếp theo sort');
select is(public.get_invitation('khongtontai1'), null, 'slug sai trả null');

-- 14. thiệp riêng nhà trai
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
update public.invitations set session_ids = array[(select v::uuid from ids where k = 's_trai')];
reset role;
set local role anon;
select is(
  public.get_invitation((select v from ids where k = 'slug')) -> 'sessions',
  jsonb_build_array(jsonb_build_object(
    'id', (select v from ids where k = 's_trai'), 'name', 'Tiệc nhà trai', 'starts_at', null, 'ends_at', null,
    'venue_name', null, 'address', null, 'map_url', null)),
  'thiệp chỉ hiện buổi được chọn');

-- 15. kết quả không lộ ID người dùng hay sự kiện
select ok(
  not (public.get_invitation((select v from ids where k = 'slug'))::text ~ '00000000-0000-0000-0000-00000000000a'
       or public.get_invitation((select v from ids where k = 'slug'))::text ~ (select v from ids where k = 'ev')),
  'không lộ id người tạo hay id sự kiện');

-- 16–17. sự kiện vào thùng rác thì thiệp ngừng hiển thị
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select lives_ok(format($$select public.trash_event(%L)$$, (select v from ids where k = 'ev')), 'owner xóa sự kiện');
reset role;
set local role anon;
select is(public.get_invitation((select v from ids where k = 'slug')), null, 'thiệp của sự kiện đã xóa không còn đọc được');

select * from finish();
rollback;
