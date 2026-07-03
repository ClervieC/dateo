import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

// Rate limiting basique par fenêtre glissante, stocké dans la table rate_limits
// (accès service_role uniquement). Dupliqué dans chaque fonction (plutôt qu'importé
// depuis _shared/) car le déploiement via le dashboard Supabase ne bundle pas les
// fichiers en dehors du dossier de la fonction.
async function checkRateLimit(supabase: any, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data: row } = await supabase.from('rate_limits').select('count, window_start').eq('key', key).maybeSingle()
  const now = Date.now()
  const windowStart = row ? new Date(row.window_start).getTime() : 0
  const expired = !row || now - windowStart > windowSeconds * 1000
  if (expired) {
    await supabase.from('rate_limits').upsert({ key, count: 1, window_start: new Date().toISOString() })
    return true
  }
  if (row.count >= limit) return false
  await supabase.from('rate_limits').update({ count: row.count + 1 }).eq('key', key)
  return true
}

// Notifications pour les demandes d'ami et les invitations en mode couple.
// Le client ne fournit que recipient_id + type ; le serveur vérifie qu'une ligne
// friends/couples correspondante existe réellement avant d'envoyer quoi que ce soit,
// et lit le push token uniquement côté serveur (jamais exposé au client).
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Non autorisé' })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) return json({ error: 'Non autorisé' })

  if (!(await checkRateLimit(supabase, `notify-social:${user.id}`, 30, 60))) {
    return json({ error: 'Trop de requêtes, réessaie dans une minute' })
  }

  const { recipient_id, type } = await req.json()
  if (!recipient_id || !['friend_request', 'couple_invite', 'couple_accepted'].includes(type)) {
    return json({ error: 'Requête invalide' })
  }
  if (recipient_id === user.id) return json({ ok: true })

  let authorized = false
  if (type === 'friend_request') {
    const { data } = await supabase.from('friends').select('id')
      .eq('user_id', user.id).eq('friend_id', recipient_id).maybeSingle()
    authorized = !!data
  } else {
    const { data } = await supabase.from('couples').select('id')
      .or(`and(user1_id.eq.${user.id},user2_id.eq.${recipient_id}),and(user1_id.eq.${recipient_id},user2_id.eq.${user.id})`)
      .maybeSingle()
    authorized = !!data
  }
  if (!authorized) return json({ error: 'Relation introuvable' })

  const [{ data: sender }, { data: recipient }] = await Promise.all([
    supabase.from('profiles').select('username').eq('id', user.id).single(),
    supabase.from('profiles').select('expo_push_token').eq('id', recipient_id).single(),
  ])
  if (!recipient?.expo_push_token) return json({ ok: true })

  const senderUsername = sender?.username ?? 'Quelqu\'un'
  const { title, body } = type === 'friend_request'
    ? { title: '💌 Nouvelle demande d\'ami', body: `${senderUsername} veut être ton ami sur Dateo` }
    : type === 'couple_invite'
    ? { title: '💑 Invitation en mode couple', body: `${senderUsername} veut lier son compte au tien sur Dateo` }
    : { title: '💑 Invitation acceptée', body: `${senderUsername} a accepté ton invitation en mode couple` }

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: recipient.expo_push_token,
      title,
      body,
      data: { screen: type === 'friend_request' ? 'friends' : 'couple' },
      sound: 'default',
    }),
  })

  return json({ ok: true })
})

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
}
