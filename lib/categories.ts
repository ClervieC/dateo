import { t, tKey } from './i18n'

// Liste unique de catégories utilisée PARTOUT dans l'app (notation d'un date, filtres,
// idées de dates, prompts IA...) pour que tout reste comparable d'un endroit à l'autre.
export const CATEGORIES = [
  { key: 'restaurant', label: tKey("Restaurant"), emoji: '🍽️', bg: '#FAEEDA', text: '#854F0B' },
  { key: 'cine', label: tKey("Ciné"), emoji: '🎬', bg: '#EEEDFE', text: '#3C3489' },
  { key: 'nature', label: tKey("Nature"), emoji: '🌿', bg: '#EAF3DE', text: '#3B6D11' },
  { key: 'culture', label: tKey("Culture"), emoji: '🎨', bg: '#E8F3FF', text: '#1A4F8A' },
  { key: 'sport', label: tKey("Sport"), emoji: '⚽', bg: '#FAECE7', text: '#993C1D' },
  { key: 'balade', label: tKey("Balade"), emoji: '🚶', bg: '#E3F6F5', text: '#0F7173' },
  { key: 'soiree', label: tKey("Soirée"), emoji: '🎉', bg: '#FBEAF0', text: '#993556' },
  { key: 'voyage', label: tKey("Voyage"), emoji: '✈️', bg: '#FFF3D6', text: '#8A6116' },
  { key: 'autre', label: tKey("Autre"), emoji: '✨', bg: '#F1EFE8', text: '#5C4A45' },
] as const

const DEFAULT_COLOR = { bg: '#F1EFE8', text: '#444441' }

export function getCategoryColor(key: string | null | undefined): { bg: string; text: string } {
  const cat = CATEGORIES.find((c) => c.key === key)
  return cat ? { bg: cat.bg, text: cat.text } : DEFAULT_COLOR
}

export type CategoryKey = typeof CATEGORIES[number]['key']

export function getCategoryLabel(key: string | null | undefined): string {
  if (!key) return ''
  const cat = CATEGORIES.find((c) => c.key === key)
  return cat ? `${cat.emoji} ${t(cat.label)}` : key
}
