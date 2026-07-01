import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Non autorisé' })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) return json({ error: 'Non autorisé' })

  const { date_owner_id, commenter_username, date_intitule, comment_preview } = await req.json()
  if (user.id === date_owner_id) return json({ ok: true })

  const { data: profile } = await supabase.from('profiles').select('expo_push_token').eq('id', date_owner_id).single()
  if (!profile?.expo_push_token) return json({ ok: true })

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: profile.expo_push_token,
      title: `💬 @${commenter_username} a commenté`,
      body: comment_preview || `Sur "${date_intitule || 'ton date'}"`,
      sound: 'default',
    }),
  })

  return json({ ok: true })
})

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
}
