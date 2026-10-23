import { useRef } from 'react'
import { Animated, TouchableOpacity, Text, Platform, StyleProp, ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { C, themedStyles } from './theme'
import { hapticTap } from './haptics'
import { t } from './i18n'

type Props = {
  liked: boolean
  count: number
  onPress: () => void
  size?: number
  label?: string
  style?: StyleProp<ViewStyle>
}

// Cœur « J'aime » : petit rebond + retour haptique à l'appui
export function LikeButton({ liked, count, onPress, size = 20, label, style }: Props) {
  const scale = useRef(new Animated.Value(1)).current

  function press() {
    hapticTap()
    scale.setValue(1)
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.35, duration: 110, useNativeDriver: Platform.OS !== 'web' }),
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 160, useNativeDriver: Platform.OS !== 'web' }),
    ]).start()
    onPress()
  }

  return (
    <TouchableOpacity
      style={[styles.row, style]}
      onPress={press}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityState={{ selected: liked }}
      accessibilityLabel={liked ? t("Je n'aime plus") : t("J'aime")}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name={liked ? 'heart' : 'heart-outline'} size={size} color={liked ? C.primary : C.faint} />
      </Animated.View>
      {label !== undefined ? (
        <Text style={[styles.count, liked && styles.countActive]}>{label}</Text>
      ) : count > 0 ? (
        <Text style={[styles.count, liked && styles.countActive]}>{count}</Text>
      ) : null}
    </TouchableOpacity>
  )
}

const styles = themedStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  count: { fontSize: 13, color: C.faint, fontWeight: '600' },
  countActive: { color: C.primaryText },
}))
