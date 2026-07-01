import {
  requeteValide,
  filtrerSesPropresResultats,
  retirerDeLaListe,
  formaterUsername,
  usernameValide,
  Profile,
} from './friendsUtils'

describe('requeteValide', () => {
  it('rejette une chaîne vide', () => {
    expect(requeteValide('')).toBe(false)
  })

  it('rejette une chaîne d\'un seul caractère', () => {
    expect(requeteValide('a')).toBe(false)
  })

  it('accepte une chaîne de 2 caractères ou plus', () => {
    expect(requeteValide('ab')).toBe(true)
  })

  it('ignore les espaces autour', () => {
    expect(requeteValide('  a  ')).toBe(false)
    expect(requeteValide('  ab  ')).toBe(true)
  })
})

describe('filtrerSesPropresResultats', () => {
  const profiles: Profile[] = [
    { id: '1', username: 'alice' },
    { id: '2', username: 'bob' },
    { id: '3', username: 'carla' },
  ]

  it('retire son propre profil des résultats', () => {
    const resultat = filtrerSesPropresResultats(profiles, '2')
    expect(resultat).toHaveLength(2)
    expect(resultat.find((p) => p.id === '2')).toBeUndefined()
  })

  it('ne change rien si son id n\'est pas dans la liste', () => {
    const resultat = filtrerSesPropresResultats(profiles, '999')
    expect(resultat).toHaveLength(3)
  })

  it('fonctionne avec une liste vide', () => {
    expect(filtrerSesPropresResultats([], '1')).toEqual([])
  })
})

describe('retirerDeLaListe', () => {
  const profiles: Profile[] = [
    { id: '1', username: 'alice' },
    { id: '2', username: 'bob' },
  ]

  it('retire l\'élément correspondant', () => {
    const resultat = retirerDeLaListe(profiles, '1')
    expect(resultat).toEqual([{ id: '2', username: 'bob' }])
  })

  it('ne change rien si l\'id n\'existe pas', () => {
    expect(retirerDeLaListe(profiles, '999')).toHaveLength(2)
  })
})

describe('formaterUsername', () => {
  it('ajoute un @ devant le pseudo', () => {
    expect(formaterUsername('clervie')).toBe('@clervie')
  })

  it('retire les espaces autour avant de formater', () => {
    expect(formaterUsername('  clervie  ')).toBe('@clervie')
  })
})

describe('usernameValide', () => {
  it('rejette un pseudo vide', () => {
    const resultat = usernameValide('')
    expect(resultat.valide).toBe(false)
    expect(resultat.message).toBe('Le pseudo ne peut pas être vide')
  })

  it('rejette un pseudo composé uniquement d\'espaces', () => {
    expect(usernameValide('   ').valide).toBe(false)
  })

  it('rejette un pseudo trop court', () => {
    const resultat = usernameValide('ab')
    expect(resultat.valide).toBe(false)
    expect(resultat.message).toBe('Le pseudo doit faire au moins 3 caractères')
  })

  it('accepte un pseudo de 3 caractères', () => {
    expect(usernameValide('abc').valide).toBe(true)
  })

  it('rejette les caractères spéciaux non autorisés', () => {
    const resultat = usernameValide('clervie!')
    expect(resultat.valide).toBe(false)
    expect(resultat.message).toContain('lettres, chiffres')
  })

  it('accepte les underscores et points', () => {
    expect(usernameValide('clervie_d.34').valide).toBe(true)
  })

  it('accepte un pseudo valide simple', () => {
    expect(usernameValide('clervie').valide).toBe(true)
  })
})