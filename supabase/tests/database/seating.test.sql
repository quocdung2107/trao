-- Bàn, xếp chỗ, cảnh báo quá sức chứa, đồng bộ số chỗ, nhật ký.
-- UUID: ...0a owner, ...0c staff.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.vn'),
  ('00000000-0000-0000-0000-00000000000c', 'staff@test.vn');

create temp table ids (k text primary key, v text) on commit drop;
grant all on ids to authenticated;

-- Sự kiện 1 buổi; khách A tối đa 4 người, khách B tối đa 3, khách C tối đa 2; bàn 1 sức chứa 6.
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'ev', public.create_event(
  (select workspace_id from public.workspace_members limit 1), 'Cưới', 'wedding', 'Nhà gái')::text;
insert into ids select 's1', id::text from public.sessions;
select public.import_guests((select v::uuid from ids where k = 'ev'), 'f',
  '[{"display_name":"Khách A","max_party_size":4},{"display_name":"Khách B","max_party_size":3},{"display_name":"Khách C","max_party_size":2}]'::jsonb);
insert into ids select 'iA', si.id::text from public.session_invites si join public.guests g on g.id = si.guest_id where g.display_name = 'Khách A';
insert into ids select 'iB', si.id::text from public.session_invites si join public.guests g on g.id = si.guest_id where g.display_name = 'Khách B';
insert into ids select 'iC', si.id::text from public.session_invites si join public.guests g on g.id = si.guest_id where g.display_name = 'Khách C';
insert into public.tables (event_id, session_id, label, capacity)
select (select v::uuid from ids where k = 'ev'), (select v::uuid from ids where k = 's1'), l, 6
from unnest(array['Bàn 1', 'Bàn 2']) l;
insert into ids select 't1', id::text from public.tables where label = 'Bàn 1';
insert into ids select 't2', id::text from public.tables where label = 'Bàn 2';
reset role;
insert into public.event_members (event_id, user_id, role)
values ((select v::uuid from ids where k = 'ev'), '00000000-0000-0000-0000-00000000000c', 'staff');

-- 1. trùng tên bàn trong một buổi
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select throws_ok(
  format($$insert into public.tables (event_id, session_id, label, capacity) values (%L, %L, 'Bàn 1', 10)$$,
    (select v from ids where k = 'ev'), (select v from ids where k = 's1')),
  '23505', null, 'không trùng tên bàn trong buổi');

-- 2–3. xếp A (4 chỗ) vào bàn 1
select is(public.assign_seats((select v::uuid from ids where k = 't1'), array[(select v::uuid from ids where k = 'iA')]) ->> 'ok',
  'true', 'xếp A vào bàn 1');
select is((select seats from public.seat_assignments where session_invite_id = (select v::uuid from ids where k = 'iA')),
  4, 'A chưa trả lời → cần đủ số người tối đa');

-- 4–6. B cần 3, bàn còn 2 → cảnh báo, không ghi
select is(public.assign_seats((select v::uuid from ids where k = 't1'), array[(select v::uuid from ids where k = 'iB')]) ->> 'reason',
  'over_capacity', 'quá sức chứa thì cảnh báo');
select is(public.assign_seats((select v::uuid from ids where k = 't1'), array[(select v::uuid from ids where k = 'iB')]) -> 'used',
  '4'::jsonb, 'cảnh báo kèm số chỗ đã dùng');
select is((select count(*)::int from public.seat_assignments where session_invite_id = (select v::uuid from ids where k = 'iB')),
  0, 'cảnh báo thì chưa xếp');

-- 7–8. chủ tiệc xác nhận ghế phụ
select is(public.assign_seats((select v::uuid from ids where k = 't1'), array[(select v::uuid from ids where k = 'iB')], true) -> 'over',
  '1'::jsonb, 'vẫn xếp, vượt 1 chỗ');
select is((select sum(seats)::int from public.seat_assignments where table_id = (select v::uuid from ids where k = 't1')),
  7, 'bàn 1 có 7 người');

-- 9–10. đổi bàn: B sang bàn 2, chỗ cũ được giải phóng
select is(public.assign_seats((select v::uuid from ids where k = 't2'), array[(select v::uuid from ids where k = 'iB')]) ->> 'ok',
  'true', 'chuyển B sang bàn 2');
select is((select array_agg(t.label) from public.seat_assignments sa join public.tables t on t.id = sa.table_id
  where sa.session_invite_id = (select v::uuid from ids where k = 'iB')), array['Bàn 2'], 'B chỉ còn ở bàn 2');

-- 11. xếp lại cùng bàn không nhân đôi
select public.assign_seats((select v::uuid from ids where k = 't2'), array[(select v::uuid from ids where k = 'iB')]);
select is((select count(*)::int from public.seat_assignments where session_invite_id = (select v::uuid from ids where k = 'iB')),
  1, 'xếp lại cùng bàn không tạo dòng mới');

-- 12. khách của buổi khác / id lạ bị từ chối
select throws_ok(
  format($$select public.assign_seats(%L, array[%L, gen_random_uuid()])$$,
    (select v from ids where k = 't1'), (select v from ids where k = 'iC')),
  '22023', 'Có khách không thuộc buổi tiệc này', 'id lạ bị từ chối');

-- 13–14. A trả lời đi 2 người → số chỗ tự cập nhật
reset role;
update public.session_invites set rsvp_status = 'yes', attending_count = 2 where id = (select v::uuid from ids where k = 'iA');
select is((select seats from public.seat_assignments where session_invite_id = (select v::uuid from ids where k = 'iA')),
  2, 'trả lời 2 người → giữ 2 chỗ');
update public.guests set max_party_size = 1 where display_name = 'Khách B';
select is((select seats from public.seat_assignments where session_invite_id = (select v::uuid from ids where k = 'iB')),
  1, 'giảm số người tối đa → bớt chỗ');

-- 15–16. thống kê
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select is(public.event_stats((select v::uuid from ids where k = 'ev')) -> 'sessions' -> 0 -> 'seated', '2'::jsonb, 'đã xếp 2 khách');
select is(public.event_stats((select v::uuid from ids where k = 'ev')) -> 'sessions' -> 0 -> 'tables', '2'::jsonb, '2 bàn');

-- 17–18. nhân viên không thấy, không xếp được
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.seat_assignments), 0, 'nhân viên không đọc trực tiếp bảng xếp chỗ');
select throws_ok(
  format($$select public.assign_seats(%L, array[%L]::uuid[])$$, (select v from ids where k = 't1'), (select v from ids where k = 'iC')),
  'P0002', 'Không tìm thấy bàn', 'nhân viên không xếp được');

-- 19–22. nhật ký: xếp, đổi, xóa bàn
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
delete from public.tables where id = (select v::uuid from ids where k = 't2');
select is((select count(*)::int from public.seat_assignments where session_invite_id = (select v::uuid from ids where k = 'iB')),
  0, 'xóa bàn thì khách về "chưa xếp"');
select is((select count(*)::int from public.audit_log where action = 'seat.assign'), 3, '3 lần xếp');
select is((select after ->> 'guest' from public.audit_log where action = 'seat.assign' order by id limit 1), 'Khách A', 'nhật ký có tên khách');
select is((select before ->> 'table' from public.audit_log where action = 'table.delete'), 'Bàn 2', 'nhật ký xóa bàn');

select * from finish();
rollback;
