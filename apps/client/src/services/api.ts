import type {
  ChannelSummary,
  CreateChannelDTO,
  CreateInviteDTO,
  CreateMessageDTO,
  CreateRoleDTO,
  CreateServerDTO,
  InviteSummary,
  LoginDTO,
  MessageSummary,
  RegisterDTO,
  RoleSummary,
  ServerMemberSummary,
  ServerSummary,
  UpdateChannelDTO,
  UpdateMessageDTO,
  UpdateProfileDTO,
  UpdateRoleDTO,
  UpdateServerDTO,
  UserProfile,
  UserStatus,
  UserSummary,
} from '@gdisc/shared';
import { supabase, writeLegacyAuthToken } from './supabase.js';

type JsonObject = Record<string, unknown>;
type Row = Record<string, any>;

export interface RegisterResult {
  user: UserProfile | null;
  token: string | null;
  requiresEmailConfirmation: boolean;
  email: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function friendlyMessage(error: unknown, fallback = 'Não foi possível concluir a operação.'): string {
  const raw = error instanceof Error
    ? error.message
    : typeof error === 'object' && error && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error || '');

  const message = raw.toLowerCase();
  if (message.includes('invalid login credentials')) return 'E-mail ou senha inválidos.';
  if (message.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (message.includes('user already registered')) return 'Este e-mail já possui uma conta.';
  if (message.includes('password should be')) return 'A senha deve ter pelo menos 8 caracteres, com letras e números.';
  if (message.includes('duplicate key') && message.includes('username')) return 'Este nome de usuário já está em uso.';
  if (message.includes('row-level security') || message.includes('permission denied')) {
    return 'Você não tem permissão para realizar esta ação.';
  }
  if (message.includes('convite') || message.includes('invite')) return raw;
  return raw || fallback;
}

function fail(error: unknown, fallback?: string): never {
  const code = typeof error === 'object' && error && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined;
  throw new ApiError(friendlyMessage(error, fallback), 400, code);
}

function profileToSummary(row: Row): UserSummary {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url ?? null,
    status: (row.status ?? 'OFFLINE') as UserStatus,
    customStatus: row.custom_status ?? null,
  };
}

function profileToUser(row: Row, email: string): UserProfile {
  return {
    ...profileToSummary(row),
    email,
    bio: row.bio ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function channelFromRow(row: Row): ChannelSummary {
  return {
    id: row.id,
    serverId: row.server_id,
    name: row.name,
    type: row.type,
    topic: row.topic ?? null,
    position: row.position,
    isPrivate: row.is_private,
    createdAt: row.created_at,
  };
}

function roleFromRow(row: Row): RoleSummary {
  return {
    id: row.id,
    serverId: row.server_id,
    name: row.name,
    color: row.color,
    position: row.position,
    permissions: String(row.permissions),
    isDefault: row.is_default,
    createdAt: row.created_at,
  };
}

function inviteFromRow(row: Row): InviteSummary {
  return {
    id: row.id,
    code: row.code,
    serverId: row.server_id,
    creatorId: row.creator_id,
    maxUses: row.max_uses,
    uses: row.uses,
    expiresAt: row.expires_at ?? null,
    createdAt: row.created_at,
  };
}

async function currentAuthUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new ApiError('Sua sessão expirou. Entre novamente.', 401);
  return data.user;
}

async function currentProfile(): Promise<UserProfile> {
  const authUser = await currentAuthUser();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .single();
  if (error || !data) fail(error, 'Perfil não encontrado.');
  return profileToUser(data, authUser.email ?? '');
}

async function fetchChannels(serverIds: string[]): Promise<ChannelSummary[]> {
  if (serverIds.length === 0) return [];
  const { data, error } = await supabase
    .from('channels')
    .select('*')
    .in('server_id', serverIds)
    .order('position', { ascending: true })
    .order('id', { ascending: true });
  if (error) fail(error, 'Falha ao carregar canais.');
  return (data ?? []).map(channelFromRow);
}

async function fetchRoles(serverIds: string[]): Promise<RoleSummary[]> {
  if (serverIds.length === 0) return [];
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .in('server_id', serverIds)
    .order('position', { ascending: true })
    .order('id', { ascending: true });
  if (error) fail(error, 'Falha ao carregar cargos.');
  return (data ?? []).map(roleFromRow);
}

async function getServers(): Promise<ServerSummary[]> {
  await currentAuthUser();
  const { data: memberships, error: membershipError } = await supabase
    .from('server_members')
    .select('server_id, joined_at')
    .order('joined_at', { ascending: true });
  if (membershipError) fail(membershipError, 'Falha ao carregar seus servidores.');

  const ids = [...new Set((memberships ?? []).map((row: Row) => row.server_id as string))];
  if (ids.length === 0) return [];

  const [serverResult, memberResult, channels, roles] = await Promise.all([
    supabase.from('servers').select('*').in('id', ids),
    supabase.from('server_members').select('server_id').in('server_id', ids),
    fetchChannels(ids),
    fetchRoles(ids),
  ]);
  if (serverResult.error) fail(serverResult.error, 'Falha ao carregar servidores.');
  if (memberResult.error) fail(memberResult.error, 'Falha ao contar membros.');

  const counts = new Map<string, number>();
  for (const row of memberResult.data ?? []) {
    counts.set(row.server_id, (counts.get(row.server_id) ?? 0) + 1);
  }

  const order = new Map(ids.map((id, index) => [id, index]));
  return (serverResult.data ?? [])
    .map((row: Row): ServerSummary => ({
      id: row.id,
      name: row.name,
      iconUrl: row.icon_url ?? null,
      description: row.description ?? null,
      ownerId: row.owner_id,
      memberCount: counts.get(row.id) ?? 0,
      channels: channels.filter((channel) => channel.serverId === row.id),
      roles: roles.filter((role) => role.serverId === row.id),
      createdAt: row.created_at,
    }))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

async function getServer(serverId: string): Promise<ServerSummary> {
  const server = (await getServers()).find((item) => item.id === serverId);
  if (!server) throw new ApiError('Servidor não encontrado.', 404);
  return server;
}

async function getMembers(serverId: string): Promise<ServerMemberSummary[]> {
  const { data: memberRows, error: memberError } = await supabase
    .from('server_members')
    .select('*')
    .eq('server_id', serverId)
    .order('joined_at', { ascending: true });
  if (memberError) fail(memberError, 'Falha ao carregar membros.');
  const members = memberRows ?? [];
  if (members.length === 0) return [];

  const userIds = members.map((row: Row) => row.user_id);
  const memberIds = members.map((row: Row) => row.id);
  const [profileResult, memberRoleResult, roles] = await Promise.all([
    supabase.from('profiles').select('*').in('id', userIds),
    supabase.from('member_roles').select('*').in('member_id', memberIds),
    fetchRoles([serverId]),
  ]);
  if (profileResult.error) fail(profileResult.error, 'Falha ao carregar perfis.');
  if (memberRoleResult.error) fail(memberRoleResult.error, 'Falha ao carregar cargos dos membros.');

  const profileMap = new Map((profileResult.data ?? []).map((row: Row) => [row.id, row]));
  const roleMap = new Map(roles.map((role) => [role.id, role]));
  return members.flatMap((row: Row) => {
    const profile = profileMap.get(row.user_id);
    if (!profile) return [];
    const assigned = (memberRoleResult.data ?? [])
      .filter((item: Row) => item.member_id === row.id)
      .map((item: Row) => roleMap.get(item.role_id))
      .filter((role): role is RoleSummary => Boolean(role));
    return [{
      id: row.id,
      serverId: row.server_id,
      userId: row.user_id,
      nickname: row.nickname ?? null,
      joinedAt: row.joined_at,
      user: profileToSummary(profile),
      roles: assigned,
    }];
  });
}

async function enrichMessages(rows: Row[]): Promise<MessageSummary[]> {
  if (rows.length === 0) return [];
  const replyIds = rows.map((row) => row.reply_to_id).filter(Boolean);
  const { data: replyRows, error: replyError } = replyIds.length
    ? await supabase.from('messages').select('*').in('id', replyIds)
    : { data: [] as Row[], error: null };
  if (replyError) fail(replyError, 'Falha ao carregar respostas.');

  const allRows = [...rows, ...(replyRows ?? [])];
  const authorIds = [...new Set(allRows.map((row) => row.author_id))];
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .in('id', authorIds);
  if (profileError) fail(profileError, 'Falha ao carregar autores.');

  const profileMap = new Map((profiles ?? []).map((row: Row) => [row.id, row]));
  const replyMap = new Map((replyRows ?? []).map((row: Row) => [row.id, row]));
  return rows.map((row): MessageSummary => {
    const authorRow = profileMap.get(row.author_id);
    const replyRow = row.reply_to_id ? replyMap.get(row.reply_to_id) : undefined;
    const replyAuthor = replyRow ? profileMap.get(replyRow.author_id) : undefined;
    const unknownAuthor: UserSummary = {
      id: row.author_id,
      username: 'usuario',
      displayName: 'Usuário',
      avatarUrl: null,
      status: 'OFFLINE',
    };
    return {
      id: row.id,
      channelId: row.channel_id,
      authorId: row.author_id,
      content: row.content,
      replyToId: row.reply_to_id ?? null,
      replyTo: replyRow ? {
        id: replyRow.id,
        content: replyRow.content,
        author: {
          id: replyRow.author_id,
          displayName: replyAuthor?.display_name ?? 'Usuário',
          username: replyAuthor?.username ?? 'usuario',
        },
      } : null,
      isEdited: row.is_edited,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      author: authorRow ? profileToSummary(authorRow) : unknownAuthor,
    };
  });
}

async function getMessages(channelId: string, cursor?: string): Promise<MessageSummary[]> {
  let query = supabase
    .from('messages')
    .select('*')
    .eq('channel_id', channelId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(50);

  if (cursor) {
    const { data: cursorRow, error } = await supabase
      .from('messages')
      .select('created_at')
      .eq('id', cursor)
      .eq('channel_id', channelId)
      .single();
    if (error || !cursorRow) fail(error, 'Cursor de mensagens inválido.');
    query = query.lt('created_at', cursorRow.created_at);
  }

  const { data, error } = await query;
  if (error) fail(error, 'Falha ao carregar mensagens.');
  return (await enrichMessages(data ?? [])).reverse();
}

export async function getMessageById(messageId: string): Promise<MessageSummary | null> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('id', messageId)
    .maybeSingle();
  if (error) fail(error, 'Falha ao carregar mensagem.');
  if (!data) return null;
  return (await enrichMessages([data]))[0] ?? null;
}

async function register(dto: RegisterDTO): Promise<RegisterResult> {
  const username = dto.username.trim().toLowerCase();
  const { data: isAvailable, error: availabilityError } = await supabase.rpc(
    'is_username_available',
    { p_username: username },
  );
  if (availabilityError) fail(availabilityError, 'Falha ao verificar o nome de usuário.');
  if (!isAvailable) throw new ApiError('Este nome de usuário já está em uso ou é inválido.');

  const { data, error } = await supabase.auth.signUp({
    email: dto.email.trim().toLowerCase(),
    password: dto.password,
    options: {
      data: {
        username,
        display_name: dto.displayName.trim() || username,
      },
    },
  });
  if (error) fail(error, 'Falha ao criar conta.');

  const token = data.session?.access_token ?? null;
  writeLegacyAuthToken(token);
  const user = data.session ? await currentProfile() : null;
  return {
    user,
    token,
    requiresEmailConfirmation: !data.session,
    email: dto.email.trim().toLowerCase(),
  };
}

async function login(dto: LoginDTO): Promise<{ user: UserProfile; token: string }> {
  const email = dto.emailOrUsername.trim().toLowerCase();
  if (!email.includes('@')) {
    throw new ApiError('Use seu e-mail para entrar. O login por @usuário será adicionado depois.');
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: dto.password });
  if (error || !data.session) fail(error, 'Falha ao entrar.');
  writeLegacyAuthToken(data.session.access_token);
  return { user: await currentProfile(), token: data.session.access_token };
}

async function updateProfile(dto: UpdateProfileDTO): Promise<UserProfile> {
  const user = await currentAuthUser();
  const payload: JsonObject = {};
  if (dto.displayName !== undefined) payload.display_name = dto.displayName;
  if (dto.bio !== undefined) payload.bio = dto.bio || null;
  if (dto.avatarUrl !== undefined) payload.avatar_url = dto.avatarUrl || null;
  if (dto.status !== undefined) payload.status = dto.status;
  if (dto.customStatus !== undefined) payload.custom_status = dto.customStatus || null;
  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', user.id)
    .select('*')
    .single();
  if (error || !data) fail(error, 'Falha ao atualizar perfil.');
  return profileToUser(data, user.email ?? '');
}

async function createServer(dto: CreateServerDTO): Promise<ServerSummary> {
  const user = await currentAuthUser();
  const { data, error } = await supabase
    .from('servers')
    .insert({
      name: dto.name,
      description: dto.description || null,
      icon_url: dto.iconUrl || null,
      owner_id: user.id,
    })
    .select('id')
    .single();
  if (error || !data) fail(error, 'Falha ao criar servidor.');
  return getServer(data.id);
}

async function updateServer(serverId: string, dto: UpdateServerDTO): Promise<ServerSummary> {
  const payload: JsonObject = {};
  if (dto.name !== undefined) payload.name = dto.name;
  if (dto.description !== undefined) payload.description = dto.description || null;
  if (dto.iconUrl !== undefined) payload.icon_url = dto.iconUrl || null;
  const { error } = await supabase.from('servers').update(payload).eq('id', serverId);
  if (error) fail(error, 'Falha ao atualizar servidor.');
  return getServer(serverId);
}

async function createChannel(serverId: string, dto: CreateChannelDTO): Promise<ChannelSummary> {
  const { data, error } = await supabase
    .from('channels')
    .insert({
      server_id: serverId,
      name: dto.name,
      type: dto.type,
      topic: dto.topic || null,
      position: dto.position ?? 0,
      is_private: dto.isPrivate ?? false,
    })
    .select('*')
    .single();
  if (error || !data) fail(error, 'Falha ao criar canal.');
  return channelFromRow(data);
}

async function updateChannel(channelId: string, dto: UpdateChannelDTO): Promise<ChannelSummary> {
  const payload: JsonObject = {};
  if (dto.name !== undefined) payload.name = dto.name;
  if (dto.topic !== undefined) payload.topic = dto.topic || null;
  if (dto.position !== undefined) payload.position = dto.position;
  if (dto.isPrivate !== undefined) payload.is_private = dto.isPrivate;
  const { data, error } = await supabase
    .from('channels')
    .update(payload)
    .eq('id', channelId)
    .select('*')
    .single();
  if (error || !data) fail(error, 'Falha ao atualizar canal.');
  return channelFromRow(data);
}

async function createMessage(channelId: string, dto: CreateMessageDTO): Promise<MessageSummary> {
  const user = await currentAuthUser();
  const { data, error } = await supabase
    .from('messages')
    .insert({
      channel_id: channelId,
      author_id: user.id,
      content: dto.content,
      reply_to_id: dto.replyToId || null,
    })
    .select('*')
    .single();
  if (error || !data) fail(error, 'Falha ao enviar mensagem.');
  return (await enrichMessages([data]))[0];
}

async function updateMessage(messageId: string, dto: UpdateMessageDTO): Promise<MessageSummary> {
  const { data, error } = await supabase
    .from('messages')
    .update({ content: dto.content })
    .eq('id', messageId)
    .select('*')
    .single();
  if (error || !data) fail(error, 'Falha ao editar mensagem.');
  return (await enrichMessages([data]))[0];
}

async function createRole(serverId: string, dto: CreateRoleDTO): Promise<RoleSummary> {
  const { data, error } = await supabase
    .from('roles')
    .insert({
      server_id: serverId,
      name: dto.name,
      color: dto.color ?? '#6C63FF',
      position: dto.position ?? 1,
      permissions: dto.permissions ?? '0',
    })
    .select('*')
    .single();
  if (error || !data) fail(error, 'Falha ao criar cargo.');
  return roleFromRow(data);
}

async function updateRole(roleId: string, dto: UpdateRoleDTO): Promise<RoleSummary> {
  const payload: JsonObject = {};
  if (dto.name !== undefined) payload.name = dto.name;
  if (dto.color !== undefined) payload.color = dto.color;
  if (dto.position !== undefined) payload.position = dto.position;
  if (dto.permissions !== undefined) payload.permissions = dto.permissions;
  const { data, error } = await supabase
    .from('roles')
    .update(payload)
    .eq('id', roleId)
    .select('*')
    .single();
  if (error || !data) fail(error, 'Falha ao atualizar cargo.');
  return roleFromRow(data);
}

async function createInvite(serverId: string, dto: CreateInviteDTO): Promise<InviteSummary> {
  const user = await currentAuthUser();
  const expiresAt = dto.expiresInHours && dto.expiresInHours > 0
    ? new Date(Date.now() + dto.expiresInHours * 60 * 60 * 1000).toISOString()
    : null;
  const { data, error } = await supabase
    .from('invites')
    .insert({
      server_id: serverId,
      creator_id: user.id,
      max_uses: dto.maxUses ?? 0,
      expires_at: expiresAt,
    })
    .select('*')
    .single();
  if (error || !data) fail(error, 'Falha ao criar convite.');
  return inviteFromRow(data);
}

async function routeGet(path: string): Promise<unknown> {
  const url = new URL(path, 'https://gdisc.local');
  const pathname = url.pathname;
  if (pathname === '/auth/me') return { user: await currentProfile() };
  if (pathname === '/servers') return { servers: await getServers() };

  let match = pathname.match(/^\/servers\/([^/]+)$/);
  if (match) return { server: await getServer(match[1]) };
  match = pathname.match(/^\/servers\/([^/]+)\/channels$/);
  if (match) return { channels: await fetchChannels([match[1]]) };
  match = pathname.match(/^\/servers\/([^/]+)\/members$/);
  if (match) return { members: await getMembers(match[1]) };
  match = pathname.match(/^\/servers\/([^/]+)\/roles$/);
  if (match) return { roles: await fetchRoles([match[1]]) };
  match = pathname.match(/^\/channels\/([^/]+)\/messages$/);
  if (match) return { messages: await getMessages(match[1], url.searchParams.get('cursor') ?? undefined) };
  throw new ApiError(`Rota de leitura desconhecida: ${pathname}`, 404);
}

async function routePost(path: string, body: unknown): Promise<unknown> {
  const pathname = new URL(path, 'https://gdisc.local').pathname;
  if (pathname === '/auth/register') return register(body as RegisterDTO);
  if (pathname === '/auth/login') return login(body as LoginDTO);
  if (pathname === '/servers') return { server: await createServer(body as CreateServerDTO) };

  let match = pathname.match(/^\/servers\/([^/]+)\/leave$/);
  if (match) {
    const { data, error } = await supabase.rpc('leave_server', { p_server_id: match[1] });
    if (error) fail(error, 'Falha ao sair do servidor.');
    return { success: Boolean(data) };
  }
  match = pathname.match(/^\/servers\/([^/]+)\/channels$/);
  if (match) return { channel: await createChannel(match[1], body as CreateChannelDTO) };
  match = pathname.match(/^\/servers\/([^/]+)\/roles$/);
  if (match) return { role: await createRole(match[1], body as CreateRoleDTO) };
  match = pathname.match(/^\/servers\/([^/]+)\/invites$/);
  if (match) return { invite: await createInvite(match[1], body as CreateInviteDTO) };
  match = pathname.match(/^\/channels\/([^/]+)\/messages$/);
  if (match) return { message: await createMessage(match[1], body as CreateMessageDTO) };
  match = pathname.match(/^\/invites\/([^/]+)\/join$/);
  if (match) {
    const { data, error } = await supabase.rpc('join_server_by_invite', { p_code: decodeURIComponent(match[1]) });
    if (error) fail(error, 'Convite inválido ou expirado.');
    const result = Array.isArray(data) ? data[0] : data;
    return { success: true, serverId: result?.server_id };
  }
  throw new ApiError(`Rota de criação desconhecida: ${pathname}`, 404);
}

async function routePatch(path: string, body: unknown): Promise<unknown> {
  const pathname = new URL(path, 'https://gdisc.local').pathname;
  if (pathname === '/users/me') return { user: await updateProfile(body as UpdateProfileDTO) };

  let match = pathname.match(/^\/servers\/([^/]+)$/);
  if (match) return { server: await updateServer(match[1], body as UpdateServerDTO) };
  match = pathname.match(/^\/servers\/[^/]+\/channels\/([^/]+)$/);
  if (match) return { channel: await updateChannel(match[1], body as UpdateChannelDTO) };
  match = pathname.match(/^\/servers\/[^/]+\/roles\/([^/]+)$/);
  if (match) return { role: await updateRole(match[1], body as UpdateRoleDTO) };
  match = pathname.match(/^\/messages\/([^/]+)$/);
  if (match) return { message: await updateMessage(match[1], body as UpdateMessageDTO) };
  throw new ApiError(`Rota de atualização desconhecida: ${pathname}`, 404);
}

async function routeDelete(path: string): Promise<unknown> {
  const pathname = new URL(path, 'https://gdisc.local').pathname;
  let match = pathname.match(/^\/servers\/([^/]+)$/);
  if (match) {
    const { error } = await supabase.from('servers').delete().eq('id', match[1]);
    if (error) fail(error, 'Falha ao excluir servidor.');
    return { success: true };
  }
  match = pathname.match(/^\/servers\/([^/]+)\/members\/([^/]+)$/);
  if (match) {
    const [, serverId, memberId] = match;
    const { data: member, error: memberError } = await supabase
      .from('server_members')
      .select('id, server_id, user_id')
      .eq('id', memberId)
      .eq('server_id', serverId)
      .single();
    if (memberError || !member) fail(memberError, 'Membro não encontrado.');

    const { data: server, error: serverError } = await supabase
      .from('servers')
      .select('owner_id')
      .eq('id', serverId)
      .single();
    if (serverError || !server) fail(serverError, 'Servidor não encontrado.');
    if (member.user_id === server.owner_id) {
      throw new ApiError('O proprietário do servidor não pode ser expulso.', 403);
    }

    const { data: deleted, error } = await supabase
      .from('server_members')
      .delete()
      .eq('id', memberId)
      .eq('server_id', serverId)
      .select('user_id')
      .maybeSingle();
    if (error) fail(error, 'Falha ao expulsar o membro.');
    if (!deleted) throw new ApiError('Você não tem permissão para expulsar este membro.', 403);
    return { success: true, userId: deleted.user_id as string };
  }
  match = pathname.match(/^\/servers\/[^/]+\/channels\/([^/]+)$/);
  if (match) {
    const { error } = await supabase.from('channels').delete().eq('id', match[1]);
    if (error) fail(error, 'Falha ao excluir canal.');
    return { success: true };
  }
  match = pathname.match(/^\/servers\/[^/]+\/roles\/([^/]+)$/);
  if (match) {
    const { error } = await supabase.from('roles').delete().eq('id', match[1]);
    if (error) fail(error, 'Falha ao excluir cargo.');
    return { success: true };
  }
  match = pathname.match(/^\/messages\/([^/]+)$/);
  if (match) {
    const { data: existing, error: readError } = await supabase
      .from('messages')
      .select('channel_id')
      .eq('id', match[1])
      .single();
    if (readError || !existing) fail(readError, 'Mensagem não encontrada.');
    const { error } = await supabase.from('messages').delete().eq('id', match[1]);
    if (error) fail(error, 'Falha ao excluir mensagem.');
    return { success: true, channelId: existing.channel_id };
  }
  throw new ApiError(`Rota de exclusão desconhecida: ${pathname}`, 404);
}

export const api = {
  async get<T>(path: string): Promise<T> {
    return routeGet(path) as Promise<T>;
  },
  async post<T = unknown>(path: string, body: unknown = {}): Promise<T> {
    return routePost(path, body) as Promise<T>;
  },
  async patch<T>(path: string, body: unknown): Promise<T> {
    return routePatch(path, body) as Promise<T>;
  },
  async delete<T = unknown>(path: string): Promise<T> {
    return routeDelete(path) as Promise<T>;
  },
};
