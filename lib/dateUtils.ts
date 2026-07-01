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

export function todayFr(): string {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export function parseDateFr(input: string): string | null {
  const match = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null
  const [, dd, mm, yyyy] = match
  const date = new Date(`${yyyy}-${mm}-${dd}`)
  if (isNaN(date.getTime())) return null
  return `${yyyy}-${mm}-${dd}`
}

export function dateIsoToFr(dateIso: string): string {
  const parts = dateIso.split('-')
  if (parts.length !== 3) return dateIso
  return `${parts[2]}/${parts[1]}/${parts[0]}`
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