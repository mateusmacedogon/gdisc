begin;

-- GDisC core schema.
-- Authorization is derived exclusively from auth.uid() and relational data.
-- raw_user_meta_data is only used to initialize cosmetic profile fields.

create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null,
  avatar_url text,
  bio text,
  status text not null default 'OFFLINE',
  custom_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_username_length_check
    check (char_length(username) between 2 and 32),
  constraint profiles_username_format_check
    check (username ~ '^[a-z0-9_.]+$'),
  constraint profiles_display_name_check
    check (char_length(btrim(display_name)) between 1 and 50),
  constraint profiles_avatar_url_length_check
    check (avatar_url is null or char_length(avatar_url) <= 2048),
  constraint profiles_bio_length_check
    check (bio is null or char_length(bio) <= 500),
  constraint profiles_status_check
    check (status in ('ONLINE', 'IDLE', 'DND', 'OFFLINE')),
  constraint profiles_custom_status_length_check
    check (custom_status is null or char_length(custom_status) <= 128)
);

create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));

create table if not exists public.servers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon_url text,
  description text,
  owner_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint servers_name_check
    check (char_length(btrim(name)) between 1 and 100),
  constraint servers_icon_url_length_check
    check (icon_url is null or char_length(icon_url) <= 2048),
  constraint servers_description_length_check
    check (description is null or char_length(description) <= 1000)
);

create table if not exists public.server_members (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  nickname text,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint server_members_server_user_key unique (server_id, user_id),
  constraint server_members_id_server_key unique (id, server_id),
  constraint server_members_nickname_check
    check (nickname is null or char_length(btrim(nickname)) between 1 and 50)
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers (id) on delete cascade,
  name text not null,
  color text not null default '#6C63FF',
  position integer not null default 0,
  -- Clients should serialize this bigint as a string at their model boundary.
  permissions bigint not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint roles_id_server_key unique (id, server_id),
  constraint roles_name_check
    check (char_length(btrim(name)) between 1 and 100),
  constraint roles_color_check
    check (color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint roles_position_check
    check (position between 0 and 100000),
  constraint roles_permissions_check
    check (permissions >= 0)
);

create unique index if not exists roles_one_default_per_server_key
  on public.roles (server_id)
  where is_default;

create table if not exists public.member_roles (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers (id) on delete cascade,
  member_id uuid not null,
  role_id uuid not null,
  created_at timestamptz not null default now(),

  constraint member_roles_member_role_key unique (member_id, role_id),
  constraint member_roles_member_server_fk
    foreign key (member_id, server_id)
    references public.server_members (id, server_id) on delete cascade,
  constraint member_roles_role_server_fk
    foreign key (role_id, server_id)
    references public.roles (id, server_id) on delete cascade
);

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers (id) on delete cascade,
  name text not null,
  type text not null default 'TEXT',
  topic text,
  position integer not null default 0,
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint channels_name_check
    check (char_length(btrim(name)) between 1 and 100),
  constraint channels_type_check
    check (type in ('TEXT', 'VOICE')),
  constraint channels_topic_length_check
    check (topic is null or char_length(topic) <= 1024),
  constraint channels_position_check
    check (position between 0 and 100000)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  author_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  content text not null,
  reply_to_id uuid references public.messages (id) on delete set null,
  is_edited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint messages_content_check
    check (char_length(btrim(content)) between 1 and 4000)
);

-- Full old rows make UPDATE/DELETE Realtime payloads useful across clients.
alter table public.servers replica identity full;
alter table public.server_members replica identity full;
alter table public.roles replica identity full;
alter table public.member_roles replica identity full;
alter table public.channels replica identity full;
alter table public.messages replica identity full;

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  code text not null default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  server_id uuid not null references public.servers (id) on delete cascade,
  creator_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  max_uses integer not null default 0,
  uses integer not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint invites_code_key unique (code),
  constraint invites_code_format_check
    check (code ~ '^[A-Z0-9]{8,16}$'),
  constraint invites_max_uses_check
    check (max_uses between 0 and 1000000),
  constraint invites_uses_check
    check (uses >= 0 and (max_uses = 0 or uses <= max_uses)),
  constraint invites_expiry_check
    check (expires_at is null or expires_at > created_at)
);

-- ---------------------------------------------------------------------------
-- Indexes for foreign keys, ordered collections, and cursor pagination
-- ---------------------------------------------------------------------------

create index if not exists servers_owner_id_idx
  on public.servers (owner_id);

create index if not exists server_members_user_joined_idx
  on public.server_members (user_id, joined_at, id);
create index if not exists server_members_server_joined_idx
  on public.server_members (server_id, joined_at, id);

create index if not exists roles_server_position_idx
  on public.roles (server_id, position, id);

create index if not exists member_roles_server_idx
  on public.member_roles (server_id);
create index if not exists member_roles_role_idx
  on public.member_roles (role_id);
create index if not exists member_roles_member_server_idx
  on public.member_roles (member_id, server_id);
create index if not exists member_roles_role_server_idx
  on public.member_roles (role_id, server_id);

create index if not exists channels_server_type_position_idx
  on public.channels (server_id, type, position, id);
create index if not exists channels_server_position_idx
  on public.channels (server_id, position, id);

create index if not exists messages_channel_created_desc_idx
  on public.messages (channel_id, created_at desc, id desc);
create index if not exists messages_author_created_desc_idx
  on public.messages (author_id, created_at desc, id desc);
create index if not exists messages_reply_to_id_idx
  on public.messages (reply_to_id)
  where reply_to_id is not null;

create index if not exists invites_server_created_desc_idx
  on public.invites (server_id, created_at desc, id desc);
create index if not exists invites_creator_id_idx
  on public.invites (creator_id);
create index if not exists invites_active_code_idx
  on public.invites (code, expires_at, uses, max_uses);

-- ---------------------------------------------------------------------------
-- Generic and integrity triggers
-- ---------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public;

create or replace function private.normalize_profile_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.username := lower(btrim(new.username));
  new.display_name := btrim(new.display_name);
  new.avatar_url := nullif(btrim(new.avatar_url), '');
  new.bio := nullif(btrim(new.bio), '');
  new.custom_status := nullif(btrim(new.custom_status), '');
  return new;
end;
$$;

revoke all on function private.normalize_profile_fields() from public;

drop trigger if exists gdisc_normalize_profile_fields on public.profiles;
create trigger gdisc_normalize_profile_fields
before insert or update of username, display_name, avatar_url, bio, custom_status
on public.profiles
for each row execute function private.normalize_profile_fields();

create or replace function private.normalize_invite_code()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.code := upper(btrim(new.code));
  return new;
end;
$$;

revoke all on function private.normalize_invite_code() from public;

drop trigger if exists gdisc_normalize_invite_code on public.invites;
create trigger gdisc_normalize_invite_code
before insert or update of code on public.invites
for each row execute function private.normalize_invite_code();

create or replace function private.mark_message_edited()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.content is distinct from old.content then
    new.is_edited := true;
  end if;
  return new;
end;
$$;

revoke all on function private.mark_message_edited() from public;

drop trigger if exists gdisc_10_mark_message_edited on public.messages;
create trigger gdisc_10_mark_message_edited
before update on public.messages
for each row execute function private.mark_message_edited();

create or replace function private.enforce_reply_channel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reply_to_id is not null and not exists (
    select 1
    from public.messages as parent
    where parent.id = new.reply_to_id
      and parent.channel_id = new.channel_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'A mensagem respondida deve pertencer ao mesmo canal.';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_reply_channel() from public;

drop trigger if exists gdisc_enforce_reply_channel on public.messages;
create trigger gdisc_enforce_reply_channel
before insert or update of channel_id, reply_to_id on public.messages
for each row execute function private.enforce_reply_channel();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'servers',
    'server_members',
    'roles',
    'channels',
    'messages',
    'invites'
  ]
  loop
    execute format('drop trigger if exists gdisc_set_updated_at on public.%I', table_name);
    execute format(
      'create trigger gdisc_set_updated_at before update on public.%I for each row execute function private.set_updated_at()',
      table_name
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Auth profile initialization (metadata is never used for authorization)
-- ---------------------------------------------------------------------------

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_username text;
  fallback_username text;
  candidate_display_name text;
  candidate_avatar_url text;
  candidate_bio text;
begin
  candidate_username := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));

  if char_length(candidate_username) not between 2 and 32
     or candidate_username !~ '^[a-z0-9_.]+$' then
    candidate_username := lower(regexp_replace(
      split_part(coalesce(new.email, ''), '@', 1),
      '[^a-zA-Z0-9_.]',
      '',
      'g'
    ));
  end if;

  candidate_username := left(candidate_username, 32);

  if char_length(candidate_username) not between 2 and 32
     or candidate_username !~ '^[a-z0-9_.]+$' then
    candidate_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  candidate_display_name := left(btrim(coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(new.raw_user_meta_data ->> 'displayName', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    candidate_username
  )), 50);

  if candidate_display_name is null or candidate_display_name = '' then
    candidate_display_name := candidate_username;
  end if;

  candidate_avatar_url := left(nullif(btrim(coalesce(
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'avatarUrl'
  )), ''), 2048);

  candidate_bio := left(nullif(btrim(new.raw_user_meta_data ->> 'bio'), ''), 500);

  begin
    insert into public.profiles (
      id,
      username,
      display_name,
      avatar_url,
      bio
    )
    values (
      new.id,
      candidate_username,
      candidate_display_name,
      candidate_avatar_url,
      candidate_bio
    )
    on conflict (id) do nothing;
  exception
    when unique_violation then
      -- A preflight availability check is advisory; this suffix closes its race.
      fallback_username := left(candidate_username, 23)
        || '_'
        || substr(replace(new.id::text, '-', ''), 1, 8);

      insert into public.profiles (
        id,
        username,
        display_name,
        avatar_url,
        bio
      )
      values (
        new.id,
        fallback_username,
        candidate_display_name,
        candidate_avatar_url,
        candidate_bio
      )
      on conflict (id) do nothing;
  end;

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public;

drop trigger if exists gdisc_on_auth_user_created on auth.users;
create trigger gdisc_on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Server bootstrap
-- ---------------------------------------------------------------------------

create or replace function private.bootstrap_server()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_member_id uuid;
  everyone_role_id uuid;
begin
  insert into public.server_members (server_id, user_id)
  values (new.id, new.owner_id)
  returning id into owner_member_id;

  insert into public.roles (
    server_id,
    name,
    color,
    position,
    permissions,
    is_default
  )
  values (
    new.id,
    '@everyone',
    '#9AA4B2',
    0,
    63936,
    true
  )
  returning id into everyone_role_id;

  insert into public.member_roles (server_id, member_id, role_id)
  values (new.id, owner_member_id, everyone_role_id);

  insert into public.channels (server_id, name, type, topic, position)
  values
    (new.id, 'geral', 'TEXT', 'Canal principal de texto', 0),
    (new.id, 'Voz Geral', 'VOICE', 'Canal principal de voz', 1);

  insert into public.invites (server_id, creator_id)
  values (new.id, new.owner_id);

  return new;
end;
$$;

revoke all on function private.bootstrap_server() from public;

drop trigger if exists gdisc_bootstrap_server on public.servers;
create trigger gdisc_bootstrap_server
after insert on public.servers
for each row execute function private.bootstrap_server();

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER authorization helpers for non-recursive RLS
-- ---------------------------------------------------------------------------

create or replace function private.is_server_member(p_server_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.server_members as sm
      where sm.server_id = p_server_id
        and sm.user_id = (select auth.uid())
    );
$$;

create or replace function private.is_server_owner(p_server_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.servers as s
      where s.id = p_server_id
        and s.owner_id = (select auth.uid())
    );
$$;

create or replace function private.has_server_permission(
  p_server_id uuid,
  p_permission bigint
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then false
    when private.is_server_owner(p_server_id) then true
    else coalesce((
      select bool_or(
        (r.permissions & 1::bigint) = 1::bigint
        or (r.permissions & p_permission) = p_permission
      )
      from public.server_members as sm
      join public.member_roles as mr
        on mr.member_id = sm.id
        and mr.server_id = sm.server_id
      join public.roles as r
        on r.id = mr.role_id
        and r.server_id = mr.server_id
      where sm.server_id = p_server_id
        and sm.user_id = (select auth.uid())
    ), false)
  end;
$$;

create or replace function private.can_view_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then false
    when p_profile_id = (select auth.uid()) then true
    else exists (
      select 1
      from public.server_members as viewer_membership
      join public.server_members as target_membership
        on target_membership.server_id = viewer_membership.server_id
      where viewer_membership.user_id = (select auth.uid())
        and target_membership.user_id = p_profile_id
    )
  end;
$$;

create or replace function private.can_access_channel(p_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.channels as c
      where c.id = p_channel_id
        and private.is_server_member(c.server_id)
        and private.has_server_permission(c.server_id, 128::bigint)
        -- Channel-specific overwrites can be added later. Until then, private
        -- channels are intentionally limited to owners/administrators.
        and (
          not c.is_private
          or private.has_server_permission(c.server_id, 1::bigint)
        )
    );
$$;

create or replace function private.can_send_to_channel(p_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_access_channel(p_channel_id)
    and exists (
      select 1
      from public.channels as c
      where c.id = p_channel_id
        and c.type = 'TEXT'
        and private.has_server_permission(c.server_id, 256::bigint)
    );
$$;

create or replace function private.can_access_realtime_topic(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  resource_id uuid;
begin
  if (select auth.uid()) is null or p_topic is null then
    return false;
  end if;

  if left(p_topic, 13) = 'gdisc:server:' then
    begin
      resource_id := substring(p_topic from 14)::uuid;
    exception
      when invalid_text_representation then
        return false;
    end;

    return private.is_server_member(resource_id);
  end if;

  if left(p_topic, 12) = 'gdisc:voice:' then
    begin
      resource_id := substring(p_topic from 13)::uuid;
    exception
      when invalid_text_representation then
        return false;
    end;

    return exists (
      select 1
      from public.channels as c
      where c.id = resource_id
        and c.type = 'VOICE'
        and private.can_access_channel(c.id)
        and private.has_server_permission(c.server_id, 4096::bigint)
    );
  end if;

  return false;
end;
$$;

revoke all on function private.is_server_member(uuid) from public;
revoke all on function private.is_server_owner(uuid) from public;
revoke all on function private.has_server_permission(uuid, bigint) from public;
revoke all on function private.can_view_profile(uuid) from public;
revoke all on function private.can_access_channel(uuid) from public;
revoke all on function private.can_send_to_channel(uuid) from public;
revoke all on function private.can_access_realtime_topic(text) from public;

grant usage on schema private to authenticated, service_role;
grant execute on function private.is_server_member(uuid) to authenticated, service_role;
grant execute on function private.is_server_owner(uuid) to authenticated, service_role;
grant execute on function private.has_server_permission(uuid, bigint) to authenticated, service_role;
grant execute on function private.can_view_profile(uuid) to authenticated, service_role;
grant execute on function private.can_access_channel(uuid) to authenticated, service_role;
grant execute on function private.can_send_to_channel(uuid) to authenticated, service_role;
grant execute on function private.can_access_realtime_topic(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Public RPCs
-- ---------------------------------------------------------------------------

create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    char_length(lower(btrim(p_username))) between 2 and 32
    and lower(btrim(p_username)) ~ '^[a-z0-9_.]+$'
    and not exists (
      select 1
      from public.profiles as p
      where lower(p.username) = lower(btrim(p_username))
    ),
    false
  );
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated, service_role;

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
  on conflict (server_id, user_id) do nothing
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

create or replace function public.leave_server(p_server_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  server_owner_id uuid;
  deleted_membership boolean;
begin
  if current_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'É necessário estar autenticado para sair de um servidor.';
  end if;

  select s.owner_id
  into server_owner_id
  from public.servers as s
  where s.id = p_server_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Servidor não encontrado.';
  end if;

  if server_owner_id = current_user_id then
    raise exception using
      errcode = 'P0001',
      message = 'O proprietário não pode sair sem transferir a posse ou excluir o servidor.';
  end if;

  delete from public.server_members as sm
  where sm.server_id = p_server_id
    and sm.user_id = current_user_id
  returning true into deleted_membership;

  return coalesce(deleted_membership, false);
end;
$$;

revoke all on function public.leave_server(uuid) from public;
revoke execute on function public.leave_server(uuid) from anon;
grant execute on function public.leave_server(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.servers enable row level security;
alter table public.server_members enable row level security;
alter table public.roles enable row level security;
alter table public.member_roles enable row level security;
alter table public.channels enable row level security;
alter table public.messages enable row level security;
alter table public.invites enable row level security;

drop policy if exists gdisc_profiles_select_shared on public.profiles;
create policy gdisc_profiles_select_shared
on public.profiles
for select
to authenticated
using (private.can_view_profile(id));

drop policy if exists gdisc_profiles_update_self on public.profiles;
create policy gdisc_profiles_update_self
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists gdisc_servers_select_members on public.servers;
create policy gdisc_servers_select_members
on public.servers
for select
to authenticated
using (
  owner_id = (select auth.uid())
  or private.is_server_member(id)
);

drop policy if exists gdisc_servers_insert_owner on public.servers;
create policy gdisc_servers_insert_owner
on public.servers
for insert
to authenticated
with check (owner_id = (select auth.uid()));

drop policy if exists gdisc_servers_update_owner on public.servers;
create policy gdisc_servers_update_owner
on public.servers
for update
to authenticated
using (private.has_server_permission(id, 2::bigint))
with check (private.has_server_permission(id, 2::bigint));

drop policy if exists gdisc_servers_delete_owner on public.servers;
create policy gdisc_servers_delete_owner
on public.servers
for delete
to authenticated
using (private.is_server_owner(id));

drop policy if exists gdisc_server_members_select_members on public.server_members;
create policy gdisc_server_members_select_members
on public.server_members
for select
to authenticated
using (private.is_server_member(server_id));

drop policy if exists gdisc_server_members_update_self_or_owner on public.server_members;
create policy gdisc_server_members_update_self_or_owner
on public.server_members
for update
to authenticated
using (
  user_id = (select auth.uid())
  or private.is_server_owner(server_id)
)
with check (
  user_id = (select auth.uid())
  or private.is_server_owner(server_id)
);

drop policy if exists gdisc_server_members_delete_self_or_owner on public.server_members;
create policy gdisc_server_members_delete_self_or_owner
on public.server_members
for delete
to authenticated
using (
  (
    user_id = (select auth.uid())
    and not private.is_server_owner(server_id)
  )
  or (
    private.has_server_permission(server_id, 16::bigint)
    and user_id <> (select auth.uid())
    and user_id <> (
      select s.owner_id
      from public.servers as s
      where s.id = server_members.server_id
    )
  )
);

drop policy if exists gdisc_roles_select_members on public.roles;
create policy gdisc_roles_select_members
on public.roles
for select
to authenticated
using (private.is_server_member(server_id));

drop policy if exists gdisc_roles_insert_owner on public.roles;
create policy gdisc_roles_insert_owner
on public.roles
for insert
to authenticated
with check (private.has_server_permission(server_id, 4::bigint) and not is_default);

drop policy if exists gdisc_roles_update_owner on public.roles;
create policy gdisc_roles_update_owner
on public.roles
for update
to authenticated
using (private.has_server_permission(server_id, 4::bigint))
with check (private.has_server_permission(server_id, 4::bigint));

drop policy if exists gdisc_roles_delete_owner on public.roles;
create policy gdisc_roles_delete_owner
on public.roles
for delete
to authenticated
using (private.has_server_permission(server_id, 4::bigint) and not is_default);

drop policy if exists gdisc_member_roles_select_members on public.member_roles;
create policy gdisc_member_roles_select_members
on public.member_roles
for select
to authenticated
using (private.is_server_member(server_id));

drop policy if exists gdisc_member_roles_insert_owner on public.member_roles;
create policy gdisc_member_roles_insert_owner
on public.member_roles
for insert
to authenticated
with check (private.has_server_permission(server_id, 4::bigint));

drop policy if exists gdisc_member_roles_delete_owner on public.member_roles;
create policy gdisc_member_roles_delete_owner
on public.member_roles
for delete
to authenticated
using (private.has_server_permission(server_id, 4::bigint));

drop policy if exists gdisc_channels_select_members on public.channels;
create policy gdisc_channels_select_members
on public.channels
for select
to authenticated
using (
  private.is_server_member(server_id)
  and private.has_server_permission(server_id, 128::bigint)
  and (
    not is_private
    or private.has_server_permission(server_id, 1::bigint)
  )
);

drop policy if exists gdisc_channels_insert_owner on public.channels;
create policy gdisc_channels_insert_owner
on public.channels
for insert
to authenticated
with check (private.has_server_permission(server_id, 8::bigint));

drop policy if exists gdisc_channels_update_owner on public.channels;
create policy gdisc_channels_update_owner
on public.channels
for update
to authenticated
using (private.has_server_permission(server_id, 8::bigint))
with check (private.has_server_permission(server_id, 8::bigint));

drop policy if exists gdisc_channels_delete_owner on public.channels;
create policy gdisc_channels_delete_owner
on public.channels
for delete
to authenticated
using (private.has_server_permission(server_id, 8::bigint));

drop policy if exists gdisc_messages_select_members on public.messages;
create policy gdisc_messages_select_members
on public.messages
for select
to authenticated
using (private.can_access_channel(channel_id));

drop policy if exists gdisc_messages_insert_author on public.messages;
create policy gdisc_messages_insert_author
on public.messages
for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and private.can_send_to_channel(channel_id)
);

drop policy if exists gdisc_messages_update_author on public.messages;
create policy gdisc_messages_update_author
on public.messages
for update
to authenticated
using (
  author_id = (select auth.uid())
  and private.can_access_channel(channel_id)
)
with check (
  author_id = (select auth.uid())
  and private.can_access_channel(channel_id)
);

drop policy if exists gdisc_messages_delete_author on public.messages;
create policy gdisc_messages_delete_author
on public.messages
for delete
to authenticated
using (
  (
    author_id = (select auth.uid())
    or private.has_server_permission(
      (select c.server_id from public.channels as c where c.id = channel_id),
      512::bigint
    )
  )
  and private.can_access_channel(channel_id)
);

drop policy if exists gdisc_invites_select_members on public.invites;
create policy gdisc_invites_select_members
on public.invites
for select
to authenticated
using (private.is_server_member(server_id));

drop policy if exists gdisc_invites_insert_members on public.invites;
create policy gdisc_invites_insert_members
on public.invites
for insert
to authenticated
with check (
  creator_id = (select auth.uid())
  and private.has_server_permission(server_id, 64::bigint)
  and uses = 0
);

drop policy if exists gdisc_invites_delete_creator_or_owner on public.invites;
create policy gdisc_invites_delete_creator_or_owner
on public.invites
for delete
to authenticated
using (
  creator_id = (select auth.uid())
  or private.is_server_owner(server_id)
);

-- ---------------------------------------------------------------------------
-- Explicit Data API grants (required by the 2026 auto-exposure change)
-- ---------------------------------------------------------------------------

revoke all privileges on table
  public.profiles,
  public.servers,
  public.server_members,
  public.roles,
  public.member_roles,
  public.channels,
  public.messages,
  public.invites
from anon, authenticated;

revoke all privileges on table
  public.profiles,
  public.servers,
  public.server_members,
  public.roles,
  public.member_roles,
  public.channels,
  public.messages,
  public.invites
from public;

grant usage on schema public to anon, authenticated, service_role;

grant select on table public.profiles to authenticated;
grant update (username, display_name, avatar_url, bio, status, custom_status)
  on public.profiles to authenticated;

grant select, delete on table public.servers to authenticated;
grant insert (name, icon_url, description, owner_id)
  on public.servers to authenticated;
grant update (name, icon_url, description)
  on public.servers to authenticated;

grant select, delete on table public.server_members to authenticated;
grant update (nickname) on public.server_members to authenticated;

grant select, delete on table public.roles to authenticated;
grant insert (server_id, name, color, position, permissions)
  on public.roles to authenticated;
grant update (name, color, position, permissions)
  on public.roles to authenticated;

grant select, delete on table public.member_roles to authenticated;
grant insert (server_id, member_id, role_id)
  on public.member_roles to authenticated;

grant select, delete on table public.channels to authenticated;
grant insert (server_id, name, type, topic, position, is_private)
  on public.channels to authenticated;
grant update (name, type, topic, position, is_private)
  on public.channels to authenticated;

grant select, delete on table public.messages to authenticated;
grant insert (channel_id, author_id, content, reply_to_id)
  on public.messages to authenticated;
grant update (content) on public.messages to authenticated;

grant select, delete on table public.invites to authenticated;
grant insert (server_id, creator_id, max_uses, expires_at)
  on public.invites to authenticated;

grant all privileges on table
  public.profiles,
  public.servers,
  public.server_members,
  public.roles,
  public.member_roles,
  public.channels,
  public.messages,
  public.invites
to service_role;

-- ---------------------------------------------------------------------------
-- Realtime: Postgres Changes plus private Broadcast/Presence topics
-- ---------------------------------------------------------------------------

do $$
declare
  realtime_table text;
begin
  if exists (
    select 1
    from pg_catalog.pg_publication
    where pubname = 'supabase_realtime'
  ) then
    foreach realtime_table in array array[
      'servers',
      'server_members',
      'roles',
      'member_roles',
      'channels',
      'messages'
    ]
    loop
      if not exists (
        select 1
        from pg_catalog.pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = realtime_table
      ) then
        execute format(
          'alter publication supabase_realtime add table public.%I',
          realtime_table
        );
      end if;
    end loop;
  else
    create publication supabase_realtime for table
      public.servers,
      public.server_members,
      public.roles,
      public.member_roles,
      public.channels,
      public.messages;
  end if;
end;
$$;

-- Supabase permits policies on realtime.messages while keeping every other
-- object in the realtime schema platform-managed.
drop policy if exists gdisc_members_receive_private_topics on realtime.messages;
create policy gdisc_members_receive_private_topics
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension in ('broadcast', 'presence')
  and private.can_access_realtime_topic((select realtime.topic()))
);

drop policy if exists gdisc_members_send_private_topics on realtime.messages;
create policy gdisc_members_send_private_topics
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension in ('broadcast', 'presence')
  and private.can_access_realtime_topic((select realtime.topic()))
);

commit;
