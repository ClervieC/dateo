import { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type ProfileState = { username: string | null; termsAccepted: boolean }

// Lit l'état du profil nécessaire au routage. Si l'inscription a eu lieu avec
// confirmation d'email (pas de session au moment du signUp), le pseudo, la date de
// naissance et l'acceptation des CGU ont été stockés dans user_metadata : on les
// recopie dans profiles à la première connexion pour ne rien redemander.
export async function loadProfileState(user: User): Promise<ProfileState | null> {
  const { data } = await supabase
    .from('profiles')
    .select('username, date_naissance, terms_accepted_at')
    .eq('id', user.id)
    .maybeSingle()
  if (!data) return null

  const meta = (user.user_metadata ?? {}) as { username?: string; date_naissance?: string; terms_accepted_at?: string }
  const patch: Record<string, string> = {}
  if (!data.username && meta.username) patch.username = meta.username
  if (!data.date_naissance && meta.date_naissance) patch.date_naissance = meta.date_naissance
  if (!data.terms_accepted_at && meta.terms_accepted_at) patch.terms_accepted_at = meta.terms_accepted_at

  let state: ProfileState = { username: data.username, termsAccepted: !!data.terms_accepted_at }
  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)
    if (!error) {
      state = {
        username: patch.username ?? data.username,
        termsAccepted: !!(patch.terms_accepted_at ?? data.terms_accepted_at),
      }
    } else if (patch.terms_accepted_at) {
      // Pseudo pris entre-temps (contrainte unique) : on enregistre au moins le reste,
      // l'écran « Choisis ton pseudo » prendra le relais.
      const { username: _u, ...rest } = patch
      if (Object.keys(rest).length > 0) {
        const { error: restError } = await supabase.from('profiles').update(rest).eq('id', user.id)
        if (!restError) state = { username: data.username, termsAccepted: true }
      }
    }
  }
  return state
}
