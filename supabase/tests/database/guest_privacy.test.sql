-- Khách xem và tự xóa dữ liệu của mình bằng token cá nhân.
-- UUID: ...0a owner.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

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

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'owner@test.vn');
create temp table ids (k text primary key, v text) on commit drop;
grant all on ids to authenticated, anon;

-- Anh Minh (có SĐT) đã trả lời, gửi lời chúc, được xếp bàn; Cô Lan không liên quan.
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'ev', public.create_event(
  (select workspace_id from public.workspace_members limit 1), 'Cưới', 'wedding', 'Nhà gái')::text;
select public.import_guests((select v::uuid from ids where k = 'ev'), 'f',
  '[{"display_name":"Anh Minh","phone_e164":"+84912345678","max_party_size":2},{"display_name":"Cô Lan"}]'::jsonb);
insert into ids select 'tA', token from public.guests where display_name = 'Anh Minh';
insert into ids select 'gA', id::text from public.guests where display_name = 'Anh Minh';
insert into ids select 'iA', si.id::text from public.session_invites si join public.guests g on g.id = si.guest_id
  where g.display_name = 'Anh Minh';
insert into public.tables (event_id, session_id, label, capacity)
select (select v::uuid from ids where k = 'ev'), id, 'Bàn 1', 10 from public.sessions;
select public.assign_seats((select id from public.tables), array[(select v::uuid from ids where k = 'iA')]);
reset role;
insert into public.invitations (event_id, template_key, published_at, created_by)
values ((select v::uuid from ids where k = 'ev'), 'la', now(), '00000000-0000-0000-0000-00000000000a');
update public.session_invites set rsvp_status = 'yes', attending_count = 2, rsvp_note = 'Sẽ đến sớm'
  where id = (select v::uuid from ids where k = 'iA');
insert into public.consents (event_id, guest_id, policy_version)
values ((select v::uuid from ids where k = 'ev'), (select v::uuid from ids where k = 'gA'), '2026-11-21');
insert into public.wishes (event_id, invitation_id, guest_id, author_name, message)
select (select v::uuid from ids where k = 'ev'), id, (select v::uuid from ids where k = 'gA'), 'Minh', 'Chúc mừng'
from public.invitations;
insert into public.wishes (event_id, invitation_id, author_name, message)
select (select v::uuid from ids where k = 'ev'), id, 'Người lạ', 'Hạnh phúc' from public.invitations;
insert into ids select 'slug', slug from public.invitations;

-- 1–4. khách xem dữ liệu của mình
select pg_temp.anon();
select is(public.guest_privacy_view((select v from ids where k = 'tA')) ->> 'name', 'Anh Minh', 'xem được tên');
select is(public.guest_privacy_view((select v from ids where k = 'tA')) -> 'has_phone', 'true'::jsonb, 'biết là có lưu SĐT');
select ok(not (public.guest_privacy_view((select v from ids where k = 'tA'))::text ~ '912345'), 'không lộ SĐT');
select is(public.guest_privacy_view('xxxxxxxxxxxxxxxxxxxxxx'), null, 'token lạ không ra gì');

-- 5–6. khách tự xóa
select is(public.guest_erase((select v from ids where k = 'tA')) -> 'slugs',
  (select jsonb_build_array(v) from ids where k = 'slug'), 'trả slug thiệp có lời chúc của khách');
select throws_ok(format($$select public.guest_erase(%L)$$, (select v from ids where k = 'tA')), 'P0002', null, 'xóa lần 2 báo lỗi');

-- 7–12. kiểm tra sau khi xóa (quyền postgres để thấy hết)
reset role;
select is((select count(*)::int from public.guests where id = (select v::uuid from ids where k = 'gA')), 0, 'khách bị xóa hẳn');
select is((select count(*)::int from public.session_invites where id = (select v::uuid from ids where k = 'iA')), 0, 'xóa trả lời');
select is((select count(*)::int from public.consents), 0, 'xóa bản ghi đồng ý');
select is((select array_agg(author_name) from public.wishes), array['Người lạ'], 'chỉ xóa lời chúc của khách đó');
select is((select count(*)::int from public.audit_log where coalesce(before::text, '') || coalesce(after::text, '') ~ 'Anh Minh'), 0, 'nhật ký không còn tên khách');
select is((select count(*)::int from public.guests where display_name = 'Cô Lan'), 1, 'khách khác không bị ảnh hưởng');

select * from finish();
rollback;
