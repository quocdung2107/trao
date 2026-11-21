-- RSVP qua token, đồng ý dữ liệu, lời chúc, thống kê.
-- UUID: ...0a owner, ...0b viewer.
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

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

-- Sự kiện 2 buổi, thiệp đã xuất bản, khách A mời 2 buổi (tối đa 3 người), khách B chỉ buổi 2.
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'ev', public.create_event(
  (select workspace_id from public.workspace_members limit 1), 'Cưới', 'wedding', 'Nhà gái')::text;
insert into public.sessions (event_id, name, sort) values ((select v::uuid from ids where k = 'ev'), 'Nhà trai', 1);
insert into ids select 's1', id::text from public.sessions where name = 'Nhà gái';
insert into ids select 's2', id::text from public.sessions where name = 'Nhà trai';
insert into public.invitations (event_id, template_key) values ((select v::uuid from ids where k = 'ev'), 'la');
update public.invitations set published_at = now();
insert into ids select 'slug', slug from public.invitations;
select public.import_guests((select v::uuid from ids where k = 'ev'), 'f',
  '[{"display_name":"Anh Minh và gia đình","salutation":"Anh Minh","max_party_size":3,"phone_e164":"+84912345678"}]'::jsonb);
select public.import_guests((select v::uuid from ids where k = 'ev'), 'f', '[{"display_name":"Cô Lan"}]'::jsonb,
  array[(select v::uuid from ids where k = 's2')]);
insert into ids select 'tA', token from public.guests where display_name like 'Anh Minh%';
insert into ids select 'tB', token from public.guests where display_name = 'Cô Lan';
reset role;
insert into public.event_members (event_id, user_id, role)
values ((select v::uuid from ids where k = 'ev'), '00000000-0000-0000-0000-00000000000b', 'viewer');

-- 1–5. khách đọc phần riêng của mình
select pg_temp.anon();
select is(public.get_guest_invitation((select v from ids where k = 'slug'), (select v from ids where k = 'tA')) ->> 'salutation',
  'Anh Minh', 'xưng hô của khách');
select is(jsonb_array_length(public.get_guest_invitation((select v from ids where k = 'slug'), (select v from ids where k = 'tA')) -> 'invites'),
  2, 'khách A thấy 2 buổi được mời');
select is(jsonb_array_length(public.get_guest_invitation((select v from ids where k = 'slug'), (select v from ids where k = 'tB')) -> 'invites'),
  1, 'khách B chỉ thấy buổi nhà trai');
select is(public.get_guest_invitation((select v from ids where k = 'slug'), 'aaaaaaaaaaaaaaaaaaaaaa'), null, 'token sai trả null');
select ok(
  not (public.get_guest_invitation((select v from ids where k = 'slug'), (select v from ids where k = 'tA'))::text ~ '912345678'),
  'không trả SĐT của khách');

-- 6–7. phải đồng ý dữ liệu ở lần trả lời đầu
select throws_ok(
  format($$select public.submit_rsvp(%L, %L, '[{"session_id":"%s","status":"yes","count":2}]'::jsonb)$$,
    (select v from ids where k = 'slug'), (select v from ids where k = 'tA'), (select v from ids where k = 's1')),
  'P0001', 'Vui lòng đồng ý với cách TRAO dùng thông tin của bạn', 'lần đầu cần đồng ý');
select lives_ok(
  format($$select public.submit_rsvp(%L, %L, '[{"session_id":"%s","status":"yes","count":2},{"session_id":"%s","status":"no"}]'::jsonb, 'Đi 2 người', '2026-11')$$,
    (select v from ids where k = 'slug'), (select v from ids where k = 'tA'), (select v from ids where k = 's1'), (select v from ids where k = 's2')),
  'trả lời kèm đồng ý');

-- 8–10. kết quả ghi đúng
reset role;
select is((select rsvp_status || ':' || attending_count || ':' || responded_via from public.session_invites
           where session_id = (select v::uuid from ids where k = 's1') and guest_id = (select id from public.guests where token = (select v from ids where k = 'tA'))),
  'yes:2:guest', 'buổi 1: đến 2 người');
select is((select attending_count from public.session_invites
           where session_id = (select v::uuid from ids where k = 's2') and guest_id = (select id from public.guests where token = (select v from ids where k = 'tA'))),
  0, 'buổi 2: không đến = 0 người');
select is((select count(*)::int from public.consents), 1, 'lưu bằng chứng đồng ý');

-- 11–14. ràng buộc
select pg_temp.anon();
select lives_ok(
  format($$select public.submit_rsvp(%L, %L, '[{"session_id":"%s","status":"yes","count":9}]'::jsonb)$$,
    (select v from ids where k = 'slug'), (select v from ids where k = 'tA'), (select v from ids where k = 's1')),
  'lần sau không cần đồng ý lại');
reset role;
select is((select attending_count from public.session_invites where session_id = (select v::uuid from ids where k = 's1')
           and guest_id = (select id from public.guests where token = (select v from ids where k = 'tA'))),
  3, 'số người bị giới hạn bởi tối đa (3)');
select pg_temp.anon();
select throws_ok(
  format($$select public.submit_rsvp(%L, %L, '[{"session_id":"%s","status":"yes"}]'::jsonb, null, 'v1')$$,
    (select v from ids where k = 'slug'), (select v from ids where k = 'tB'), (select v from ids where k = 's1')),
  'P0001', 'Bạn không được mời buổi này', 'không trả lời buổi không được mời');
select throws_ok(
  format($$select public.submit_rsvp(%L, 'aaaaaaaaaaaaaaaaaaaaaa', '[]'::jsonb)$$, (select v from ids where k = 'slug')),
  'P0002', null, 'token sai không trả lời được');

-- 15. hạn chót
reset role;
update public.events set settings = jsonb_build_object('rsvpDeadline', now() - interval '1 day');
select pg_temp.anon();
select throws_ok(
  format($$select public.submit_rsvp(%L, %L, '[{"session_id":"%s","status":"no"}]'::jsonb)$$,
    (select v from ids where k = 'slug'), (select v from ids where k = 'tA'), (select v from ids where k = 's1')),
  'P0001', null, 'quá hạn chót thì không trả lời được');
reset role;
update public.events set settings = '{}';

-- 16. khách đã xóa: link hết hiệu lực
update public.guests set deleted_at = now() where display_name = 'Cô Lan';
select pg_temp.anon();
select is(public.get_guest_invitation((select v from ids where k = 'slug'), (select v from ids where k = 'tB')), null, 'khách đã xóa không mở được phần riêng');

-- 17–20. lời chúc
select lives_ok(
  format($$select public.post_wish(%L, 'Minh', 'Chúc hai bạn trăm năm hạnh phúc', %L)$$, (select v from ids where k = 'slug'), (select v from ids where k = 'tA')),
  'khách gửi lời chúc');
select lives_ok(format($$select public.post_wish(%L, 'Người lạ', 'Chúc mừng')$$, (select v from ids where k = 'slug')),
  'người có link chung cũng gửi được');
select is(jsonb_array_length(public.get_invitation((select v from ids where k = 'slug')) -> 'wishes'), 2, 'thiệp hiện 2 lời chúc');
select throws_ok(format($$select public.post_wish(%L, 'X', '')$$, (select v from ids where k = 'slug')),
  '23514', null, 'lời chúc rỗng bị từ chối');

-- 21–22. ẩn lời chúc
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
update public.wishes set status = 'hidden' where author_name = 'Người lạ';
select pg_temp.anon();
select is(jsonb_array_length(public.get_invitation((select v from ids where k = 'slug')) -> 'wishes'), 1, 'lời chúc bị ẩn không hiện');
select throws_ok('select * from public.wishes', '42501', null, 'anon không đọc bảng wishes');

-- 23–25. thống kê
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select is((public.event_stats((select v::uuid from ids where k = 'ev')) ->> 'guests')::int, 1, 'viewer xem thống kê: 1 khách còn lại');
select is((public.event_stats((select v::uuid from ids where k = 'ev')) -> 'sessions' -> 0 ->> 'attending')::int, 3, 'buổi 1: 3 người sẽ đến');
select is((select count(*)::int from public.guests), 0, 'viewer vẫn không đọc được bảng khách');

select * from finish();
rollback;
