import { t } from './i18n'

export const MIN_PASSWORD_LENGTH = 6
export const MIN_AGE = 16

export function emailValide(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
}

export function computeAge(birthdateIso: string, today = new Date()): number {
  const [y, m, d] = birthdateIso.split('-').map(Number)
  let age = today.getFullYear() - y
  const hasHadBirthdayThisYear = today.getMonth() + 1 > m || (today.getMonth() + 1 === m && today.getDate() >= d)
  if (!hasHadBirthdayThisYear) age--
  return age
}

// Supabase renvoie des messages en anglais : on les traduit pour ne pas afficher
// « Invalid login credentials » à un utilisateur francophone.
export function traduireErreurAuth(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return t("Email ou mot de passe incorrect")
  if (m.includes('email not confirmed')) return t("Ton email n'est pas encore confirmé. Clique sur le lien reçu par email.")
  if (m.includes('already registered') || m.includes('already been registered') || m.includes('user already exists')) {
    return t("Un compte existe déjà avec cet email. Connecte-toi plutôt.")
  }
  if (m.includes('password should be at least') || m.includes('weak password')) {
    return t("Le mot de passe doit faire au moins {n} caractères", { n: MIN_PASSWORD_LENGTH })
  }
  if (m.includes('unable to validate email') || m.includes('invalid email') || (m.includes('email address') && m.includes('invalid'))) {
    return t("Cette adresse email n'est pas valide")
  }
  if (m.includes('rate limit') || m.includes('too many requests') || m.includes('security purposes')) {
    return t("Trop de tentatives. Réessaie dans quelques minutes.")
  }
  if (m.includes('network') || m.includes('failed to fetch')) {
    return t("Connexion impossible. Vérifie ton réseau.")
  }
  if (m.includes('same password') || m.includes('different from the old')) {
    return t("Le nouveau mot de passe doit être différent de l'ancien")
  }
  return message
}
