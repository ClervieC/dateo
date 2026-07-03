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

// Le client n'envoie que comment_id : le commentaire est relu depuis la base pour
// vérifier que l'appelant en est bien l'auteur, et tous les destinataires (propriétaire
// du date, auteur du commentaire parent, personnes mentionnées) ainsi que le texte des
// notifications sont dérivés côté serveur — un utilisateur ne peut donc pas usurper un
// titre/texte de notification ni cibler un destinataire arbitraire.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Non autorisé' })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) return json({ error: 'Non autorisé' })

  if (!(await checkRateLimit(supabase, `notify-comment:${user.id}`, 30, 60))) {
    return json({ error: 'Trop de requêtes, réessaie dans une minute' })
  }

  const { comment_id } = await req.json()
  if (!comment_id) return json({ error: 'comment_id manquant' })

  const { data: comment } = await supabase
    .from('date_comments')
    .select('id, date_id, user_id, content, parent_id')
    .eq('id', comment_id)
    .single()
  if (!comment || comment.user_id !== user.id) return json({ error: 'Commentaire introuvable' })

  const { data: date } = await supabase.from('dates').select('user_id, intitule, lieu').eq('id', comment.date_id).single()
  if (!date) return json({ error: 'Date introuvable' })

  const { data: sender } = await supabase.from('profiles').select('username').eq('id', user.id).single()
  const senderUsername = sender?.username ?? 'Quelqu\'un'
  const dateLabel = date.intitule || date.lieu || 'ton date'
  const preview = (comment.content as string).slice(0, 80)

  const targets = new Map<string, 'comment' | 'reply' | 'mention'>()

  if (date.user_id !== user.id) targets.set(date.user_id, 'comment')

  if (comment.parent_id) {
    const { data: parent } = await supabase.from('date_comments').select('user_id, date_id').eq('id', comment.parent_id).single()
    if (parent && parent.date_id === comment.date_id && parent.user_id !== user.id) {
      targets.set(parent.user_id, 'reply')
    }
  }

  const mentionedUsernames = [...new Set([...(comment.content as string).matchAll(/@(\w{1,30})/g)].map((m) => m[1]))]
  if (mentionedUsernames.length > 0) {
    const { data: mentioned } = await supabase.from('profiles').select('id, username').in('username', mentionedUsernames)
    for (const p of mentioned ?? []) {
      if (p.id !== user.id && !targets.has(p.id)) targets.set(p.id, 'mention')
    }
  }

  if (targets.size === 0) return json({ ok: true })

  const { data: profiles } = await supabase.from('profiles').select('id, expo_push_token').in('id', [...targets.keys()])

  for (const p of profiles ?? []) {
    if (!p.expo_push_token) continue
    const type = targets.get(p.id)!
    const title = type === 'mention'
      ? `📣 @${senderUsername} t'a mentionné`
      : type === 'reply'
      ? `↩️ @${senderUsername} a répondu à ton commentaire`
      : `💬 @${senderUsername} a commenté`
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: p.expo_push_token,
        title,
        body: preview || `Sur "${dateLabel}"`,
        sound: 'default',
      }),
    })
  }

  return json({ ok: true })
})

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
}
