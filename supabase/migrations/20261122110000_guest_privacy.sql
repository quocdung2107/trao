-- M4b: trang quyền riêng tư của khách (G5). Khách xem TRAO đang giữ gì về mình và tự xóa bằng token cá nhân.
-- Thiết kế §1.2: phải có chức năng xóa dữ liệu. Xóa thật (không qua thùng rác), vì đây là yêu cầu của chính khách.

-- Khách xem dữ liệu của mình. Không trả SĐT/email, chỉ cho biết có lưu hay không.
create function public.guest_privacy_view(p_token text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'event_title', e.title,
    'name', g.display_name,
    'has_phone', g.phone_e164 is not null,
    'has_email', g.email is not null,
    'consented_at', (select min(c.consented_at) from public.consents c where c.guest_id = g.id),
    'wishes', (select count(*) from public.wishes w where w.guest_id = g.id),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object('name', s.name, 'rsvp', si.rsvp_status, 'attending', si.attending_count,
          'note', si.rsvp_note is not null) order by s.sort, s.starts_at)
      from public.session_invites si join public.sessions s on s.id = si.session_id
      where si.guest_id = g.id
    ), '[]'::jsonb))
  from public.guests g
  join public.events e on e.id = g.event_id and e.deleted_at is null
  where p_token ~ '^[A-Za-z0-9_-]{22}$' and g.token = p_token and g.deleted_at is null;
$$;
revoke all on function public.guest_privacy_view(text) from public;
grant execute on function public.guest_privacy_view(text) to anon, authenticated;

-- Khách tự xóa: xóa hẳn khách (dây chuyền: lời mời từng buổi, trả lời, đồng ý, chỗ ngồi, check-in),
-- xóa lời chúc của khách, gỡ tên khách khỏi nhật ký. Trả về slug các thiệp để làm mới cache trang thiệp.
create function public.guest_erase(p_token text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  g public.guests;
  v_invites uuid[];
  v_slugs jsonb;
begin
  select * into g from public.guests
  where p_token ~ '^[A-Za-z0-9_-]{22}$' and token = p_token and deleted_at is null
  for update;
  if not found then
    raise exception 'Link không hợp lệ hoặc thông tin đã được xóa' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(id), '{}') into v_invites from public.session_invites where guest_id = g.id;
  select coalesce(jsonb_agg(distinct i.slug), '[]'::jsonb) into v_slugs
  from public.wishes w join public.invitations i on i.id = w.invitation_id where w.guest_id = g.id;

  delete from public.wishes where guest_id = g.id;
  delete from public.guests where id = g.id;

  -- Nhật ký cũ (xếp bàn, hủy check-in) có tên khách: thay bằng nhãn chung.
  update public.audit_log
  set before = case when before ? 'guest' then before || '{"guest": "Khách đã xóa thông tin"}' else before end,
      after = case when after ? 'guest' then after || '{"guest": "Khách đã xóa thông tin"}' else after end
  where event_id = g.event_id and (entity_id = g.id or entity_id = any (v_invites));

  insert into public.audit_log (event_id, actor_id, action, entity, entity_id)
  values (g.event_id, null, 'guest.erase', 'guest', null);

  return jsonb_build_object('ok', true, 'slugs', v_slugs);
end;
$$;
revoke all on function public.guest_erase(text) from public;
grant execute on function public.guest_erase(text) to anon, authenticated;
