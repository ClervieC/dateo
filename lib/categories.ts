export const CATEGORIES = [
  { key: 'restaurant', label: 'Restaurant', emoji: '🍽️' },
  { key: 'cine', label: 'Ciné', emoji: '🎬' },
  { key: 'nature', label: 'Nature', emoji: '🌿' },
  { key: 'culture', label: 'Culture', emoji: '🎨' },
  { key: 'sport', label: 'Sport', emoji: '⚽' },
  { key: 'balade', label: 'Balade', emoji: '🚶' },
  { key: 'soiree', label: 'Soirée', emoji: '🎉' },
  { key: 'voyage', label: 'Voyage', emoji: '✈️' },
] as const

export type CategoryKey = typeof CATEGORIES[number]['key']

export function getCategoryLabel(key: string | null | undefined): string {
  if (!key) return ''
  const cat = CATEGORIES.find((c) => c.key === key)
  return cat ? `${cat.emoji} ${cat.label}` : key
}
