import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Linking, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { webContentStyle } from '../lib/webStyles'
import { CATEGORIES } from '../lib/categories'

type DateRow = { lieu: string; note_globale: number; date_du_date: string; categorie: string | null }

const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const MOIS_COURTS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

const NOTE_BINS = [
  { label: '0–9', min: 0, max: 9, color: '#F0D9D9' },
  { label: '10–12', min: 10, max: 12, color: '#F4C0D1' },
  { label: '13–15', min: 13, max: 15, color: '#D4517E' },
  { label: '16–18', min: 16, max: 18, color: '#B03060' },
  { label: '19–20', min: 19, max: 20, color: '#7A1040' },
]

function openMaps(lieu: string) {
  const q = encodeURIComponent(lieu)
  const url = Platform.OS === 'ios' ? `maps:?q=${q}` : `https://maps.google.com/?q=${q}`
  Linking.openURL(url)
}

export default function Stats() {
  const [dates, setDates] = useState<DateRow[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('dates')
        .select('lieu, note_globale, date_du_date, categorie')
        .eq('user_id', user.id)
        .eq('statut', 'vecu')
        .not('note_globale', 'is', null)
        .order('date_du_date', { ascending: true })
      setDates((data ?? []) as DateRow[])
      setLoading(false)
    }
    load()
  }, [])

  const moyenne = dates.length > 0
    ? dates.reduce((s, d) => s + d.note_globale, 0) / dates.length
    : 0

  // Top lieux
  const lieuMap: Record<string, { total: number; count: number }> = {}
  for (const d of dates) {
    if (!lieuMap[d.lieu]) lieuMap[d.lieu] = { total: 0, count: 0 }
    lieuMap[d.lieu].total += d.note_globale
    lieuMap[d.lieu].count++
  }
  const topLieux = Object.entries(lieuMap)
    .map(([lieu, { total, count }]) => ({ lieu, moy: total / count, count }))
    .sort((a, b) => b.moy - a.moy)
    .slice(0, 5)

  // Meilleur jour de la semaine
  const jourMap: Record<number, { total: number; count: number }> = {}
  for (const d of dates) {
    const jour = new Date(d.date_du_date + 'T12:00:00').getDay()
    if (!jourMap[jour]) jourMap[jour] = { total: 0, count: 0 }
    jourMap[jour].total += d.note_globale
    jourMap[jour].count++
  }
  const meilleurJour = Object.entries(jourMap)
    .map(([jour, { total, count }]) => ({ jour: Number(jour), moy: total / count, count }))
    .sort((a, b) => b.moy - a.moy)[0]

  // Évolution mensuelle (6 derniers mois)
  const now = new Date()
  const moisData: { label: string; moy: number | null; count: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const datesInMonth = dates.filter((row) => {
      const rd = new Date(row.date_du_date + 'T12:00:00')
      return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth()
    })
    const moy = datesInMonth.length > 0
      ? datesInMonth.reduce((s, r) => s + r.note_globale, 0) / datesInMonth.length
      : null
    moisData.push({ label: MOIS_COURTS[d.getMonth()], moy, count: datesInMonth.length })
  }

  // Streak (semaines consécutives)
  let streak = 0
  const weekSet = new Set(dates.map((d) => {
    const dt = new Date(d.date_du_date + 'T12:00:00')
    const startOfWeek = new Date(dt)
    startOfWeek.setDate(dt.getDate() - dt.getDay())
    return startOfWeek.toISOString().slice(0, 10)
  }))
  const checkDate = new Date()
  while (true) {
    checkDate.setDate(checkDate.getDate() - checkDate.getDay())
    const key = checkDate.toISOString().slice(0, 10)
    if (weekSet.has(key)) { streak++; checkDate.setDate(checkDate.getDate() - 7) }
    else break
  }

  // Distribution des notes (histogram)
  const binCounts = NOTE_BINS.map((bin) => ({
    ...bin,
    count: dates.filter((d) => d.note_globale >= bin.min && d.note_globale <= bin.max).length,
  }))
  const maxBinCount = Math.max(...binCounts.map((b) => b.count), 1)

  // Catégorie favorite
  const catMap: Record<string, number> = {}
  for (const d of dates) {
    if (d.categorie) catMap[d.categorie] = (catMap[d.categorie] ?? 0) + 1
  }
  const catEntries = Object.entries(catMap).sort((a, b) => b[1] - a[1])
  const totalWithCat = catEntries.reduce((s, [, v]) => s + v, 0)

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ActivityIndicator color="#D4517E" style={{ marginTop: 60 }} size="large" />
      </SafeAreaView>
    )
  }

  if (dates.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={20} color="#D4517E" />
            <Text style={styles.back}>Retour</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Statistiques</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyText}>Pas encore de stats</Text>
          <Text style={styles.emptySubtext}>Note quelques dates pour voir tes statistiques ici</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color="#D4517E" />
          <Text style={styles.back}>Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Statistiques</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, webContentStyle]}>

        {/* Résumé */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{dates.length}</Text>
            <Text style={styles.summaryLabel}>dates vécus</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{moyenne.toFixed(1)}</Text>
            <Text style={styles.summaryLabel}>moyenne /20</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{streak}</Text>
            <Text style={styles.summaryLabel}>semaines streak</Text>
          </View>
        </View>

        {/* Évolution mensuelle */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Évolution (6 mois)</Text>
          <View style={styles.barChart}>
            {moisData.map((m, i) => (
              <View key={i} style={styles.barCol}>
                <Text style={styles.barValue}>{m.moy != null ? m.moy.toFixed(1) : ''}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { flex: m.moy != null ? m.moy / 20 : 0 }, m.moy != null && m.moy >= 15 && styles.barFillHigh]} />
                  {(m.moy == null || m.moy < 20) && <View style={{ flex: m.moy != null ? (20 - m.moy) / 20 : 1 }} />}
                </View>
                <Text style={styles.barLabel}>{m.label}</Text>
                {m.count > 0 && <Text style={styles.barCount}>{m.count}</Text>}
              </View>
            ))}
          </View>
        </View>

        {/* Distribution des notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Distribution des notes</Text>
          {binCounts.map((bin) => (
            <View key={bin.label} style={styles.histoRow}>
              <Text style={styles.histoLabel}>{bin.label}</Text>
              <View style={styles.histoTrack}>
                <View style={[styles.histoFill, { flex: bin.count / maxBinCount, backgroundColor: bin.color }]} />
                {bin.count < maxBinCount && <View style={{ flex: 1 - bin.count / maxBinCount }} />}
              </View>
              <Text style={styles.histoCount}>{bin.count}</Text>
            </View>
          ))}
        </View>

        {/* Catégories */}
        {catEntries.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Par catégorie</Text>
            {catEntries.map(([key, count]) => {
              const cat = CATEGORIES.find((c) => c.key === key)
              return (
                <View key={key} style={styles.histoRow}>
                  <Text style={styles.histoLabel}>{cat?.emoji ?? ''} {cat?.label ?? key}</Text>
                  <View style={styles.histoTrack}>
                    <View style={[styles.histoFill, { flex: count / (catEntries[0][1] || 1), backgroundColor: '#D4517E' }]} />
                    {count < catEntries[0][1] && <View style={{ flex: 1 - count / catEntries[0][1] }} />}
                  </View>
                  <Text style={styles.histoCount}>{count}</Text>
                </View>
              )
            })}
          </View>
        )}

        {/* Meilleur jour */}
        {meilleurJour && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Meilleur jour</Text>
            <View style={styles.jourRow}>
              {[0, 1, 2, 3, 4, 5, 6].map((j) => {
                const data = jourMap[j]
                const isBest = j === meilleurJour.jour
                return (
                  <View key={j} style={[styles.jourCard, isBest && styles.jourCardBest]}>
                    <Text style={[styles.jourLabel, isBest && styles.jourLabelBest]}>{JOURS[j]}</Text>
                    {data ? (
                      <Text style={[styles.jourCount, isBest && styles.jourCountBest]}>{data.count}</Text>
                    ) : (
                      <Text style={styles.jourEmpty}>—</Text>
                    )}
                  </View>
                )
              })}
            </View>
            <Text style={styles.jourCaption}>
              Tu sors le plus souvent le <Text style={styles.jourHighlight}>{JOURS[meilleurJour.jour]}</Text> (moy. {meilleurJour.moy.toFixed(1)}/20)
            </Text>
          </View>
        )}

        {/* Top lieux */}
        {topLieux.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top lieux</Text>
            {topLieux.map((l, i) => (
              <View key={i} style={styles.lieuRow}>
                <Text style={styles.lieuRank}>#{i + 1}</Text>
                <Text style={styles.lieuName} numberOfLines={1}>{l.lieu}</Text>
                <Text style={styles.lieuMoy}>{l.moy.toFixed(1)}/20</Text>
                {l.count > 1 && <Text style={styles.lieuCount}>{l.count}×</Text>}
                <TouchableOpacity onPress={() => openMaps(l.lieu)} style={styles.mapBtn}>
                  <Ionicons name="map-outline" size={16} color="#D4517E" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF8F5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0D9D9' },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 80 },
  back: { color: '#D4517E', fontSize: 16, fontWeight: '500' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#5C4A45' },
  content: { padding: 20, paddingBottom: 60 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#5C4A45', marginBottom: 6 },
  emptySubtext: { fontSize: 14, color: '#888', textAlign: 'center', paddingHorizontal: 40 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#F0D9D9' },
  summaryValue: { fontSize: 26, fontWeight: '800', color: '#D4517E' },
  summaryLabel: { fontSize: 11, color: '#888', marginTop: 2, textAlign: 'center' },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F0D9D9' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#5C4A45', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 120 },
  barCol: { flex: 1, alignItems: 'center', height: 120 },
  barValue: { fontSize: 9, color: '#888', marginBottom: 2 },
  barTrack: { flex: 1, width: '80%', flexDirection: 'column-reverse', backgroundColor: '#F0D9D9', borderRadius: 4, overflow: 'hidden' },
  barFill: { backgroundColor: '#D4517E', borderRadius: 4 },
  barFillHigh: { backgroundColor: '#2D6A2D' },
  barLabel: { fontSize: 10, color: '#888', marginTop: 4 },
  barCount: { fontSize: 9, color: '#B8A9A0' },
  histoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  histoLabel: { fontSize: 12, color: '#5C4A45', width: 70, fontWeight: '500' },
  histoTrack: { flex: 1, flexDirection: 'row', height: 14, backgroundColor: '#F0D9D9', borderRadius: 7, overflow: 'hidden' },
  histoFill: { borderRadius: 7 },
  histoCount: { fontSize: 12, color: '#888', width: 24, textAlign: 'right', fontWeight: '600' },
  jourRow: { flexDirection: 'row', gap: 4, marginBottom: 10 },
  jourCard: { flex: 1, backgroundColor: '#FFF8F5', borderRadius: 8, padding: 6, alignItems: 'center', borderWidth: 1, borderColor: '#F0D9D9' },
  jourCardBest: { backgroundColor: '#D4517E', borderColor: '#D4517E' },
  jourLabel: { fontSize: 10, color: '#888', fontWeight: '600', marginBottom: 2 },
  jourLabelBest: { color: '#fff' },
  jourCount: { fontSize: 14, fontWeight: '800', color: '#5C4A45' },
  jourCountBest: { color: '#fff' },
  jourEmpty: { fontSize: 12, color: '#D0C5C0' },
  jourCaption: { fontSize: 13, color: '#888', lineHeight: 18 },
  jourHighlight: { color: '#D4517E', fontWeight: '700' },
  lieuRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0D9D9', gap: 8 },
  lieuRank: { fontSize: 13, fontWeight: '700', color: '#D4517E', width: 24 },
  lieuName: { flex: 1, fontSize: 14, color: '#5C4A45', fontWeight: '500' },
  lieuMoy: { fontSize: 13, fontWeight: '700', color: '#D4517E' },
  lieuCount: { fontSize: 11, color: '#888', backgroundColor: '#F0D9D9', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  mapBtn: { padding: 4 },
})
