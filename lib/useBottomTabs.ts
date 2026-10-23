import { Platform, useWindowDimensions } from 'react-native'

// En dessous de cette largeur, la version web se comporte comme l'app mobile :
// barre d'onglets en bas, cloche de notifications dans l'en-tête des écrans.
export const DESKTOP_WEB_MIN_WIDTH = 768

export function useBottomTabs(): boolean {
  const { width } = useWindowDimensions()
  return Platform.OS !== 'web' || width < DESKTOP_WEB_MIN_WIDTH
}
