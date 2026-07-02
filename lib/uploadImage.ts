// Convertit une URI locale (photo prise/choisie via expo-image-picker) en Blob
// uploadable directement à Supabase Storage. Fonctionne sur web (contrairement à
// expo-file-system, qui n'a pas de readAsStringAsync sur cette plateforme) et sur natif.
export async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri)
  return response.blob()
}
