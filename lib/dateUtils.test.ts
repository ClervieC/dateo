import { calculerMoyenne, trouverMeilleurLieu, validerFormulaireDate, clamperNote, DateRow } from './dateUtils'

const faireDate = (overrides: Partial<DateRow>): DateRow => ({
  id: '1',
  lieu: 'Le Petit Café',
  date_du_date: '2026-06-30',
  note_globale: 10,
  commentaire: null,
  ...overrides,
})

describe('calculerMoyenne', () => {
  it('retourne — quand il n\'y a aucun date', () => {
    expect(calculerMoyenne([])).toBe('—')
  })

  it('calcule la moyenne correcte pour un seul date', () => {
    expect(calculerMoyenne([faireDate({ note_globale: 15 })])).toBe('15.0')
  })

  it('calcule la moyenne correcte pour plusieurs dates', () => {
    const dates = [
      faireDate({ note_globale: 10 }),
      faireDate({ note_globale: 15 }),
      faireDate({ note_globale: 20 }),
    ]
    expect(calculerMoyenne(dates)).toBe('15.0')
  })

  it('arrondit à une décimale', () => {
    const dates = [faireDate({ note_globale: 10 }), faireDate({ note_globale: 11 })]
    expect(calculerMoyenne(dates)).toBe('10.5')
  })

  it('gère le cas où toutes les notes sont à 0', () => {
    const dates = [faireDate({ note_globale: 0 }), faireDate({ note_globale: 0 })]
    expect(calculerMoyenne(dates)).toBe('0.0')
  })
})

describe('trouverMeilleurLieu', () => {
  it('retourne — quand il n\'y a aucun date', () => {
    expect(trouverMeilleurLieu([])).toBe('—')
  })

  it('retourne le lieu du date le mieux noté', () => {
    const dates = [
      faireDate({ lieu: 'Café A', note_globale: 10 }),
      faireDate({ lieu: 'Restaurant B', note_globale: 18 }),
      faireDate({ lieu: 'Parc C', note_globale: 14 }),
    ]
    expect(trouverMeilleurLieu(dates)).toBe('Restaurant B')
  })

  it('retourne le premier lieu en cas d\'égalité', () => {
    const dates = [
      faireDate({ lieu: 'Café A', note_globale: 15 }),
      faireDate({ lieu: 'Café B', note_globale: 15 }),
    ]
    expect(trouverMeilleurLieu(dates)).toBe('Café A')
  })

  it('fonctionne avec un seul date', () => {
    expect(trouverMeilleurLieu([faireDate({ lieu: 'Solo' })])).toBe('Solo')
  })
})

describe('validerFormulaireDate', () => {
  it('rejette un lieu vide', () => {
    const resultat = validerFormulaireDate('')
    expect(resultat.valide).toBe(false)
    expect(resultat.message).toBe('Indique le lieu du date')
  })

  it('rejette un lieu composé uniquement d\'espaces', () => {
    const resultat = validerFormulaireDate('   ')
    expect(resultat.valide).toBe(false)
  })

  it('accepte un lieu valide', () => {
    const resultat = validerFormulaireDate('Le Petit Café')
    expect(resultat.valide).toBe(true)
    expect(resultat.message).toBeUndefined()
  })

  it('accepte un lieu avec espaces autour mais du contenu', () => {
    const resultat = validerFormulaireDate('  Café  ')
    expect(resultat.valide).toBe(true)
  })
})

describe('clamperNote', () => {
  it('garde une note valide inchangée', () => {
    expect(clamperNote(3, 5)).toBe(3)
  })

  it('bloque une note négative à 0', () => {
    expect(clamperNote(-2, 5)).toBe(0)
  })

  it('bloque une note trop haute au maximum', () => {
    expect(clamperNote(25, 20)).toBe(20)
  })

  it('arrondit une note décimale', () => {
    expect(clamperNote(3.7, 5)).toBe(4)
  })

  it('fonctionne à la limite exacte', () => {
    expect(clamperNote(20, 20)).toBe(20)
    expect(clamperNote(0, 20)).toBe(0)
  })
})