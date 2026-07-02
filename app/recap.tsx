import { useEffect, useState, useRef } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { CATEGORIES, getCategoryLabel } from '../lib/categories'

const YEAR = new Date().getFullYear()
const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

type DateRow = { lieu: string; intitule: string | null; note_globale: number; date_du_date: string; categorie: string | null }

export default function Recap() {
  const [dates, setDates] = useState<DateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [slide, setSlide] = useState(0)
  const listRef = useRef<FlatList>(null)
  const router = useRouter()
  const { width } = useWindowDimensions()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('dates')
        .select('lieu, intitule, note_globale, date_du_date, categorie')
        .eq('user_id', user.id)
        .eq('statut', 'vecu')
        .not('note_globale', 'is', null)
        .gte('date_du_date', `${YEAR}-01-01`)
        .lte('date_du_date', `${YEAR}-12-31`)
        .order('date_du_date', { ascending: false })
      setDates(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const meilleur = dates.length > 0 ? dates.reduce((a, b) => a.note_globale >= b.note_globale ? a : b) : null
  const moyenne = dates.length > 0 ? (dates.reduce((s, d) => s + d.note_globale, 0) / dates.length) : 0

  const moisMap: Record<number, number> = {}
  for (const d of dates) { const m = new Date(d.date_du_date).getMonth(); moisMap[m] = (moisMap[m] ?? 0) + 1 }
  const meilleurMoisIdx = Object.entries(moisMap).sort((a, b) => Number(b[1]) - Number(a[1]))[0]

  const catMap: Record<string, number> = {}
  for (const d of dates) { if (d.categorie) catMap[d.categorie] = (catMap[d.categorie] ?? 0) + 1 }
  const topCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0]

  const lieuMap: Record<string, number> = {}
  for (const d of dates) { lieuMap[d.lieu] = (lieuMap[d.lieu] ?? 0) + 1 }
  const topLieu = Object.entries(lieuMap).sort((a, b) => b[1] - a[1])[0]

  type Slide = { bg: string; textColor: string; emoji: string; title: string; value: string; label: string; sub?: string; isLast?: boolean }
  const slides: Slide[] = ([
    {
      bg: '#D4517E', textColor: '#fff',
      emoji: '🎉',
      title: `${YEAR}, c'est wrap !`,
      value: String(dates.length),
      label: dates.length === 1 ? 'date vécu cette année' : 'dates vécus cette année',
    },
    meilleur ? {
      bg: '#fff', textColor: '#5C4A45',
      emoji: '⭐',
      title: 'Ton meilleur date',
      value: `${meilleur.note_globale}/20`,
      label: meilleur.intitule ?? meilleur.lieu,
      sub: meilleur.intitule ? `📍 ${meilleur.lieu}` : undefined,
    } : null,
    {
      bg: '#FDE8F0', textColor: '#D4517E',
      emoji: '📊',
      title: 'Ta note moyenne',
      value: `${moyenne.toFixed(1)}/20`,
      label: moyenne >= 15 ? 'Vous avez de très bons goûts !' : moyenne >= 10 ? 'Pas mal du tout !' : 'Il y a encore de la marge !',
    },
    meilleurMoisIdx ? {
      bg: '#5C4A45', textColor: '#fff',
      emoji: '📅',
      title: 'Mois le plus actif',
      value: MOIS[Number(meilleurMoisIdx[0])],
      label: `${meilleurMoisIdx[1]} date${Number(meilleurMoisIdx[1]) > 1 ? 's' : ''} ce mois-là`,
    } : null,
    topLieu ? {
      bg: '#F0D9D9', textColor: '#5C4A45',
      emoji: '📍',
      title: 'Lieu le plus visité',
      value: topLieu[0],
      label: `${topLieu[1]}x cette année`,
    } : null,
    topCat ? {
      bg: '#FFF8F5', textColor: '#5C4A45',
      emoji: getCategoryLabel(topCat[0]).split(' ')[0],
      title: 'Ta catégorie favorite',
      value: getCategoryLabel(topCat[0]).split(' ').slice(1).join(' '),
      label: `${topCat[1]} date${topCat[1] > 1 ? 's' : ''} dans cette catégorie`,
    } : null,
    {
      bg: '#D4517E', textColor: '#fff',
      emoji: '💖',
      title: 'À l\'année prochaine !',
      value: `${YEAR + 1}`,
      label: 'Encore plein de beaux moments devant vous',
      isLast: true,
    },
  ] as (Slide | null)[]).filter(Boolean) as Slide[]

  function goNext() {
    if (slide < slides.length - 1) {
      const next = slide + 1
      listRef.current?.scrollToIndex({ index: next, animated: true })
      setSlide(next)
    } else {
      router.back()
    }
  }

  function goBack() {
    if (slide === 0) return
    const prev = slide - 1
    listRef.current?.scrollToIndex({ index: prev, animated: true })
    setSlide(prev)
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: '#D4517E' }]} edges={['top']}>
        <ActivityIndicator color="#fff" style={{ marginTop: 60 }} size="large" />
      </SafeAreaView>
    )
  }

  if (dates.length === 0) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: '#D4517E' }]} edges={['top']}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyTitle}>Pas encore de dates en {YEAR}</Text>
          <Text style={styles.emptySub}>Reviens à la fin de l'année !</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => router.back()}>
            <Text style={styles.emptyBtnText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: slides[slide]?.bg ?? '#D4517E' }]} edges={['top', 'bottom']}>
      <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
        <Text style={[styles.closeText, { color: slides[slide]?.textColor ?? '#fff' }]}>✕</Text>
      </TouchableOpacity>

      <FlatList
        ref={listRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => {
          const newIndex = Math.round(e.nativeEvent.contentOffset.x / width)
          setSlide(newIndex)
        }}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width, backgroundColor: item.bg }]}>
            <View style={styles.slideContent}>
              <Text style={styles.slideEmoji}>{item.emoji}</Text>
              <Text style={[styles.slideTitle, { color: item.textColor }]}>{item.title}</Text>
              <Text style={[styles.slideValue, { color: item.textColor }]}>{item.value}</Text>
              <Text style={[styles.slideLabel, { color: item.textColor, opacity: 0.75 }]}>{item.label}</Text>
              {(item as any).sub && (
                <Text style={[styles.slideSub, { color: item.textColor, opacity: 0.6 }]}>{(item as any).sub}</Text>
              )}
            </View>
          </View>
        )}
      />

      <View style={[styles.footer, { backgroundColor: slides[slide]?.bg ?? '#D4517E' }]}>
        <View style={styles.dots}>
          {slides.map((_s: Slide, i: number) => (
            <View key={i} style={[styles.dot, { backgroundColor: slides[slide]?.textColor ?? '#fff', opacity: i === slide ? 1 : 0.3 }]} />
          ))}
        </View>
        <View style={styles.footerBtnRow}>
          {slide > 0 && (
            <TouchableOpacity style={[styles.nextBtn, styles.backBtn, { borderColor: slides[slide]?.textColor ?? '#fff' }]} onPress={goBack}>
              <Text style={[styles.nextBtnText, { color: slides[slide]?.textColor ?? '#fff' }]}>← Précédent</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.nextBtn, { flex: 1, borderColor: slides[slide]?.textColor ?? '#fff' }]} onPress={goNext}>
            <Text style={[styles.nextBtnText, { color: slides[slide]?.textColor ?? '#fff' }]}>
              {slide === slides.length - 1 ? 'Fermer' : 'Suivant →'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  closeBtn: { position: 'absolute', top: 54, right: 20, zIndex: 10, padding: 8 },
  closeText: { fontSize: 18, fontWeight: '700' },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, paddingTop: 40 },
  slideContent: { maxWidth: 480, width: '100%', alignItems: 'center' },
  slideEmoji: { fontSize: 64, marginBottom: 20 },
  slideTitle: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 12, opacity: 0.85 },
  slideValue: { fontSize: 52, fontWeight: '900', textAlign: 'center', marginBottom: 12, lineHeight: 60 },
  slideLabel: { fontSize: 17, textAlign: 'center', lineHeight: 24 },
  slideSub: { fontSize: 13, textAlign: 'center', marginTop: 6 },
  footer: { paddingBottom: 40, paddingHorizontal: 24 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 16 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  footerBtnRow: { flexDirection: 'row', gap: 10 },
  nextBtn: { borderRadius: 16, borderWidth: 1.5, padding: 16, alignItems: 'center' },
  backBtn: { paddingHorizontal: 20 },
  nextBtnText: { fontWeight: '700', fontSize: 16 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 8 },
  emptySub: { fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginBottom: 24 },
  emptyBtn: { borderRadius: 14, borderWidth: 1.5, borderColor: '#fff', paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
