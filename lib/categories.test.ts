import { CATEGORIES, getCategoryLabel, getCategoryColor } from './categories'

describe('getCategoryLabel', () => {
  it('retourne une chaîne vide pour null ou undefined', () => {
    expect(getCategoryLabel(null)).toBe('')
    expect(getCategoryLabel(undefined)).toBe('')
  })

  it('retourne emoji + label pour une catégorie connue', () => {
    expect(getCategoryLabel('restaurant')).toBe('🍽️ Restaurant')
    expect(getCategoryLabel('cine')).toBe('🎬 Ciné')
  })

  it('retourne la clé telle quelle pour une catégorie inconnue', () => {
    expect(getCategoryLabel('inconnue')).toBe('inconnue')
  })

  it('couvre toutes les catégories déclarées', () => {
    for (const cat of CATEGORIES) {
      expect(getCategoryLabel(cat.key)).toBe(`${cat.emoji} ${cat.label}`)
    }
  })
})

describe('getCategoryColor', () => {
  it('retourne la couleur associée à une catégorie connue', () => {
    expect(getCategoryColor('nature')).toEqual({ bg: '#EAF3DE', text: '#3B6D11' })
  })

  it('retourne une couleur par défaut pour une catégorie inconnue ou absente', () => {
    expect(getCategoryColor('inconnue')).toEqual({ bg: '#F1EFE8', text: '#444441' })
    expect(getCategoryColor(null)).toEqual({ bg: '#F1EFE8', text: '#444441' })
  })
})
