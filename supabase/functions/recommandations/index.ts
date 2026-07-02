import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Doit rester identique à lib/categories.ts (CATEGORIES) : ce sont les mêmes catégories
// que celles utilisées pour noter un date, afin que les idées restent comparables aux dates.
const CATEGORY_KEYS = ['restaurant', 'cine', 'nature', 'culture', 'sport', 'balade', 'soiree', 'voyage', 'autre']
const CATEGORY_LIST_TEXT = 'restaurant, cine, nature, culture, sport, balade, soiree, voyage, autre'

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

    let body: { mode?: string; theme?: string; freeText?: string; ville?: string } = {}
    try { body = await req.json() } catch { /* pas de body = mode par défaut */ }
    const mode = body.mode === 'theme' || body.mode === 'free' ? body.mode : 'best'
    const ville = (body.ville ?? '').trim()

    const { data: existingIdeas } = await supabase
      .from('date_ideas')
      .select('titre')
    const existingTitles = (existingIdeas ?? []).map((i: any) => i.titre).join(', ')

    const villeContext = ville
      ? `\nVille de l'utilisateur (IMPORTANT) : ${ville}\nLes 3 idées doivent être réalisables à ${ville} ou dans sa région proche — pense à des lieux/activités plausibles dans cette ville plutôt que des idées génériques.\n`
      : ''

    let prompt = ''

    if (mode === 'theme') {
      const theme = (body.theme ?? '').trim()
      if (!theme || !CATEGORY_KEYS.includes(theme)) return jsonResponse({ error: 'Choisis un thème' })
      prompt = `Tu es un expert en idées de rendez-vous amoureux romantiques et originaux.
${villeContext}
Thème demandé (IMPORTANT, à respecter strictement pour les 3 idées) : ${theme}

Idées déjà dans le catalogue (à NE PAS répéter) :
${existingTitles || 'aucune'}

Génère exactement 3 idées de rendez-vous amoureux NOUVELLES et ORIGINALES qui appartiennent TOUTES au thème "${theme}" (pas d'autre thème). Chaque titre doit être court (3-5 mots max).

Réponds UNIQUEMENT avec ce JSON, sans texte avant ou après :
{"recommendations": [{"titre": "Nom court", "raison": "Pourquoi ça correspond au thème ${theme} (1 phrase)", "categorie": "${theme}"}]}`
    } else if (mode === 'free') {
      const freeText = (body.freeText ?? '').trim()
      if (!freeText) return jsonResponse({ error: 'Décris ton idée en quelques mots' })
      prompt = `Tu es un expert en idées de rendez-vous amoureux romantiques et originaux.
${villeContext}
Envie exprimée par l'utilisateur : "${freeText}"

Idées déjà dans le catalogue (à NE PAS répéter) :
${existingTitles || 'aucune'}

Génère exactement 3 idées de rendez-vous amoureux NOUVELLES et ORIGINALES qui correspondent à cette envie. Chaque titre doit être court (3-5 mots max).

Réponds UNIQUEMENT avec ce JSON, sans texte avant ou après :
{"recommendations": [{"titre": "Nom court", "raison": "Pourquoi ça correspond à l'envie exprimée (1 phrase)", "categorie": "une parmi : ${CATEGORY_LIST_TEXT}"}]}`
    } else {
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

      const datesContext = topDates
        .map((d: any) => `- ${d.lieu} (${d.note_globale}/20)${d.commentaire ? ` — "${d.commentaire}"` : ''}`)
        .join('\n')

      prompt = `Tu es un expert en idées de rendez-vous amoureux romantiques et originaux.
${villeContext}
Les dates que cet utilisateur a préféré :
${datesContext}

Idées déjà dans le catalogue (à NE PAS répéter) :
${existingTitles || 'aucune'}

Génère exactement 3 idées de rendez-vous amoureux NOUVELLES et ORIGINALES adaptées aux goûts de cet utilisateur. Chaque titre doit être court (3-5 mots max).

Réponds UNIQUEMENT avec ce JSON, sans texte avant ou après :
{"recommendations": [{"titre": "Nom court", "raison": "Pourquoi ça lui correspond (1 phrase)", "categorie": "une parmi : ${CATEGORY_LIST_TEXT}"}]}`
    }

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

    let recs = Array.isArray(parsed) ? parsed : (parsed.recommendations ?? [])

    // Le modèle ne respecte pas toujours la catégorie demandée : on la force nous-mêmes
    // plutôt que de faire confiance au LLM, puisqu'on la connaît déjà avec certitude.
    if (mode === 'theme') {
      const theme = (body.theme ?? '').trim()
      recs = recs.map((r: any) => ({ ...r, categorie: theme }))
    } else {
      // Pour les autres modes, le LLM choisit lui-même la catégorie : on vérifie qu'elle
      // fait bien partie de la liste unique de l'app, sinon on la range dans "autre"
      // plutôt que d'afficher une catégorie invalide/inventée.
      recs = recs.map((r: any) => ({
        ...r,
        categorie: CATEGORY_KEYS.includes(r.categorie) ? r.categorie : 'autre',
      }))
    }

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
