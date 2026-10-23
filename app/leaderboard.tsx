import { useState, useCallback } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { webContentStyle } from '../lib/webStyles'
import { ScreenHeader } from '../lib/ScreenHeader'
import { t, tn } from '../lib/i18n'

type LeaderEntry = {
  id: string
  username: string
  avatar_url: string | null
  count: number
  moyenne: number
  isMe: boolean
}

const MEDALS = ['🥇', '🥈', '🥉']

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderEntry[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const [{ data: friendships }, { data: coupleRow }] = await Promise.all([
      supabase.from('friends').select('user_id, friend_id').or(`user_id.eq.${user.id},friend_id.eq.${user.id}`).eq('status', 'accepted'),
      supabase.from('couples').select('user1_id, user2_id').or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`).eq('status', 'accepted').maybeSingle(),
    ])
    const friendIds = (friendships ?? []).map((f: any) => f.user_id === user.id ? f.friend_id : f.user_id)
    const partnerIds: string[] = coupleRow
      ? [coupleRow.user1_id === user.id ? coupleRow.user2_id : coupleRow.user1_id]
      : []
    const allIds = [...new Set([user.id, ...friendIds, ...partnerIds])]

    const [{ data: allDates }, { data: profiles }] = await Promise.all([
      supabase.from('dates').select('user_id, note_globale').in('user_id', allIds).eq('statut', 'vecu'),
      supabase.from('profiles').select('id, username, avatar_url').in('id', allIds),
    ])

    const statsMap: Record<string, { sum: number; count: number }> = {}
    for (const d of allDates ?? []) {
      if (!statsMap[(d as any).user_id]) statsMap[(d as any).user_id] = { sum: 0, count: 0 }
      statsMap[(d as any).user_id].sum += (d as any).note_globale
      statsMap[(d as any).user_id].count += 1
    }

    const result: LeaderEntry[] = (profiles ?? []).map((p: any) => {
      const stats = statsMap[p.id] ?? { sum: 0, count: 0 }
      return {
        id: p.id,
        username: p.username,
        avatar_url: p.avatar_url ?? null,
        count: stats.count,
        moyenne: stats.count > 0 ? stats.sum / stats.count : 0,
        isMe: p.id === user.id,
      }
    })

    result.sort((a, b) => b.moyenne - a.moyenne || b.count - a.count)
    setEntries(result)
    setLoading(false)
  }, [])

  useFocusEffect(useCallback(() => { load() }, [load]))

  const ranked = entries.filter((e) => e.count > 0)
  const unranked = entries.filter((e) => e.count === 0)

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader fallback="/(tabs)/profile" title={t("Classement")} />

      {loading ? (
        <ActivityIndicator color="#D4517E" style={{ marginTop: 60 }} size="large" />
      ) : (
        <FlatList
          contentContainerStyle={[styles.content, webContentStyle]}
          data={ranked}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <Text style={styles.subtitle}>{t("Toi et tes amis, classés par note moyenne de vos dates")}</Text>
          }
          ListFooterComponent={
            unranked.length > 0 ? (
              <View>
                <Text style={styles.unrankedTitle}>{t("Pas encore classés")}</Text>
                {unranked.map((item) => (
                  <View key={item.id} style={[styles.row, styles.rowUnranked, item.isMe && styles.rowMe]}>
                    <Text style={styles.rank}>—</Text>
                    {item.avatar_url ? (
                      <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarInitial}>{item.username.charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={styles.info}>
                      <Text style={[styles.username, item.isMe && styles.usernameMe]}>
                        @{item.username}{item.isMe ? t(" (toi)") : ''}
                      </Text>
                      <Text style={styles.meta}>{t("Aucun date vécu pour l'instant")}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null
          }
          ListEmptyComponent={
            unranked.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>🏆</Text>
                <Text style={styles.emptyText}>{t("Ajoute des amis pour voir le classement")}</Text>
                <TouchableOpacity style={styles.emptyCta} onPress={() => router.push('/friends')}>
                  <Text style={styles.emptyCtaText}>{t("Trouver mes amis")}</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={[styles.row, item.isMe && styles.rowMe]}
              onPress={() => router.push(item.isMe ? '/(tabs)/profile' : `/user/${item.id}`)}
              activeOpacity={0.8}
            >
              <Text style={styles.rank}>{MEDALS[index] ?? `#${index + 1}`}</Text>
              {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>{item.username.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.info}>
                <Text style={[styles.username, item.isMe && styles.usernameMe]}>
                  @{item.username}{item.isMe ? t(" (toi)") : ''}
                </Text>
                <Text style={styles.meta}>{tn(item.count, "{n} date vécu", "{n} dates vécus")}</Text>
              </View>
              <Text style={styles.score}>{item.moyenne.toFixed(1)}/20</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF8F5' },
  emptyCta: { backgroundColor: '#D4517E', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, marginTop: 16 },
  emptyCtaText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0D9D9' },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 60 },
  back: { color: '#D4517E', fontSize: 16, fontWeight: '500' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#5C4A45' },
  content: { padding: 20, paddingBottom: 60 },
  subtitle: { fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#F0D9D9' },
  rowMe: { borderColor: '#D4517E', borderWidth: 1.5, backgroundColor: '#FFF4F7' },
  rowUnranked: { opacity: 0.6 },
  unrankedTitle: { fontSize: 13, fontWeight: '700', color: '#B8A9A0', marginTop: 8, marginBottom: 10 },
  rank: { fontSize: 22, width: 36, textAlign: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F0D9D9' },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FDE8F0', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 18, fontWeight: '700', color: '#D4517E' },
  info: { flex: 1 },
  username: { fontSize: 15, fontWeight: '600', color: '#5C4A45' },
  usernameMe: { color: '#D4517E' },
  meta: { fontSize: 12, color: '#888', marginTop: 2 },
  score: { fontSize: 18, fontWeight: '700', color: '#D4517E' },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 14, color: '#888', textAlign: 'center' },
})
