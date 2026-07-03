import { computeBadges, DateEntry } from './badges'

const faireDate = (overrides: Partial<DateEntry>): DateEntry => ({
  date_du_date: '2026-01-01',
  note_globale: 10,
  lieu: 'Café A',
  conseil_vivement: false,
  ...overrides,
})

const baseInput = {
  vecuDates: [] as DateEntry[],
  commentDates: [] as string[],
  planifieDates: [] as string[],
  hasCouple: false,
  monthStreak: 0,
}

function findBadge(badges: ReturnType<typeof computeBadges>, id: string) {
  const badge = badges.find((b) => b.id === id)
  if (!badge) throw new Error(`Badge ${id} introuvable`)
  return badge
}

describe('computeBadges', () => {
  it('ne débloque aucun badge sans données', () => {
    const badges = computeBadges(baseInput)
    expect(badges.every((b) => !b.unlocked)).toBe(true)
  })

  it('débloque "Premier Date" dès le premier date vécu, avec sa date d\'obtention', () => {
    const badges = computeBadges({
      ...baseInput,
      vecuDates: [faireDate({ date_du_date: '2026-03-10' })],
    })
    const badge = findBadge(badges, 'first')
    expect(badge.unlocked).toBe(true)
    expect(badge.unlockedAt).toBe('2026-03-10')
  })

  it('débloque "Enflammé" au 10e date et retient la date du 10e, pas la dernière', () => {
    const vecuDates = Array.from({ length: 12 }, (_, i) =>
      faireDate({ date_du_date: `2026-01-${String(i + 1).padStart(2, '0')}` })
    )
    const badges = computeBadges({ ...baseInput, vecuDates })
    const badge = findBadge(badges, 'ten')
    expect(badge.unlocked).toBe(true)
    expect(badge.unlockedAt).toBe('2026-01-10')
  })

  it('ne débloque pas "Enflammé" avec seulement 9 dates', () => {
    const vecuDates = Array.from({ length: 9 }, (_, i) => faireDate({ date_du_date: `2026-01-0${i + 1}` }))
    const badges = computeBadges({ ...baseInput, vecuDates })
    expect(findBadge(badges, 'ten').unlocked).toBe(false)
  })

  it('débloque "Excellent" à la première note >= 18, chronologiquement', () => {
    const vecuDates = [
      faireDate({ date_du_date: '2026-01-01', note_globale: 12 }),
      faireDate({ date_du_date: '2026-02-01', note_globale: 19 }),
      faireDate({ date_du_date: '2026-03-01', note_globale: 20 }),
    ]
    const badges = computeBadges({ ...baseInput, vecuDates })
    expect(findBadge(badges, 'excellent').unlockedAt).toBe('2026-02-01')
    expect(findBadge(badges, 'perfect').unlockedAt).toBe('2026-03-01')
  })

  it('débloque "Explorateur" quand 5 lieux distincts ont été visités', () => {
    const vecuDates = [
      faireDate({ date_du_date: '2026-01-01', lieu: 'A' }),
      faireDate({ date_du_date: '2026-01-02', lieu: 'A' }), // doublon, ne compte pas deux fois
      faireDate({ date_du_date: '2026-01-03', lieu: 'B' }),
      faireDate({ date_du_date: '2026-01-04', lieu: 'C' }),
      faireDate({ date_du_date: '2026-01-05', lieu: 'D' }),
      faireDate({ date_du_date: '2026-01-06', lieu: 'E' }),
    ]
    const badges = computeBadges({ ...baseInput, vecuDates })
    const badge = findBadge(badges, 'explorer')
    expect(badge.unlocked).toBe(true)
    expect(badge.unlockedAt).toBe('2026-01-06')
  })

  it('ignore la casse pour compter les lieux distincts', () => {
    const vecuDates = [
      faireDate({ lieu: 'Le Café' }),
      faireDate({ lieu: 'le café' }),
    ]
    const badges = computeBadges({ ...baseInput, vecuDates })
    expect(findBadge(badges, 'explorer').current).toBe(1)
  })

  it('débloque "Recommandeur" au 3e date conseillé vivement uniquement', () => {
    const vecuDates = [
      faireDate({ date_du_date: '2026-01-01', conseil_vivement: true }),
      faireDate({ date_du_date: '2026-01-02', conseil_vivement: false }),
      faireDate({ date_du_date: '2026-01-03', conseil_vivement: true }),
      faireDate({ date_du_date: '2026-01-04', conseil_vivement: true }),
    ]
    const badges = computeBadges({ ...baseInput, vecuDates })
    const badge = findBadge(badges, 'conseil')
    expect(badge.unlocked).toBe(true)
    expect(badge.unlockedAt).toBe('2026-01-04')
  })

  it('débloque "Commentateur" au 5e commentaire', () => {
    const commentDates = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05']
    const badges = computeBadges({ ...baseInput, commentDates })
    expect(findBadge(badges, 'writer').unlockedAt).toBe('2026-01-05')
  })

  it('débloque "Duo" seulement si hasCouple est vrai, sans date précise', () => {
    const badges = computeBadges({ ...baseInput, hasCouple: true })
    const badge = findBadge(badges, 'couple')
    expect(badge.unlocked).toBe(true)
    expect(badge.unlockedAt).toBeNull()
  })

  it('débloque les badges de régularité selon monthStreak', () => {
    const badges = computeBadges({ ...baseInput, monthStreak: 4 })
    expect(findBadge(badges, 'streak3').unlocked).toBe(true)
    expect(findBadge(badges, 'streak6').unlocked).toBe(false)
  })

  it('débloque "Planificateur" au 3e date planifié', () => {
    const planifieDates = ['2026-01-01', '2026-01-02', '2026-01-03']
    const badges = computeBadges({ ...baseInput, planifieDates })
    expect(findBadge(badges, 'planner').unlockedAt).toBe('2026-01-03')
  })
})
