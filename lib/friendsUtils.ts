export type Profile = { id: string; username: string }

export function requeteValide(query: string): boolean {
  return query.trim().length >= 2
}

export function filtrerSesPropresResultats(results: Profile[], myId: string): Profile[] {
  return results.filter((r) => r.id !== myId)
}

export function retirerDeLaListe(results: Profile[], idARetirer: string): Profile[] {
  return results.filter((r) => r.id !== idARetirer)
}

export function formaterUsername(username: string): string {
  return `@${username.trim()}`
}

export function usernameValide(username: string): { valide: boolean; message?: string } {
  const trimmed = username.trim()
  if (!trimmed) {
    return { valide: false, message: 'Le pseudo ne peut pas être vide' }
  }
  if (trimmed.length < 3) {
    return { valide: false, message: 'Le pseudo doit faire au moins 3 caractères' }
  }
  if (!/^[a-zA-Z0-9_.]+$/.test(trimmed)) {
    return { valide: false, message: 'Le pseudo ne peut contenir que des lettres, chiffres, points et underscores' }
  }
  return { valide: true }
}