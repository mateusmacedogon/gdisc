import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SMOKE_EMAIL, SMOKE_PASSWORD, SMOKE_MODE } = process.env;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !SMOKE_EMAIL || !SMOKE_PASSWORD) {
  throw new Error('Defina SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SMOKE_EMAIL e SMOKE_PASSWORD.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

function assertResult(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

if (SMOKE_MODE === 'signup') {
  const data = assertResult(await supabase.auth.signUp({
    email: SMOKE_EMAIL,
    password: SMOKE_PASSWORD,
    options: {
      data: { username: `smoke_${Date.now()}`, display_name: 'GDisC Smoke Test' },
    },
  }), 'cadastro');
  console.log(JSON.stringify({
    event: 'signup_ok',
    userId: data.user?.id,
    hasSession: Boolean(data.session),
    email: SMOKE_EMAIL,
  }));
} else {
  let serverId;
  try {
  const auth = assertResult(
    await supabase.auth.signInWithPassword({ email: SMOKE_EMAIL, password: SMOKE_PASSWORD }),
    'login',
  );
  if (!auth.session || !auth.user) throw new Error('login: sessão não criada');

  const profile = assertResult(
    await supabase.from('profiles').select('*').eq('id', auth.user.id).single(),
    'perfil',
  );
  if (!profile.username) throw new Error('perfil: trigger não criou username');

  const server = assertResult(
    await supabase
      .from('servers')
      .insert({ name: 'Servidor Smoke Test', owner_id: auth.user.id })
      .select('id')
      .single(),
    'servidor',
  );
  serverId = server.id;

  const channels = assertResult(
    await supabase.from('channels').select('*').eq('server_id', serverId).order('position'),
    'canais iniciais',
  );
  const roles = assertResult(
    await supabase.from('roles').select('*').eq('server_id', serverId),
    'cargo inicial',
  );
  const members = assertResult(
    await supabase.from('server_members').select('*').eq('server_id', serverId),
    'membro inicial',
  );
  if (channels.length !== 2 || roles.length !== 1 || members.length !== 1) {
    throw new Error('bootstrap: quantidade inesperada de canais, cargos ou membros');
  }

  const textChannel = channels.find((channel) => channel.type === 'TEXT');
  const message = assertResult(
    await supabase
      .from('messages')
      .insert({ channel_id: textChannel.id, author_id: auth.user.id, content: 'Mensagem smoke' })
      .select('*')
      .single(),
    'mensagem',
  );
  const edited = assertResult(
    await supabase
      .from('messages')
      .update({ content: 'Mensagem smoke editada' })
      .eq('id', message.id)
      .select('*')
      .single(),
    'editar mensagem',
  );
  if (!edited.is_edited) throw new Error('mensagem: trigger não marcou edição');

  const invite = assertResult(
    await supabase
      .from('invites')
      .insert({ server_id: serverId, creator_id: auth.user.id, max_uses: 2 })
      .select('*')
      .single(),
    'convite',
  );
  if (!invite.code) throw new Error('convite: código não gerado');

  console.log(JSON.stringify({
    event: 'flow_ok',
    profile: profile.username,
    serverId,
    channels: channels.length,
    roles: roles.length,
    members: members.length,
    messageEdited: edited.is_edited,
    inviteCreated: Boolean(invite.code),
  }));
  } finally {
    if (serverId) await supabase.from('servers').delete().eq('id', serverId);
    await supabase.auth.signOut();
  }
}
