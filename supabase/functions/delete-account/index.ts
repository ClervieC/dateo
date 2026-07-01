import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Non autorisé' })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: userError } = await supabase.auth.getUser(token)
  if (userError || !user) return jsonResponse({ error: 'Utilisateur non trouvé' })

  // Supprimer les données utilisateur (dates cascade delete ratings/photos/comments)
  await supabase.from('date_reactions').delete().eq('user_id', user.id)
  await supabase.from('date_comments').delete().eq('user_id', user.id)
  await supabase.from('user_favorites').delete().eq('user_id', user.id)
  await supabase.from('friends').delete().or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
  await supabase.from('dates').delete().eq('user_id', user.id)
  await supabase.from('profiles').delete().eq('id', user.id)

  const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id)
  if (deleteError) return jsonResponse({ error: deleteError.message })

  return jsonResponse({ success: true })
})

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}
