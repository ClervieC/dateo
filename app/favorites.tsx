import { useState, useCallback } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { formaterDate } from '../lib/dateUtils'
import { webContentStyle } from '../lib/webStyles'

type FavItem = {
  id: string
  date_id: string
  intitule: string | null
  lieu: string
  date_du_date: string
  note_globale: number
  username: string
}

export default function Favorites() {
  const [items, setItems] = useState<FavItem[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from('date_favorites')
      .select('id, date_id, dates(intitule, lieu, date_du_date, note_globale, profiles(username))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    setItems((data ?? []).map((f: any) => ({
      id: f.id,
      date_id: f.date_id,
      intitule: f.dates?.intitule ?? null,
      lieu: f.dates?.lieu ?? '',
      date_du_date: f.dates?.date_du_date ?? '',
      note_globale: f.dates?.note_globale ?? 0,
      username: f.dates?.profiles?.username ?? '?',
    })))
    setLoading(false)
  }, [])

  useFocusEffect(useCallback(() => { load() }, [load]))

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color="#D4517E" />
          <Text style={styles.back}>Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Favoris</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <ActivityIndicator color="#D4517E" style={{ marginTop: 60 }} size="large" />
      ) : (
        <FlatList
          contentContainerStyle={[styles.content, webContentStyle]}
          data={items}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔖</Text>
              <Text style={styles.emptyText}>Aucun favori pour l'instant</Text>
              <Text style={styles.emptySub}>Appuie sur le marque-page dans le feed pour sauvegarder un date</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/date/${item.date_id}`)}
              activeOpacity={0.88}
            >
              <View style={styles.cardHeader}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  {item.intitule ? (
                    <>
                      <Text style={styles.lieu}>{item.intitule}</Text>
                      <Text style={styles.lieuSub}>📍 {item.lieu}</Text>
                    </>
                  ) : (
                    <Text style={styles.lieu}>{item.lieu}</Text>
                  )}
                </View>
                <Text style={styles.note}>{item.note_globale}/20</Text>
              </View>
              <Text style={styles.meta}>@{item.username} · {formaterDate(item.date_du_date)}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF8F5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0D9D9' },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 60 },
  back: { color: '#D4517E', fontSize: 16, fontWeight: '500' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#5C4A45' },
  content: { padding: 20, paddingBottom: 60 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#F0D9D9' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 },
  lieu: { fontSize: 15, fontWeight: '600', color: '#5C4A45' },
  lieuSub: { fontSize: 12, color: '#888', marginTop: 2 },
  note: { fontSize: 15, fontWeight: '700', color: '#D4517E' },
  meta: { fontSize: 12, color: '#888' },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#5C4A45', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#888', textAlign: 'center', paddingHorizontal: 40, lineHeight: 18 },
})
