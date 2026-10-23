import { supabase } from './supabase'

export type RatingKey = 'mood' | 'nourriture' | 'ambiance' | 'personne' | 'conversation' | 'prix' | 'envie_recommencer'

// Un critère peut ne pas être renseigné (null) : on ne l'enregistre pas plutôt que
// d'inventer une valeur par défaut qui fausserait les statistiques.
export type Ratings = Record<RatingKey, number | null>

export const EMPTY_RATINGS: Ratings = {
  mood: null, nourriture: null, ambiance: null, personne: null, conversation: null, prix: null, envie_recommencer: null,
}

const round4 = (v: number) => Math.round(v * 4) / 4

// Un date n'a qu'une ligne de ratings : on met à jour celle qui existe plutôt que
// d'en insérer une seconde (sinon l'écran de détail peut lire l'ancienne au hasard).
export async function saveRatings(dateId: string, ratings: Ratings) {
  // Toutes les colonnes sont envoyées, null compris : en base, prix, conversation et
  // envie_recommencer ont une valeur par défaut à 3. Une colonne omise serait donc
  // remplie à 3, ce qui recréerait une fausse note.
  const payload = {} as Record<RatingKey, number | null>
  for (const [key, value] of Object.entries(ratings) as [RatingKey, number | null][]) {
    payload[key] = value == null ? null : round4(value)
  }
  const hasAny = Object.values(payload).some((v) => v != null)

  const { data: existing } = await supabase.from('ratings').select('date_id').eq('date_id', dateId).limit(1)
  if (existing && existing.length > 0) {
    // Mise à jour même si tout est vide : un critère effacé doit l'être aussi en base
    return supabase.from('ratings').update(payload).eq('date_id', dateId)
  }
  if (!hasAny) return { error: null }
  return supabase.from('ratings').insert({ date_id: dateId, ...payload })
}
