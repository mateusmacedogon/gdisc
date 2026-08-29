-- The RPC returns a column named server_id. In PL/pgSQL that output parameter
-- conflicts with the unqualified server_id used by ON CONFLICT. Target the
-- named unique constraint so PostgreSQL never has to resolve that identifier.
create or replace function public.join_server_by_invite(p_code text)
returns table (server_id uuid, joined boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  invite_row public.invites%rowtype;
  membership_id uuid;
  did_join boolean := false;
begin
  if current_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'É necessário estar autenticado para entrar em um servidor.';
  end if;

  select i.*
  into invite_row
  from public.invites as i
  where i.code = upper(btrim(p_code))
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Convite inválido.';
  end if;

  select sm.id
  into membership_id
  from public.server_members as sm
  where sm.server_id = invite_row.server_id
    and sm.user_id = current_user_id;

  -- Existing members do not consume an invite use, including on an old link.
  if membership_id is not null then
    insert into public.member_roles (server_id, member_id, role_id)
    select invite_row.server_id, membership_id, r.id
    from public.roles as r
    where r.server_id = invite_row.server_id
      and r.is_default
    on conflict (member_id, role_id) do nothing;

    return query select invite_row.server_id, false;
    return;
  end if;

  if invite_row.expires_at is not null and invite_row.expires_at <= now() then
    raise exception using
      errcode = 'P0001',
      message = 'Este convite expirou.';
  end if;

  if invite_row.max_uses > 0 and invite_row.uses >= invite_row.max_uses then
    raise exception using
      errcode = 'P0001',
      message = 'Este convite atingiu o limite máximo de usos.';
  end if;

  insert into public.server_members (server_id, user_id)
  values (invite_row.server_id, current_user_id)
  on conflict on constraint server_members_server_user_key do nothing
  returning id into membership_id;

  if membership_id is not null then
    did_join := true;

    update public.invites as i
    set uses = i.uses + 1
    where i.id = invite_row.id;
  else
    -- Another invite may have added this user concurrently.
    select sm.id
    into membership_id
    from public.server_members as sm
    where sm.server_id = invite_row.server_id
      and sm.user_id = current_user_id;
  end if;

  insert into public.member_roles (server_id, member_id, role_id)
  select invite_row.server_id, membership_id, r.id
  from public.roles as r
  where r.server_id = invite_row.server_id
    and r.is_default
  on conflict (member_id, role_id) do nothing;

  return query select invite_row.server_id, did_join;
end;
$$;

revoke all on function public.join_server_by_invite(text) from public;
revoke execute on function public.join_server_by_invite(text) from anon;
grant execute on function public.join_server_by_invite(text) to authenticated;
