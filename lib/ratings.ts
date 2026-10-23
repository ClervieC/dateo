import { supabase } from './supabase'

export type Ratings = {
  mood: number
  nourriture: number
  ambiance: number
  personne: number
  conversation: number
  prix: number
  envie_recommencer: number
}

const round4 = (v: number) => Math.round(v * 4) / 4

// Un date n'a qu'une ligne de ratings : on met à jour celle qui existe plutôt que
// d'en insérer une seconde (sinon l'écran de détail peut lire l'ancienne au hasard).
export async function saveRatings(dateId: string, ratings: Ratings) {
  const payload = {
    mood: round4(ratings.mood),
    nourriture: round4(ratings.nourriture),
    ambiance: round4(ratings.ambiance),
    personne: round4(ratings.personne),
    conversation: round4(ratings.conversation),
    prix: round4(ratings.prix),
    envie_recommencer: round4(ratings.envie_recommencer),
  }
  const { data: existing } = await supabase.from('ratings').select('date_id').eq('date_id', dateId).limit(1)
  if (existing && existing.length > 0) {
    return supabase.from('ratings').update(payload).eq('date_id', dateId)
  }
  return supabase.from('ratings').insert({ date_id: dateId, ...payload })
}
