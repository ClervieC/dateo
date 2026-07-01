import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')!
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

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Non autorisé' })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return jsonResponse({ error: 'Utilisateur non trouvé' })
    }

    const { data: topDates, error: datesError } = await supabase
      .from('dates')
      .select('lieu, note_globale, commentaire')
      .eq('user_id', user.id)
      .gte('note_globale', 12)
      .order('note_globale', { ascending: false })
      .limit(10)

    if (datesError) {
      return jsonResponse({ error: datesError.message })
    }

    if (!topDates || topDates.length === 0) {
      return jsonResponse({
        recommendations: [],
        message: 'Note quelques dates (12+/20) pour débloquer des recommandations personnalisées ✨',
      })
    }

    const { data: existingIdeas } = await supabase
      .from('date_ideas')
      .select('titre')

    const datesContext = topDates
      .map((d: any) => `- ${d.lieu} (${d.note_globale}/20)${d.commentaire ? ` — "${d.commentaire}"` : ''}`)
      .join('\n')

    const existingTitles = (existingIdeas ?? []).map((i: any) => i.titre).join(', ')

    const prompt = `Tu es un expert en idées de rendez-vous amoureux romantiques et originaux.

Les dates que cet utilisateur a préféré :
${datesContext}

Idées déjà dans le catalogue (à NE PAS répéter) :
${existingTitles || 'aucune'}

Génère exactement 3 idées de rendez-vous amoureux NOUVELLES et ORIGINALES adaptées aux goûts de cet utilisateur. Chaque titre doit être court (3-5 mots max).

Réponds UNIQUEMENT avec ce JSON, sans texte avant ou après :
{"recommendations": [{"titre": "Nom court", "raison": "Pourquoi ça lui correspond (1 phrase)", "categorie": "une parmi : Nature, Gastronomie, Culture, Aventure, Cocooning"}]}`

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9,
        max_tokens: 600,
      }),
    })

    const groqData = await groqResponse.json()

    if (!groqResponse.ok) {
      const errMsg = groqData?.error?.message ?? `Groq ${groqResponse.status}`
      return jsonResponse({ error: `Erreur IA : ${errMsg}` })
    }

    const textContent = groqData.choices?.[0]?.message?.content ?? ''
    if (!textContent) {
      return jsonResponse({ error: 'Réponse IA vide' })
    }

    const cleaned = textContent.replace(/```json\n?|```/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    const jsonStr = match ? match[0] : cleaned

    let parsed: any = null
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      return jsonResponse({ error: 'Réponse IA invalide', debug: textContent.slice(0, 200) })
    }

    const recs = Array.isArray(parsed) ? parsed : (parsed.recommendations ?? [])
    return jsonResponse({ recommendations: recs })
  } catch (err) {
    return jsonResponse({ error: String(err) })
  }
})

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
