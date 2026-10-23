import { Platform } from 'react-native'
import * as Haptics from 'expo-haptics'

// Retours haptiques légers (sans effet sur le web, où l'API n'existe pas)
const enabled = Platform.OS !== 'web'

export function hapticTap() {
  if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
}

export function hapticSelect() {
  if (enabled) Haptics.selectionAsync().catch(() => {})
}

export function hapticSuccess() {
  if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
}
