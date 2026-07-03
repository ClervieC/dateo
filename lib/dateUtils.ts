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
    return { valide: false, message: 'Indique le lieu du date' }
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

export function formaterDate(dateIso: string): string {
  const parts = dateIso.split('-')
  if (parts.length !== 3) return dateIso
  const [yyyy, mm, dd] = parts
  const moisIdx = parseInt(mm) - 1
  if (moisIdx < 0 || moisIdx > 11) return dateIso
  return `${parseInt(dd)} ${MOIS[moisIdx]} ${yyyy}`
}