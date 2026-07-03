import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET')!
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret' }

// Réservé au cron planifié : exige le header x-cron-secret pour empêcher un tiers
// de déclencher l'envoi de push à tous les utilisateurs en appelant l'URL directement.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) return json({ error: 'Non autorisé' })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const today = new Date()
  const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())
  const dateStr = oneYearAgo.toISOString().slice(0, 10)

  const { data: dates } = await supabase
    .from('dates')
    .select('user_id, intitule, lieu')
    .eq('date_du_date', dateStr)
    .eq('statut', 'vecu')

  if (!dates || dates.length === 0) return json({ ok: true, sent: 0 })

  const userIds = [...new Set(dates.map((d: any) => d.user_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, expo_push_token')
    .in('id', userIds)

  const tokenMap: Record<string, string> = {}
  for (const p of profiles ?? []) {
    if (p.expo_push_token) tokenMap[p.id] = p.expo_push_token
  }

  let sent = 0
  for (const date of dates as any[]) {
    const token = tokenMap[date.user_id]
    if (!token) continue
    const lieu = date.intitule ?? date.lieu
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: token,
        title: '📅 Souvenir du jour',
        body: `Il y a un an : "${lieu}" — tu te souviens ?`,
        sound: 'default',
      }),
    })
    sent++
  }

  return json({ ok: true, sent })
})

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
}
