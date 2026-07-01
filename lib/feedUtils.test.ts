import { extraireCategories, filtrerParCategorie, getCouleurCategorie, Idea } from './feedUtils'

const faireIdea = (overrides: Partial<Idea>): Idea => ({
  id: '1',
  titre: 'Pique-nique',
  description: 'Un moment au parc',
  categorie: 'Nature',
  ...overrides,
})

describe('extraireCategories', () => {
  it('retourne un tableau vide pour une liste vide', () => {
    expect(extraireCategories([])).toEqual([])
  })

  it('extrait les catégories uniques', () => {
    const ideas = [
      faireIdea({ categorie: 'Nature' }),
      faireIdea({ categorie: 'Gastronomie' }),
      faireIdea({ categorie: 'Nature' }),
    ]
    expect(extraireCategories(ideas)).toEqual(['Nature', 'Gastronomie'])
  })

  it('ne duplique pas les catégories', () => {
    const ideas = [
      faireIdea({ categorie: 'Aventure' }),
      faireIdea({ categorie: 'Aventure' }),
      faireIdea({ categorie: 'Aventure' }),
    ]
    expect(extraireCategories(ideas)).toEqual(['Aventure'])
  })
})

describe('filtrerParCategorie', () => {
  const ideas = [
    faireIdea({ id: '1', categorie: 'Nature' }),
    faireIdea({ id: '2', categorie: 'Gastronomie' }),
    faireIdea({ id: '3', categorie: 'Nature' }),
  ]

  it('retourne toutes les idées quand categorie est null', () => {
    expect(filtrerParCategorie(ideas, null)).toHaveLength(3)
  })

  it('filtre correctement par catégorie', () => {
    const resultat = filtrerParCategorie(ideas, 'Nature')
    expect(resultat).toHaveLength(2)
    expect(resultat.every((i) => i.categorie === 'Nature')).toBe(true)
  })

  it('retourne un tableau vide pour une catégorie inexistante', () => {
    expect(filtrerParCategorie(ideas, 'Inexistante')).toEqual([])
  })
})

describe('getCouleurCategorie', () => {
  const palette = {
    Nature: { bg: '#EAF3DE', text: '#3B6D11' },
  }

  it('retourne la couleur de la palette si elle existe', () => {
    expect(getCouleurCategorie('Nature', palette)).toEqual({ bg: '#EAF3DE', text: '#3B6D11' })
  })

  it('retourne une couleur par défaut si la catégorie est inconnue', () => {
    expect(getCouleurCategorie('Inconnue', palette)).toEqual({ bg: '#F1EFE8', text: '#444441' })
  })
})