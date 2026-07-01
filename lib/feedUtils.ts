export type Idea = {
  id: string
  titre: string
  description: string | null
  categorie: string
}

export function extraireCategories(ideas: Idea[]): string[] {
  const set = new Set(ideas.map((i) => i.categorie))
  return Array.from(set)
}

export function filtrerParCategorie(ideas: Idea[], categorie: string | null): Idea[] {
  if (!categorie) return ideas
  return ideas.filter((i) => i.categorie === categorie)
}

export function getCouleurCategorie(
  categorie: string,
  palette: Record<string, { bg: string; text: string }>
): { bg: string; text: string } {
  return palette[categorie] ?? { bg: '#F1EFE8', text: '#444441' }
}