import { Platform } from 'react-native'

export const webContentStyle = Platform.OS === 'web'
  ? { maxWidth: 640, alignSelf: 'center' as const, width: '100%' as const }
  : {}

export const webFormStyle = Platform.OS === 'web'
  ? { maxWidth: 480, alignSelf: 'center' as const, width: '100%' as const }
  : {}

export const webAuthCardStyle = Platform.OS === 'web'
  ? {
      backgroundColor: '#fff',
      borderRadius: 16,
      padding: 40,
      shadowColor: '#000' as const,
      shadowOpacity: 0.08,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 4 },
    }
  : { padding: 24 }
