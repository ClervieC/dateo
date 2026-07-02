import { useEffect, useRef, useState } from 'react'
import { Animated, TouchableOpacity, View, StyleSheet, StyleProp, ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { notificationStore } from './notificationStore'

type Props = {
  size?: number
  color?: string
  style?: StyleProp<ViewStyle>
}

export function NotificationBell({ size = 22, color = '#D4517E', style }: Props) {
  const router = useRouter()
  const [hasUnread, setHasUnread] = useState(notificationStore.get())
  const scale = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const unsubState = notificationStore.subscribe(setHasUnread)
    const unsubPulse = notificationStore.subscribePulse(() => {
      scale.setValue(1)
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.4, duration: 150, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 3, tension: 120, useNativeDriver: true }),
      ]).start()
    })
    return () => { unsubState(); unsubPulse() }
  }, [scale])

  return (
    <TouchableOpacity
      onPress={() => { notificationStore.setUnread(false); router.push('/notifications') }}
      style={style}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name={hasUnread ? 'notifications' : 'notifications-outline'} size={size} color={color} />
        {hasUnread && <View style={styles.dot} />}
      </Animated.View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#D85A30',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
})
