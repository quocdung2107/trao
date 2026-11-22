-- M4a: xuất Excel (ghi nhật ký), dọn thùng rác sau 30 ngày.

-- ---------------------------------------------------------------------------
-- Dữ liệu xuất Excel: mọi khách còn trong danh sách, kèm trả lời, bàn, check-in từng buổi.
-- Mỗi lần xuất ghi audit_log (thiết kế §6.6: xuất dữ liệu khách phải để lại dấu vết).
-- ---------------------------------------------------------------------------
create function public.export_event(p_event_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not private.has_event_role(p_event_id, array['owner', 'cohost']) then
    raise exception 'Chỉ chủ tiệc hoặc đồng tổ chức được xuất dữ liệu' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'title', e.title,
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) order by s.sort, s.created_at)
      from public.sessions s where s.event_id = e.id
    ), '[]'::jsonb),
    'guests', coalesce((
      select jsonb_agg(jsonb_build_object(
          'name', g.display_name,
          'salutation', g.salutation,
          'phone', g.phone_e164,
          'email', g.email,
          'side', g.side,
          'max_party_size', g.max_party_size,
          'notes', g.notes,
          'invite_sent_at', g.invite_sent_at,
          'groups', coalesce((
            select jsonb_agg(gg.name order by gg.name)
            from public.guest_group_links l join public.guest_groups gg on gg.id = l.group_id
            where l.guest_id = g.id
          ), '[]'::jsonb),
          'invites', coalesce((
            select jsonb_agg(jsonb_build_object(
                'session_id', si.session_id,
                'rsvp', si.rsvp_status,
                'attending', si.attending_count,
                'note', si.rsvp_note,
                'responded_at', si.responded_at,
                'tables', coalesce((
                  select jsonb_agg(t.label order by t.sort, t.label)
                  from public.seat_assignments sa join public.tables t on t.id = sa.table_id
                  where sa.session_invite_id = si.id
                ), '[]'::jsonb),
                'arrived_at', c.server_at,
                'arrived_count', c.arrived_count))
            from public.session_invites si
            left join public.checkins c on c.session_invite_id = si.id and c.status = 'accepted'
            where si.guest_id = g.id
          ), '[]'::jsonb))
        order by g.display_name)
      from public.guests g where g.event_id = e.id and g.deleted_at is null
    ), '[]'::jsonb))
  into v_result
  from public.events e where e.id = p_event_id;

  insert into public.audit_log (event_id, action, entity, entity_id, after)
  values (p_event_id, 'export', 'event', p_event_id,
    jsonb_build_object('guests', jsonb_array_length(v_result -> 'guests')));
  return v_result;
end;
$$;
revoke all on function public.export_event(uuid) from public, anon;
grant execute on function public.export_event(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Thùng rác: khách và sự kiện đã xóa quá 30 ngày thì xóa hẳn.
-- ---------------------------------------------------------------------------
create function private.purge_trash()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_guests int;
  v_events int;
begin
  delete from public.guests where deleted_at < now() - interval '30 days';
  get diagnostics v_guests = row_count;
  delete from public.events where deleted_at < now() - interval '30 days';
  get diagnostics v_events = row_count;
  return jsonb_build_object('guests', v_guests, 'events', v_events);
end;
$$;
revoke all on function private.purge_trash() from public, authenticated;

-- Lịch chạy 3:17 sáng mỗi ngày (giờ UTC). Bỏ qua khi Postgres không có pg_cron (test trên Postgres thuần).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('trao-purge-trash', '17 3 * * *', 'select private.purge_trash()');
  end if;
end $$;
