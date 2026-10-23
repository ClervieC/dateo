import { Platform } from 'react-native'

export const webContentStyle = Platform.OS === 'web'
  ? { maxWidth: 640, alignSelf: 'center' as const, width: '100%' as const }
  : {}

export const webFormStyle = Platform.OS === 'web'
  ? { maxWidth: 480, alignSelf: 'center' as const, width: '100%' as const }
  : {}
