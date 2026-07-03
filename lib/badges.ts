export type DateEntry = {
  date_du_date: string
  note_globale: number
  lieu: string
  conseil_vivement: boolean
}

export type Badge = {
  id: string
  emoji: string
  label: string
  desc: string
  unlocked: boolean
  current?: number
  target?: number
  unlockedAt?: string | null
}

export type ComputeBadgesInput = {
  vecuDates: DateEntry[] // dates vécus, triés par date_du_date croissante
  commentDates: string[] // created_at des commentaires laissés, triés croissant
  planifieDates: string[] // date_du_date des dates planifiés, triés croissant
  hasCouple: boolean
  monthStreak: number
}

function dateAtCount(items: string[], n: number): string | null {
  return items.length >= n ? items[n - 1] : null
}

function dateAtDistinctLieuxCount(dates: DateEntry[], n: number): string | null {
  const seen = new Set<string>()
  for (const d of dates) {
    seen.add(d.lieu.toLowerCase())
    if (seen.size >= n) return d.date_du_date
  }
  return null
}

function dateAtNoteThreshold(dates: DateEntry[], minNote: number): string | null {
  const found = dates.find((d) => d.note_globale >= minNote)
  return found ? found.date_du_date : null
}

export function computeBadges(input: ComputeBadgesInput): Badge[] {
  const { vecuDates, commentDates, planifieDates, hasCouple, monthStreak } = input
  const count = vecuDates.length
  const maxNote = vecuDates.reduce((m, d) => Math.max(m, d.note_globale), 0)
  const distinctLieux = new Set(vecuDates.map((d) => d.lieu.toLowerCase())).size
  const conseilDates = vecuDates.filter((d) => d.conseil_vivement).map((d) => d.date_du_date)
  const dateStrings = vecuDates.map((d) => d.date_du_date)

  return [
    { id: 'first', emoji: '🌹', label: 'Premier Date', desc: 'Enregistre ton premier date', unlocked: count >= 1, current: count, target: 1, unlockedAt: dateAtCount(dateStrings, 1) },
    { id: 'ten', emoji: '🔥', label: 'Enflammé', desc: '10 dates vécus', unlocked: count >= 10, current: count, target: 10, unlockedAt: dateAtCount(dateStrings, 10) },
    { id: 'twenty', emoji: '💫', label: 'Romantique', desc: '20 dates vécus', unlocked: count >= 20, current: count, target: 20, unlockedAt: dateAtCount(dateStrings, 20) },
    { id: 'fifty', emoji: '👑', label: 'Expert des dates', desc: '50 dates vécus', unlocked: count >= 50, current: count, target: 50, unlockedAt: dateAtCount(dateStrings, 50) },
    { id: 'excellent', emoji: '✨', label: 'Excellent', desc: 'Avoir un 18/20 ou plus', unlocked: maxNote >= 18, current: maxNote, target: 18, unlockedAt: dateAtNoteThreshold(vecuDates, 18) },
    { id: 'perfect', emoji: '⭐', label: 'Note parfaite', desc: 'Avoir un 20/20', unlocked: maxNote >= 20, current: maxNote, target: 20, unlockedAt: dateAtNoteThreshold(vecuDates, 20) },
    { id: 'explorer', emoji: '🗺️', label: 'Explorateur', desc: 'Visiter 5 lieux différents', unlocked: distinctLieux >= 5, current: distinctLieux, target: 5, unlockedAt: dateAtDistinctLieuxCount(vecuDates, 5) },
    { id: 'nomad', emoji: '🌍', label: 'Nomade', desc: 'Visiter 15 lieux différents', unlocked: distinctLieux >= 15, current: distinctLieux, target: 15, unlockedAt: dateAtDistinctLieuxCount(vecuDates, 15) },
    { id: 'conseil', emoji: '💖', label: 'Recommandeur', desc: 'Conseiller vivement 3 dates', unlocked: conseilDates.length >= 3, current: conseilDates.length, target: 3, unlockedAt: dateAtCount(conseilDates, 3) },
    { id: 'writer', emoji: '✍️', label: 'Commentateur', desc: 'Laisser 5 commentaires sur des dates', unlocked: commentDates.length >= 5, current: commentDates.length, target: 5, unlockedAt: dateAtCount(commentDates, 5) },
    { id: 'couple', emoji: '💑', label: 'Duo', desc: 'Lier son compte en mode couple', unlocked: hasCouple, unlockedAt: null },
    { id: 'streak3', emoji: '📅', label: 'Assidu', desc: 'Dates 3 mois consécutifs', unlocked: monthStreak >= 3, current: monthStreak, target: 3, unlockedAt: null },
    { id: 'streak6', emoji: '🗓️', label: 'Régulier', desc: 'Dates 6 mois consécutifs', unlocked: monthStreak >= 6, current: monthStreak, target: 6, unlockedAt: null },
    { id: 'planner', emoji: '📌', label: 'Planificateur', desc: 'Avoir 3 dates planifiés', unlocked: planifieDates.length >= 3, current: planifieDates.length, target: 3, unlockedAt: dateAtCount(planifieDates, 3) },
  ]
}
