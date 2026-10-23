import { useEffect, useRef } from 'react'
import { Animated, View, StyleProp, ViewStyle, Platform } from 'react-native'
import { C, themedStyles } from './theme'

// Bloc gris qui « respire » pendant le chargement, à la forme du contenu attendu
export function SkeletonBlock({ style }: { style?: StyleProp<ViewStyle> }) {
  const opacity = useRef(new Animated.Value(0.5)).current
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
    ]))
    loop.start()
    return () => loop.stop()
  }, [opacity])
  return <Animated.View style={[styles.block, style, { opacity }]} />
}

// Carte fantôme : avatar + lignes de texte (+ photo en option), comme une carte du feed
export function SkeletonCard({ withPhoto = false }: { withPhoto?: boolean }) {
  return (
    <View style={styles.card} accessibilityLabel="…">
      <View style={styles.row}>
        <SkeletonBlock style={styles.avatar} />
        <SkeletonBlock style={[styles.line, { width: '35%' }]} />
      </View>
      {withPhoto && <SkeletonBlock style={styles.photo} />}
      <SkeletonBlock style={[styles.line, { width: '70%', height: 14, marginTop: 12 }]} />
      <SkeletonBlock style={[styles.line, { width: '45%', marginTop: 8 }]} />
    </View>
  )
}

export function SkeletonList({ count = 3, withPhoto = false }: { count?: number; withPhoto?: boolean }) {
  return (
    <View>
      {Array.from({ length: count }, (_, i) => <SkeletonCard key={i} withPhoto={withPhoto && i === 0} />)}
    </View>
  )
}

const styles = themedStyles(() => ({
  block: { backgroundColor: C.skeleton, borderRadius: 8 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 30, height: 30, borderRadius: 15 },
  line: { height: 10, borderRadius: 5 },
  photo: { height: 180, borderRadius: 12, marginTop: 12 },
}))
