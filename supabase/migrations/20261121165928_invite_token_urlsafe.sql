-- Token lời mời dùng base64url (không có + / =) để đặt thẳng vào URL.
alter table public.event_invites
  alter column token set default translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_');
