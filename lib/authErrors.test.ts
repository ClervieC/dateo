import { computeAge, emailValide, traduireErreurAuth } from './authErrors'

describe('computeAge', () => {
  const today = new Date(2026, 9, 23) // 23 octobre 2026

  it('compte les années pleines', () => {
    expect(computeAge('2000-01-01', today)).toBe(26)
  })

  it("retire un an si l'anniversaire n'est pas encore passé", () => {
    expect(computeAge('2010-10-24', today)).toBe(15)
  })

  it("compte l'anniversaire le jour même", () => {
    expect(computeAge('2010-10-23', today)).toBe(16)
  })
})

describe('emailValide', () => {
  it('accepte une adresse classique', () => {
    expect(emailValide('toi@exemple.com')).toBe(true)
    expect(emailValide('  toi@exemple.fr  ')).toBe(true)
  })

  it('refuse les adresses incomplètes', () => {
    expect(emailValide('toi@exemple')).toBe(false)
    expect(emailValide('toi.exemple.com')).toBe(false)
    expect(emailValide('')).toBe(false)
  })
})

describe('traduireErreurAuth', () => {
  it('traduit les erreurs Supabase courantes', () => {
    expect(traduireErreurAuth('Invalid login credentials')).toBe('Email ou mot de passe incorrect')
    expect(traduireErreurAuth('User already registered')).toContain('existe déjà')
  })

  it('laisse passer les messages inconnus', () => {
    expect(traduireErreurAuth('Something odd')).toBe('Something odd')
  })
})
