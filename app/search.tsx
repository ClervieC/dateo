import { useState, useRef } from 'react'
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { formaterDate, formatNote } from '../lib/dateUtils'
import { webContentStyle } from '../lib/webStyles'
import { ScreenHeader } from '../lib/ScreenHeader'
import { t } from '../lib/i18n'
import { C, themedStyles } from '../lib/theme'

type Result = {
  type: 'date' | 'user'
  id: string
  title: string
  subtitle: string
}

export default function Search() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  async function doSearch(q: string) {
    if (q.trim().length < 2) { setResults([]); return }
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const [{ data: dates }, { data: users }] = await Promise.all([
      supabase.from('dates')
        .select('id, intitule, lieu, date_du_date, note_globale, statut')
        .eq('user_id', user.id)
        .or(`intitule.ilike.%${q}%,lieu.ilike.%${q}%`)
        .order('date_du_date', { ascending: false })
        .limit(15),
      supabase.from('profiles')
        .select('id, username')
        .ilike('username', `%${q}%`)
        .neq('id', user.id)
        .limit(10),
    ])

    const dateResults: Result[] = (dates ?? []).map((d: any) => ({
      type: 'date',
      id: d.id,
      title: d.intitule ?? d.lieu,
      subtitle: `📍 ${d.lieu} · ${formaterDate(d.date_du_date)} · ${d.statut === 'planifie' || d.note_globale == null ? t("À venir") : `${formatNote(d.note_globale)}/20`}`,
    }))

    const userResults: Result[] = (users ?? []).map((u: any) => ({
      type: 'user',
      id: u.id,
      title: `@${u.username}`,
      subtitle: t("Voir son profil"),
    }))

    setResults([...dateResults, ...userResults])
    setLoading(false)
  }

  function handleChange(text: string) {
    setQuery(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(text), 350)
  }

  function handlePress(item: Result) {
    if (item.type === 'date') router.push(`/date/${item.id}`)
    else router.push(`/user/${item.id}`)
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader fallback="/(tabs)/profile" title={t("Recherche")} />

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={C.faint} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={handleChange}
          placeholder={t("Dates, lieux, utilisateurs...")}
          placeholderTextColor={C.faint}
          autoFocus
          clearButtonMode="while-editing"
        />
        {loading && <ActivityIndicator size="small" color={C.primary} />}
      </View>

      <FlatList
        contentContainerStyle={[styles.content, webContentStyle]}
        data={results}
        keyExtractor={(item) => `${item.type}_${item.id}`}
        ListEmptyComponent={
          query.length >= 2 && !loading ? (
            <Text style={styles.emptyText}>{t("Aucun résultat pour « {q} »", { q: query })}</Text>
          ) : query.length < 2 ? (
            <Text style={styles.hintText}>{t("Cherche parmi tes dates (lieu, intitulé) ou un pseudo")}</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.result} onPress={() => handlePress(item)} activeOpacity={0.8}>
            <View style={styles.resultIcon}>
              <Ionicons name={item.type === 'date' ? 'calendar-outline' : 'person-outline'} size={18} color={C.primary} />
            </View>
            <View style={styles.resultBody}>
              <Text style={styles.resultTitle}>{item.title}</Text>
              <Text style={styles.resultSub}>{item.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.borderStrong} />
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  )
}

const styles = themedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 60 },
  back: { color: C.primaryText, fontSize: 16, fontWeight: '500' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 16, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border },
  searchInput: { flex: 1, fontSize: 15, color: C.text, padding: 0 },
  content: { paddingHorizontal: 16, paddingBottom: 60 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  resultIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.primarySoft, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  resultBody: { flex: 1 },
  resultTitle: { fontSize: 15, fontWeight: '600', color: C.text },
  resultSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  emptyText: { textAlign: 'center', color: C.muted, marginTop: 32, fontSize: 14 },
  hintText: { textAlign: 'center', color: C.faint, marginTop: 40, fontSize: 14 },
}))
