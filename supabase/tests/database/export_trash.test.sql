-- Xuất dữ liệu (quyền + nhật ký), khôi phục khách, dọn thùng rác 30 ngày.
-- UUID: ...0a owner, ...0c staff.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

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

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'ev', public.create_event(
  (select workspace_id from public.workspace_members limit 1), 'Cưới', 'wedding', 'Nhà gái')::text;
select public.import_guests((select v::uuid from ids where k = 'ev'), 'f',
  '[{"display_name":"Anh Minh","phone_e164":"+84912345678","groups":["Bạn đại học"]},{"display_name":"Cô Lan"},{"display_name":"Chú Ba"}]'::jsonb);
reset role;
insert into public.event_members (event_id, user_id, role)
values ((select v::uuid from ids where k = 'ev'), '00000000-0000-0000-0000-00000000000c', 'staff');

-- 1–4. xuất dữ liệu
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select throws_ok(format($$select public.export_event(%L)$$, (select v from ids where k = 'ev')), '42501', null, 'nhân viên không xuất được');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
update public.guests set deleted_at = now() where display_name = 'Chú Ba';
select is(jsonb_array_length(public.export_event((select v::uuid from ids where k = 'ev')) -> 'guests'), 2, 'xuất 2 khách, bỏ khách đã xóa');
select is(public.export_event((select v::uuid from ids where k = 'ev')) -> 'guests' -> 0 ->> 'phone', '+84912345678', 'có SĐT đầy đủ cho chủ tiệc');
select is((select count(*)::int from public.audit_log where action = 'export'), 2, 'mỗi lần xuất ghi nhật ký');

-- 5. khôi phục khách từ thùng rác
update public.guests set deleted_at = null where display_name = 'Chú Ba';
select is((select count(*)::int from public.guests where deleted_at is null), 3, 'khôi phục khách');

-- 6–9. dọn thùng rác: chỉ xóa hẳn những gì quá 30 ngày
reset role;
update public.guests set deleted_at = now() - interval '31 days' where display_name = 'Chú Ba';
update public.guests set deleted_at = now() - interval '29 days' where display_name = 'Cô Lan';
select is(private.purge_trash() ->> 'guests', '1', 'xóa hẳn 1 khách quá 30 ngày');
select is((select count(*)::int from public.guests where display_name = 'Cô Lan'), 1, 'khách mới xóa 29 ngày vẫn còn');
update public.events set deleted_at = now() - interval '40 days';
select is(private.purge_trash() ->> 'events', '1', 'xóa hẳn sự kiện quá 30 ngày');
select is((select count(*)::int from public.guests), 0, 'khách của sự kiện đó cũng bị xóa');

select * from finish();
rollback;
