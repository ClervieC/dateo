import { useState, useCallback, useRef } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../lib/supabase'
import { formaterIlYa } from '../lib/dateUtils'
import { webContentStyle } from '../lib/webStyles'
import { NOTIF_LAST_SEEN_KEY, markNotificationsSeen } from '../lib/notifications'
import { ScreenHeader } from '../lib/ScreenHeader'
import { t, tn } from '../lib/i18n'

const NOTIF_READ_IDS_KEY = 'notifReadIds'

type NotifItem = {
  id: string
  type: 'reaction' | 'comment' | 'mention'
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
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<'all' | 'reaction' | 'comment' | 'mention'>('all')
  // Demandes d'ami / invitation couple en attente : affichées en tête, car elles
  // n'apparaissent pas dans la liste des likes / commentaires.
  const [pendingFriends, setPendingFriends] = useState(0)
  const [pendingCouple, setPendingCouple] = useState(false)
  const router = useRouter()
  const lastSeenAtOpenRef = useRef<string | null>(null)

  async function markRead(id: string) {
    setReadIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      AsyncStorage.setItem(NOTIF_READ_IDS_KEY, JSON.stringify([...next]))
      return next
    })
  }

  const loadNotifs = useCallback(async () => {
    setLoading(true)
    if (lastSeenAtOpenRef.current === null) {
      const stored = await AsyncStorage.getItem(NOTIF_LAST_SEEN_KEY)
      lastSeenAtOpenRef.current = stored ?? ''
      setLastSeen(stored)
      const storedReadIds = await AsyncStorage.getItem(NOTIF_READ_IDS_KEY)
      if (storedReadIds) setReadIds(new Set(JSON.parse(storedReadIds)))
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const [{ data: myProfile }, { count: friendReqCount }, { data: coupleInvite }] = await Promise.all([
      supabase.from('profiles').select('username').eq('id', user.id).single(),
      supabase.from('friends').select('*', { count: 'exact', head: true }).eq('friend_id', user.id).eq('status', 'pending'),
      supabase.from('couples').select('id').eq('user2_id', user.id).eq('status', 'pending').maybeSingle(),
    ])
    setPendingFriends(friendReqCount ?? 0)
    setPendingCouple(!!coupleInvite)

    const { data: myDates } = await supabase
      .from('dates')
      .select('id, lieu, intitule')
      .eq('user_id', user.id)

    const dateIds = (myDates ?? []).map((d: any) => d.id)
    const dateMap: Record<string, string> = {}
    for (const d of (myDates ?? []) as any[]) {
      dateMap[d.id] = (d.intitule ?? d.lieu) as string
    }

    const [{ data: reactions }, { data: comments }, { data: mentionComments }] = await Promise.all([
      dateIds.length > 0
        ? supabase.from('date_reactions')
            .select('id, date_id, user_id, created_at')
            .in('date_id', dateIds)
            .neq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(60)
        : Promise.resolve({ data: [] }),
      dateIds.length > 0
        ? supabase.from('date_comments')
            .select('id, date_id, user_id, content, created_at')
            .in('date_id', dateIds)
            .neq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(60)
        : Promise.resolve({ data: [] }),
      myProfile?.username
        ? supabase.from('date_comments')
            .select('id, date_id, user_id, content, created_at')
            .ilike('content', `%@${myProfile.username}%`)
            .neq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(60)
        : Promise.resolve({ data: [] }),
    ])

    const commentDateIds = [...new Set((mentionComments ?? []).map((c: any) => c.date_id))]
    const { data: mentionDates } = commentDateIds.length > 0
      ? await supabase.from('dates').select('id, lieu, intitule').in('id', commentDateIds)
      : { data: [] as any[] }
    for (const d of mentionDates ?? []) dateMap[(d as any).id] = ((d as any).intitule ?? (d as any).lieu) as string

    const commentIds = new Set((comments ?? []).map((c: any) => c.id))

    const userIds = [...new Set([
      ...(reactions ?? []).map((r: any) => r.user_id),
      ...(comments ?? []).map((c: any) => c.user_id),
      ...(mentionComments ?? []).map((c: any) => c.user_id),
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

    const mentionNotifs: NotifItem[] = (mentionComments ?? [])
      .filter((c: any) => !commentIds.has(c.id))
      .map((c: any) => ({
        id: `m_${c.id}`,
        type: 'mention',
        actor_username: profileMap[c.user_id] ?? '?',
        date_id: c.date_id,
        date_name: dateMap[c.date_id] ?? '',
        created_at: c.created_at,
        content: c.content,
      }))

    setNotifs(
      [...reactionNotifs, ...commentNotifs, ...mentionNotifs]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    )
    setLoading(false)
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadNotifs()
      return () => {
        markNotificationsSeen()
        lastSeenAtOpenRef.current = null
      }
    }, [loadNotifs])
  )

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader fallback="/(tabs)/feed" title={t("Notifications")} />

      <View style={[webContentStyle, { flexShrink: 0 }]}>
      {(pendingFriends > 0 || pendingCouple) && (
        <View style={styles.requestsBox}>
          {pendingFriends > 0 && (
            <TouchableOpacity style={styles.requestRow} onPress={() => router.push('/friends')}>
              <Ionicons name="person-add" size={18} color="#D4517E" />
              <Text style={styles.requestText}>
                {tn(pendingFriends, "{n} demande d'ami en attente", "{n} demandes d'ami en attente")}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#D4517E" />
            </TouchableOpacity>
          )}
          {pendingCouple && (
            <TouchableOpacity style={styles.requestRow} onPress={() => router.push('/couple')}>
              <Ionicons name="heart" size={18} color="#D4517E" />
              <Text style={styles.requestText}>{t("Invitation en mode couple à accepter")}</Text>
              <Ionicons name="chevron-forward" size={16} color="#D4517E" />
            </TouchableOpacity>
          )}
        </View>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {([
          { key: 'all', label: t("Toutes") },
          { key: 'reaction', label: t("❤️ Likes") },
          { key: 'comment', label: t("💬 Commentaires") },
          { key: 'mention', label: t("📣 Mentions") },
        ] as const).map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator color="#D4517E" style={{ marginTop: 60 }} size="large" />
      ) : (
        <FlatList
          contentContainerStyle={[styles.content, webContentStyle]}
          data={filter === 'all' ? notifs : notifs.filter((n) => n.type === filter)}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyText}>{t("Aucune notification")}</Text>
              <Text style={styles.emptySub}>{t("Les likes et commentaires sur tes dates apparaîtront ici")}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isUnread = (!lastSeen || item.created_at > lastSeen) && !readIds.has(item.id)
            return (
              <TouchableOpacity
                style={[styles.card, isUnread && styles.cardUnread]}
                onPress={() => { markRead(item.id); router.push(`/date/${item.date_id}`) }}
                activeOpacity={0.8}
              >
                {isUnread && <View style={styles.unreadDot} />}
                <View style={styles.iconCircle}>
                  <Ionicons
                    name={item.type === 'reaction' ? 'heart' : item.type === 'mention' ? 'at' : 'chatbubble'}
                    size={18}
                    color="#D4517E"
                  />
                </View>
                <View style={styles.body}>
                  <Text style={styles.notifText}>
                    <Text style={styles.actor}>@{item.actor_username}</Text>
                    {item.type === 'reaction' ? t(" a aimé ton date ") : item.type === 'mention' ? t(" t'a mentionné sur ") : t(" a commenté ton date ")}
                    <Text style={styles.dateName}>{item.date_name}</Text>
                  </Text>
                  {(item.type === 'comment' || item.type === 'mention') && item.content && (
                    <Text style={styles.preview} numberOfLines={1}>"{item.content}"</Text>
                  )}
                  <Text style={styles.time}>{formaterIlYa(item.created_at)}</Text>
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
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 2 },
  requestsBox: { marginHorizontal: 20, marginTop: 12, backgroundColor: '#FDE8F0', borderRadius: 12, overflow: 'hidden' },
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14 },
  requestText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#D4517E' },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#F0D9D9' },
  filterChipActive: { backgroundColor: '#D4517E', borderColor: '#D4517E' },
  filterChipText: { fontSize: 12, color: '#5C4A45', fontWeight: '500' },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },
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
