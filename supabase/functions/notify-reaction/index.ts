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

// Le client n'envoie que date_id : tout le reste (auteur, titre, destinataire) est
// dérivé côté serveur à partir de données vérifiées, pour empêcher un utilisateur
// d'usurper un titre/texte de notification ou de cibler un destinataire arbitraire.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Non autorisé' })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) return json({ error: 'Non autorisé' })

  if (!(await checkRateLimit(supabase, `notify-reaction:${user.id}`, 30, 60))) {
    return json({ error: 'Trop de requêtes, réessaie dans une minute' })
  }

  const { date_id } = await req.json()
  if (!date_id) return json({ error: 'date_id manquant' })

  // Vérifie que l'utilisateur a bien réagi à ce date (empêche de déclencher une
  // notification pour un date auquel il n'a jamais réagi).
  const { data: reaction } = await supabase
    .from('date_reactions')
    .select('id')
    .eq('date_id', date_id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!reaction) return json({ error: 'Réaction introuvable' })

  const { data: date } = await supabase.from('dates').select('user_id, intitule, lieu').eq('id', date_id).single()
  if (!date || date.user_id === user.id) return json({ ok: true })

  const [{ data: profile }, { data: sender }] = await Promise.all([
    // select('*') : la colonne « langue » peut ne pas exister tant que la migration n'est pas passée (→ français)
    supabase.from('profiles').select('*').eq('id', date.user_id).single(),
    supabase.from('profiles').select('username').eq('id', user.id).single(),
  ])
  if (!profile?.expo_push_token) return json({ ok: true })

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: profile.expo_push_token,
      title: (profile as any).langue === 'en' ? '❤️ New like' : '❤️ Nouveau j\'aime',
      body: (profile as any).langue === 'en'
        ? `@${sender?.username ?? 'Someone'} liked "${date.intitule || date.lieu || 'your date'}"`
        : `@${sender?.username ?? 'Quelqu\'un'} a aimé "${date.intitule || date.lieu || 'ton date'}"`,
      sound: 'default',
    }),
  })

  return json({ ok: true })
})

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
}
