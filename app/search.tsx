import { useState, useRef } from 'react'
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { formaterDate } from '../lib/dateUtils'
import { webContentStyle } from '../lib/webStyles'

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
        .select('id, intitule, lieu, date_du_date, note_globale')
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
      subtitle: `📍 ${d.lieu} · ${formaterDate(d.date_du_date)} · ${d.note_globale}/20`,
    }))

    const userResults: Result[] = (users ?? []).map((u: any) => ({
      type: 'user',
      id: u.id,
      title: `@${u.username}`,
      subtitle: 'Utilisateur',
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color="#D4517E" />
          <Text style={styles.back}>Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recherche</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#B8A9A0" />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={handleChange}
          placeholder="Dates, lieux, utilisateurs..."
          placeholderTextColor="#B8A9A0"
          autoFocus
          clearButtonMode="while-editing"
        />
        {loading && <ActivityIndicator size="small" color="#D4517E" />}
      </View>

      <FlatList
        contentContainerStyle={[styles.content, webContentStyle]}
        data={results}
        keyExtractor={(item) => `${item.type}_${item.id}`}
        ListEmptyComponent={
          query.length >= 2 && !loading ? (
            <Text style={styles.emptyText}>Aucun résultat pour "{query}"</Text>
          ) : query.length < 2 ? (
            <Text style={styles.hintText}>Tape au moins 2 caractères pour chercher</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.result} onPress={() => handlePress(item)} activeOpacity={0.8}>
            <View style={styles.resultIcon}>
              <Ionicons name={item.type === 'date' ? 'calendar-outline' : 'person-outline'} size={18} color="#D4517E" />
            </View>
            <View style={styles.resultBody}>
              <Text style={styles.resultTitle}>{item.title}</Text>
              <Text style={styles.resultSub}>{item.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#D0C5C0" />
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF8F5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0D9D9' },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 60 },
  back: { color: '#D4517E', fontSize: 16, fontWeight: '500' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#5C4A45' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 16, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#F0D9D9' },
  searchInput: { flex: 1, fontSize: 15, color: '#5C4A45', padding: 0 },
  content: { paddingHorizontal: 16, paddingBottom: 60 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#F0D9D9' },
  resultIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FDE8F0', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  resultBody: { flex: 1 },
  resultTitle: { fontSize: 15, fontWeight: '600', color: '#5C4A45' },
  resultSub: { fontSize: 12, color: '#888', marginTop: 2 },
  emptyText: { textAlign: 'center', color: '#888', marginTop: 32, fontSize: 14 },
  hintText: { textAlign: 'center', color: '#B8A9A0', marginTop: 40, fontSize: 14 },
})
