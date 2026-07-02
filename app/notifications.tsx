import { useState, useCallback, useRef } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../lib/supabase'
import { formaterDate } from '../lib/dateUtils'
import { webContentStyle } from '../lib/webStyles'

const LAST_SEEN_KEY = 'notifLastSeen'

type NotifItem = {
  id: string
  type: 'reaction' | 'comment'
  actor_username: string
  date_id: string
  date_name: string
  created_at: string
  content?: string
}

export default function Notifications() {
  const [notifs, setNotifs] = useState<NotifItem[]>([])
  const [loading, setLoading] = useState(true)
  const [lastSeen, setLastSeen] = useState<string | null>(null)
  const router = useRouter()
  const lastSeenAtOpenRef = useRef<string | null>(null)

  const loadNotifs = useCallback(async () => {
    setLoading(true)
    if (lastSeenAtOpenRef.current === null) {
      const stored = await AsyncStorage.getItem(LAST_SEEN_KEY)
      lastSeenAtOpenRef.current = stored ?? ''
      setLastSeen(stored)
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: myDates } = await supabase
      .from('dates')
      .select('id, lieu, intitule')
      .eq('user_id', user.id)

    if (!myDates || myDates.length === 0) { setLoading(false); return }

    const dateIds = myDates.map((d: any) => d.id)
    const dateMap: Record<string, string> = {}
    for (const d of myDates as any[]) {
      dateMap[d.id] = (d.intitule ?? d.lieu) as string
    }

    const [{ data: reactions }, { data: comments }] = await Promise.all([
      supabase.from('date_reactions')
        .select('id, date_id, user_id, created_at')
        .in('date_id', dateIds)
        .neq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(60),
      supabase.from('date_comments')
        .select('id, date_id, user_id, content, created_at')
        .in('date_id', dateIds)
        .neq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(60),
    ])

    const userIds = [...new Set([
      ...(reactions ?? []).map((r: any) => r.user_id),
      ...(comments ?? []).map((c: any) => c.user_id),
    ])]

    const { data: profiles } = await supabase
      .from('profiles').select('id, username').in('id', userIds)

    const profileMap: Record<string, string> = {}
    for (const p of profiles ?? []) profileMap[(p as any).id] = (p as any).username

    const reactionNotifs: NotifItem[] = (reactions ?? []).map((r: any) => ({
      id: `r_${r.id}`,
      type: 'reaction',
      actor_username: profileMap[r.user_id] ?? '?',
      date_id: r.date_id,
      date_name: dateMap[r.date_id] ?? '',
      created_at: r.created_at,
    }))

    const commentNotifs: NotifItem[] = (comments ?? []).map((c: any) => ({
      id: `c_${c.id}`,
      type: 'comment',
      actor_username: profileMap[c.user_id] ?? '?',
      date_id: c.date_id,
      date_name: dateMap[c.date_id] ?? '',
      created_at: c.created_at,
      content: c.content,
    }))

    setNotifs(
      [...reactionNotifs, ...commentNotifs]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    )
    setLoading(false)
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadNotifs()
      return () => {
        AsyncStorage.setItem(LAST_SEEN_KEY, new Date().toISOString())
        lastSeenAtOpenRef.current = null
      }
    }, [loadNotifs])
  )

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color="#D4517E" />
          <Text style={styles.back}>Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 80 }} />
      </View>

      {loading ? (
        <ActivityIndicator color="#D4517E" style={{ marginTop: 60 }} size="large" />
      ) : (
        <FlatList
          contentContainerStyle={[styles.content, webContentStyle]}
          data={notifs}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyText}>Aucune notification</Text>
              <Text style={styles.emptySub}>Les likes et commentaires sur tes dates apparaîtront ici</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isUnread = !lastSeen || item.created_at > lastSeen
            return (
              <TouchableOpacity
                style={[styles.card, isUnread && styles.cardUnread]}
                onPress={() => router.push(`/date/${item.date_id}`)}
                activeOpacity={0.8}
              >
                {isUnread && <View style={styles.unreadDot} />}
                <View style={styles.iconCircle}>
                  <Ionicons
                    name={item.type === 'reaction' ? 'heart' : 'chatbubble'}
                    size={18}
                    color="#D4517E"
                  />
                </View>
                <View style={styles.body}>
                  <Text style={styles.notifText}>
                    <Text style={styles.actor}>@{item.actor_username}</Text>
                    {item.type === 'reaction' ? ' a aimé ton date ' : ' a commenté ton date '}
                    <Text style={styles.dateName}>{item.date_name}</Text>
                  </Text>
                  {item.type === 'comment' && item.content && (
                    <Text style={styles.preview} numberOfLines={1}>"{item.content}"</Text>
                  )}
                  <Text style={styles.time}>{formaterDate(item.created_at.slice(0, 10))}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#D0C5C0" />
              </TouchableOpacity>
            )
          }}
        />
      )}
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
  empty: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#5C4A45', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#888', textAlign: 'center', paddingHorizontal: 40, lineHeight: 18 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#F0D9D9', gap: 12 },
  cardUnread: { backgroundColor: '#FFF8FA', borderColor: '#F4C0D1' },
  unreadDot: { position: 'absolute', top: 12, left: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: '#D4517E' },
  iconCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FDE8F0', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  body: { flex: 1 },
  notifText: { fontSize: 14, color: '#5C4A45', lineHeight: 20 },
  actor: { fontWeight: '700', color: '#D4517E' },
  dateName: { fontWeight: '600' },
  preview: { fontSize: 13, color: '#888', marginTop: 2, fontStyle: 'italic' },
  time: { fontSize: 11, color: '#B8A9A0', marginTop: 4 },
})
