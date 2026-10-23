import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { usernameValide } from './friendsUtils'
import { t } from './i18n'

export type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

// Vérifie la disponibilité du pseudo pendant la saisie (debounce), pour ne pas
// découvrir qu'il est pris seulement après avoir rempli tout le formulaire.
export function useUsernameCheck(username: string, currentUsername?: string | null) {
  const [status, setStatus] = useState<UsernameStatus>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const trimmed = username.trim()
    if (!trimmed) { setStatus('idle'); setMessage(''); return }
    const validation = usernameValide(trimmed)
    if (!validation.valide) { setStatus('invalid'); setMessage(validation.message ?? t("Pseudo invalide")); return }
    if (currentUsername && trimmed.toLowerCase() === currentUsername.toLowerCase()) {
      setStatus('idle'); setMessage(''); return
    }

    setStatus('checking')
    setMessage('')
    let cancelled = false
    const timer = setTimeout(async () => {
      // « _ » est un joker en LIKE : on l'échappe pour une comparaison exacte (insensible à la casse)
      const { data } = await supabase.from('profiles').select('id').ilike('username', trimmed.replace(/_/g, '\\_')).limit(1)
      if (cancelled) return
      if (data && data.length > 0) { setStatus('taken'); setMessage(t("Ce pseudo est déjà pris")) }
      else { setStatus('available'); setMessage(t("Pseudo disponible")) }
    }, 400)

    return () => { cancelled = true; clearTimeout(timer) }
  }, [username, currentUsername])

  return { status, message }
}
