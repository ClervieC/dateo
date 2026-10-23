import { t, getLang } from './i18n'

export type DateRow = {
  id: string
  lieu: string
  date_du_date: string
  note_globale: number
  commentaire: string | null
}

export function calculerMoyenne(dates: DateRow[]): string {
  if (dates.length === 0) return '—'
  const total = dates.reduce((sum, d) => sum + d.note_globale, 0)
  return (total / dates.length).toFixed(1)
}

export function trouverMeilleurLieu(dates: DateRow[]): string {
  if (dates.length === 0) return '—'
  return dates.reduce((best, d) => (d.note_globale > best.note_globale ? d : best)).lieu
}

export function validerFormulaireDate(lieu: string): { valide: boolean; message?: string } {
  if (!lieu.trim()) {
    return { valide: false, message: t("Indique le lieu du date") }
  }
  return { valide: true }
}

export function clamperNote(note: number, max: number): number {
  return Math.max(0, Math.min(max, Math.round(note)))
}

// Affiche une note issue d'un slider (step 0.25) sans artefacts flottants (ex: 3.2500000000000004)
// et sans zéros inutiles (3 au lieu de 3.00, 3.5 au lieu de 3.50).
export function formatNote(note: number): string {
  return Number(note).toFixed(2).replace(/\.?0+$/, '')
}

export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MOIS_COURTS = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.']
const MONTHS_SHORT_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Noms des mois dans la langue de l'app (long : « Janvier » / « January »)
export function nomsDesMois(format: 'long' | 'court' = 'long'): string[] {
  if (getLang() === 'en') return format === 'long' ? MONTHS_EN : MONTHS_SHORT_EN
  return format === 'long' ? MOIS.map((m) => m.charAt(0).toUpperCase() + m.slice(1)) : MOIS_COURTS
}

// Initiales des jours, semaine commençant le lundi
export function initialesJours(): string[] {
  return getLang() === 'en' ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['L', 'M', 'M', 'J', 'V', 'S', 'D']
}

// Jours de la semaine indexés comme Date.getDay() (0 = dimanche)
export function nomsDesJours(format: 'long' | 'court' = 'court'): string[] {
  if (getLang() === 'en') {
    return format === 'long'
      ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  }
  return format === 'long'
    ? ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
    : ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
}

// « il y a 5 min », « il y a 3 h », « hier », sinon la date complète
export function formaterIlYa(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (diff < 60) return t("à l'instant")
  if (diff < 3600) return t("il y a {n} min", { n: Math.floor(diff / 60) })
  if (diff < 86400) return t("il y a {n} h", { n: Math.floor(diff / 3600) })
  if (diff < 2 * 86400) return t("hier")
  if (diff < 7 * 86400) return t("il y a {n} jours", { n: Math.floor(diff / 86400) })
  const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return formaterDate(local)
}

export function formaterDate(dateIso: string): string {
  const parts = dateIso.split('-')
  if (parts.length !== 3) return dateIso
  const [yyyy, mm, dd] = parts
  const moisIdx = parseInt(mm) - 1
  if (moisIdx < 0 || moisIdx > 11) return dateIso
  if (getLang() === 'en') return `${MONTHS_EN[moisIdx]} ${parseInt(dd)}, ${yyyy}`
  return `${parseInt(dd)} ${MOIS[moisIdx]} ${yyyy}`
}