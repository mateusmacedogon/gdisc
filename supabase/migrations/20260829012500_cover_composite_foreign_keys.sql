begin;

create index if not exists member_roles_member_server_idx
  on public.member_roles (member_id, server_id);

create index if not exists member_roles_role_server_idx
  on public.member_roles (role_id, server_id);

commit;
