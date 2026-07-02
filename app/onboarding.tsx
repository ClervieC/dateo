import { useRef, useState } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, useWindowDimensions } from 'react-native'
import { useRouter } from 'expo-router'

const STEPS = [
  {
    emoji: '❤️',
    title: 'Note vos dates',
    subtitle: 'Enregistre chaque date avec une note, un commentaire et des photos. Retrouve tout dans ton historique.',
  },
  {
    emoji: '📸',
    title: 'Revivez vos moments',
    subtitle: 'Ajoutez jusqu\'à 10 photos par date. Criètres détaillés : ambiance, nourriture, conversation...',
  },
  {
    emoji: '👫',
    title: 'Partagez avec vos amis',
    subtitle: 'Ajoutez vos amis pour voir leurs dates préférés et découvrir de nouvelles idées dans le feed.',
  },
  {
    emoji: '💡',
    title: 'Trouvez l\'inspiration',
    subtitle: 'Parcourez des idées de dates dans l\'onglet Idées et planifiez vos prochaines sorties.',
  },
]

export default function Onboarding() {
  const [index, setIndex] = useState(0)
  const listRef = useRef<FlatList>(null)
  const router = useRouter()
  const { width } = useWindowDimensions()

  function goNext() {
    if (index < STEPS.length - 1) {
      const next = index + 1
      listRef.current?.scrollToIndex({ index: next, animated: true })
      setIndex(next)
    } else {
      router.replace('/(tabs)/feed')
    }
  }

  function skip() {
    router.replace('/(tabs)/feed')
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={STEPS}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        keyExtractor={(_, i) => String(i)}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={styles.slideContent}>
              <Text style={styles.emoji}>{item.emoji}</Text>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>
            </View>
          </View>
        )}
      />

      <View style={styles.dots}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryBtn} onPress={goNext}>
          <Text style={styles.primaryBtnText}>
            {index === STEPS.length - 1 ? 'Commencer !' : 'Suivant →'}
          </Text>
        </TouchableOpacity>
        {index < STEPS.length - 1 && (
          <TouchableOpacity style={styles.skipBtn} onPress={skip}>
            <Text style={styles.skipText}>Passer</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F5' },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  slideContent: { maxWidth: 480, width: '100%', alignItems: 'center' },
  emoji: { fontSize: 72, marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', color: '#D4517E', textAlign: 'center', marginBottom: 16, lineHeight: 34 },
  subtitle: { fontSize: 16, color: '#888', textAlign: 'center', lineHeight: 24 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F0D9D9' },
  dotActive: { backgroundColor: '#D4517E', width: 24 },
  actions: { paddingHorizontal: 24, paddingBottom: 48, gap: 10 },
  primaryBtn: { backgroundColor: '#D4517E', borderRadius: 16, padding: 18, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  skipBtn: { alignItems: 'center', padding: 10 },
  skipText: { color: '#B8A9A0', fontSize: 15 },
})
