export type Idea = {
  id: string
  titre: string
  description: string | null
  categorie: string | null
  ville?: string | null
}

export function extraireCategories(ideas: Idea[]): string[] {
  const set = new Set(ideas.map((i) => i.categorie).filter((c): c is string => !!c))
  return Array.from(set)
}

export function filtrerParCategorie(ideas: Idea[], categorie: string | null): Idea[] {
  if (!categorie) return ideas
  return ideas.filter((i) => i.categorie === categorie)
}