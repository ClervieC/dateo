import { tKey } from './i18n'

// Critères détaillés d'un date (notés sur 5). Libellés = clés de traduction : à
// afficher avec t(c.label).
export const CRITERES = [
  { key: 'mood', label: tKey('Mood') },
  { key: 'nourriture', label: tKey('Nourriture') },
  { key: 'ambiance', label: tKey('Ambiance') },
  { key: 'personne', label: tKey('La personne') },
  { key: 'conversation', label: tKey('Conversation') },
  { key: 'prix', label: tKey('Prix / Valeur') },
  { key: 'envie_recommencer', label: tKey('Envie de recommencer') },
]
