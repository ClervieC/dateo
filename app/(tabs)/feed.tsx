import { useState, useCallback, useRef, useMemo } from 'react'
import { View, Text, FlatList, StyleSheet, Image, ScrollView, ActivityIndicator, TouchableOpacity, Animated, TextInput, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { NotificationBell } from '../../lib/NotificationBell'
import { supabase } from '../../lib/supabase'
import { webContentStyle } from '../../lib/webStyles'
import { formaterDate } from '../../lib/dateUtils'
import { toastStore } from '../../lib/toastStore'
import { feedBadgeStore } from '../../lib/feedBadgeStore'
import { CATEGORIES, getCategoryLabel } from '../../lib/categories'
import { PhotoViewer } from '../../lib/PhotoViewer'

const PAGE_SIZE = 20

type FeedItem = {
  id: string
  intitule: string | null
  lieu: string
  date_du_date: string
  note_globale: number
  commentaire: string | null
  user_id: string
  username: string
  avatar_url: string | null
  photos: string[]
  conseil_vivement: boolean
  statut: string
  categorie: string | null
  visibilite: string
  reactionCount: number
  myReaction: boolean
  commentCount: number
  participants: { id: string; username: string }[]
}

export default function Feed() {
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [myId, setMyId] = useState('')
  const [toastText, setToastText] = useState('')
  const [viewer, setViewer] = useState<{ photos: string[]; index: number } | null>(null)
  const [anniversaries, setAnniversaries] = useState<{ id: string; name: string }[]>([])
  const [feedSearch, setFeedSearch] = useState('')
  const [feedFilterCat, setFeedFilterCat] = useState<string | null>(null)
  const [myFavorites, setMyFavorites] = useState<Set<string>>(new Set())
  const allowedIdsRef = useRef<string[]>([])
  const partnerIdRef = useRef<string | null>(null)
  const pageRef = useRef(0)
  const toastAnim = useRef(new Animated.Value(0)).current
  const router = useRouter()

  function showToast(msg: string) {
    setToastText(msg)
    toastAnim.setValue(0)
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToastText(''))
  }

  async function fetchFriendIds(userId: string): Promise<string[]> {
    const [{ data: friendships }, { data: coupleRow }] = await Promise.all([
      supabase.from('friends').select('user_id, friend_id').or(`user_id.eq.${userId},friend_id.eq.${userId}`).eq('status', 'accepted'),
      supabase.from('couples').select('user1_id, user2_id').or(`user1_id.eq.${userId},user2_id.eq.${userId}`).eq('status', 'accepted').maybeSingle(),
    ])
    const friendIds = (friendships ?? []).map((f: any) => f.user_id === userId ? f.friend_id : f.user_id)
    const partnerIds: string[] = coupleRow
      ? [coupleRow.user1_id === userId ? coupleRow.user2_id : coupleRow.user1_id]
      : []
    partnerIdRef.current = partnerIds[0] ?? null
    return [...new Set([userId, ...friendIds, ...partnerIds])]
  }

  async function enrichWithCounts(
    dates: Omit<FeedItem, 'reactionCount' | 'myReaction' | 'commentCount'>[],
    userId: string,
  ): Promise<FeedItem[]> {
    if (dates.length === 0) return []
    const ids = dates.map((d) => d.id)

    const [{ data: reactions }, { data: commentRows }] = await Promise.all([
      supabase.from('date_reactions').select('date_id, user_id').in('date_id', ids),
      supabase.from('date_comments').select('date_id').in('date_id', ids),
    ])

    const reactionCounts: Record<string, number> = {}
    const mine = new Set<string>()
    for (const r of reactions ?? []) {
      reactionCounts[r.date_id] = (reactionCounts[r.date_id] ?? 0) + 1
      if (r.user_id === userId) mine.add(r.date_id)
    }

    const commentCounts: Record<string, number> = {}
    for (const c of commentRows ?? []) {
      commentCounts[c.date_id] = (commentCounts[c.date_id] ?? 0) + 1
    }

    return dates.map((d) => ({
      ...d,
      reactionCount: reactionCounts[d.id] ?? 0,
      myReaction: mine.has(d.id),
      commentCount: commentCounts[d.id] ?? 0,
    }))
  }

  async function fetchPage(allowedIds: string[], page: number, userId: string): Promise<FeedItem[]> {
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    const { data, error } = await supabase
      .from('dates')
      .select('id, intitule, lieu, date_du_date, note_globale, commentaire, user_id, conseil_vivement, statut, categorie, visibilite, profiles(username, avatar_url), date_photos(photo_url, ordre), date_participants(user_id, profiles(username))')
      .in('user_id', allowedIds)
      .eq('statut', 'vecu')
      .or(`user_id.eq.${userId}${partnerIdRef.current ? `,user_id.eq.${partnerIdRef.current}` : ''},visibilite.eq.friends,visibilite.is.null`)
      .order('date_du_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) { setLoadError(true); return [] }
    if (!data) return []

    const raw = data.map((d: any) => ({
      id: d.id,
      intitule: d.intitule ?? null,
      lieu: d.lieu,
      date_du_date: d.date_du_date,
      note_globale: d.note_globale,
      commentaire: d.commentaire,
      user_id: d.user_id,
      conseil_vivement: d.conseil_vivement ?? false,
      statut: d.statut ?? 'vecu',
      categorie: d.categorie ?? null,
      visibilite: d.visibilite ?? 'friends',
      username: d.profiles?.username ?? 'Quelqu\'un',
      avatar_url: d.profiles?.avatar_url ?? null,
      photos: (d.date_photos ?? [])
        .sort((a: any, b: any) => a.ordre - b.ordre)
        .map((p: any) => p.photo_url),
      participants: (d.date_participants ?? [])
        .filter((p: any) => p.profiles?.username)
        .map((p: any) => ({ id: p.user_id, username: p.profiles.username })),
    }))

    return enrichWithCounts(raw, userId)
  }

  const loadFeed = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    setHasMore(true)
    pageRef.current = 0

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setMyId(user.id)

    const ids = await fetchFriendIds(user.id)
    allowedIdsRef.current = ids

    const page = await fetchPage(ids, 0, user.id)
    setItems(page)
    if (page.length < PAGE_SIZE) setHasMore(false)
    setLoading(false)

    // Anniversaires : dates vécus il y a exactement 1 an (± 3 jours)
    const today = new Date()
    const yearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())
    const from = new Date(yearAgo); from.setDate(from.getDate() - 3)
    const to = new Date(yearAgo); to.setDate(to.getDate() + 3)
    const { data: annivData } = await supabase
      .from('dates')
      .select('id, lieu, intitule')
      .eq('user_id', user.id)
      .eq('statut', 'vecu')
      .gte('date_du_date', from.toISOString().slice(0, 10))
      .lte('date_du_date', to.toISOString().slice(0, 10))
    setAnniversaries((annivData ?? []).map((d: any) => ({ id: d.id, name: d.intitule ?? d.lieu })))

    const { data: favData } = await supabase.from('date_favorites').select('date_id').eq('user_id', user.id)
    setMyFavorites(new Set((favData ?? []).map((f: any) => f.date_id)))

    // Badge feed : marquer comme vu + calculer nouvelles dates depuis dernière visite
    const { data: profileData } = await supabase.from('profiles').select('last_feed_seen').eq('id', user.id).single()
    if (profileData?.last_feed_seen && ids.length > 1) {
      const { count } = await supabase.from('dates').select('*', { count: 'exact', head: true })
        .in('user_id', ids.filter((id) => id !== user.id))
        .eq('statut', 'vecu')
        .gt('created_at', profileData.last_feed_seen)
      feedBadgeStore.set(count ?? 0)
    }
    supabase.from('profiles').update({ last_feed_seen: new Date().toISOString() }).eq('id', user.id)
    feedBadgeStore.clear()
  }, [])

  async function loadMore() {
    if (loadingMore || !hasMore || allowedIdsRef.current.length === 0 || !myId) return
    setLoadingMore(true)
    pageRef.current += 1
    const page = await fetchPage(allowedIdsRef.current, pageRef.current, myId)
    if (page.length < PAGE_SIZE) setHasMore(false)
    setItems((prev) => [...prev, ...page])
    setLoadingMore(false)
  }

  useFocusEffect(
    useCallback(() => {
      loadFeed()
      const msg = toastStore.consume()
      if (msg) showToast(msg)
    }, [loadFeed])
  )

  async function toggleReaction(item: FeedItem) {
    if (!myId) return
    const optimistic = items.map((i) =>
      i.id !== item.id ? i : {
        ...i,
        myReaction: !i.myReaction,
        reactionCount: i.myReaction ? i.reactionCount - 1 : i.reactionCount + 1,
      }
    )
    setItems(optimistic)

    if (item.myReaction) {
      await supabase.from('date_reactions').delete().eq('date_id', item.id).eq('user_id', myId)
    } else {
      await supabase.from('date_reactions').insert({ date_id: item.id, user_id: myId })
      // Notifier le propriétaire du date
      const { data: { session } } = await supabase.auth.getSession()
      if (session && item.user_id !== myId) {
        const { data: me } = await supabase.from('profiles').select('username').eq('id', myId).single()
        fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/notify-reaction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ date_owner_id: item.user_id, reactor_username: me?.username, date_intitule: item.intitule ?? item.lieu }),
        })
      }
    }
  }

  async function toggleFavorite(dateId: string) {
    if (!myId) return
    const isFav = myFavorites.has(dateId)
    setMyFavorites((prev) => {
      const next = new Set(prev)
      if (isFav) next.delete(dateId)
      else next.add(dateId)
      return next
    })
    if (isFav) {
      await supabase.from('date_favorites').delete().eq('date_id', dateId).eq('user_id', myId)
    } else {
      await supabase.from('date_favorites').insert({ date_id: dateId, user_id: myId })
    }
  }

  function navigateToUser(userId: string) {
    if (userId === myId) {
      router.push('/(tabs)/profile')
    } else {
      router.push(`/user/${userId}`)
    }
  }

  const filteredItems = useMemo(() => {
    let result = items
    if (feedFilterCat) result = result.filter((i) => i.categorie === feedFilterCat)
    if (feedSearch.trim()) {
      const q = feedSearch.toLowerCase()
      result = result.filter((i) =>
        (i.intitule ?? '').toLowerCase().includes(q) ||
        i.lieu.toLowerCase().includes(q) ||
        i.username.toLowerCase().includes(q)
      )
    }
    return result
  }, [items, feedSearch, feedFilterCat])

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FlatList
        style={styles.container}
        contentContainerStyle={[styles.content, webContentStyle]}
        data={filteredItems}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Feed</Text>
              {Platform.OS !== 'web' && <NotificationBell style={styles.bellBtn} />}
            </View>

            {loadError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>Impossible de charger le feed. Vérifie ta connexion.</Text>
                <TouchableOpacity onPress={loadFeed}>
                  <Text style={styles.errorBannerRetry}>Réessayer</Text>
                </TouchableOpacity>
              </View>
            )}

            {anniversaries.length > 0 && (
              <TouchableOpacity
                style={styles.anniversaryBanner}
                onPress={() => router.push(`/date/${anniversaries[0].id}`)}
                activeOpacity={0.85}
              >
                <Text style={styles.anniversaryText}>
                  🎉 Il y a un an : {anniversaries[0].name}{anniversaries.length > 1 ? ` (+${anniversaries.length - 1})` : ''}
                </Text>
                <Ionicons name="chevron-forward" size={14} color="#D4517E" />
              </TouchableOpacity>
            )}

            <View style={styles.searchBar}>
              <Ionicons name="search" size={15} color="#B8A9A0" />
              <TextInput
                style={styles.searchInput}
                value={feedSearch}
                onChangeText={setFeedSearch}
                placeholder="Rechercher un lieu, un ami..."
                placeholderTextColor="#B8A9A0"
                clearButtonMode="while-editing"
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catFilterRow} contentContainerStyle={{ gap: 8, paddingRight: 12 }}>
              <TouchableOpacity
                style={[styles.catFilter, feedFilterCat === null && styles.catFilterActive]}
                onPress={() => setFeedFilterCat(null)}
              >
                <Text style={[styles.catFilterText, feedFilterCat === null && styles.catFilterTextActive]}>Tous</Text>
              </TouchableOpacity>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.catFilter, feedFilterCat === c.key && styles.catFilterActive]}
                  onPress={() => setFeedFilterCat(feedFilterCat === c.key ? null : c.key)}
                >
                  <Text style={[styles.catFilterText, feedFilterCat === c.key && styles.catFilterTextActive]}>{c.emoji} {c.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        }
        refreshing={refreshing}
        onRefresh={async () => { setRefreshing(true); await loadFeed(); setRefreshing(false) }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, item.conseil_vivement && styles.cardConseille]}
            onPress={() => router.push(`/date/${item.id}`)}
            activeOpacity={0.88}
          >
            {item.conseil_vivement && (
              <View style={styles.conseilBanner}>
                <Text style={styles.conseilBannerText}>💖 Conseillé vivement</Text>
              </View>
            )}
            <View style={styles.cardHeader}>
              <TouchableOpacity
                style={styles.userRow}
                onPress={() => navigateToUser(item.user_id)}
                activeOpacity={0.7}
              >
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitial}>{item.username.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <Text style={styles.username}>
                  {item.username}{item.user_id === myId ? ' · Toi' : ''}
                </Text>
              </TouchableOpacity>
              <Text style={styles.note}>{item.note_globale}/20</Text>
            </View>

            {item.intitule ? (
              <>
                <View style={styles.lieuRow}>
                  <Text style={styles.lieu}>{item.intitule}</Text>
                  {item.visibilite === 'private' && <Ionicons name="lock-closed" size={14} color="#B8A9A0" style={{ marginTop: 2 }} />}
                </View>
                <Text style={styles.lieuAddress}>📍 {item.lieu}</Text>
              </>
            ) : (
              <View style={styles.lieuRow}>
                <Text style={styles.lieu}>{item.lieu}</Text>
                {item.visibilite === 'private' && <Ionicons name="lock-closed" size={14} color="#B8A9A0" style={{ marginTop: 2 }} />}
              </View>
            )}
            <View style={styles.dateMeta}>
              <Text style={styles.date}>{formaterDate(item.date_du_date)}</Text>
              {item.categorie && (
                <View style={styles.catChip}>
                  <Text style={styles.catChipText}>{getCategoryLabel(item.categorie)}</Text>
                </View>
              )}
            </View>

            {item.participants.length > 0 && (
              <View style={styles.participantsRow}>
                <Text style={styles.participantsLabel}>👥 Avec</Text>
                {item.participants.map((p, idx) => (
                  <TouchableOpacity key={p.id} onPress={() => navigateToUser(p.id)}>
                    <Text style={styles.participantLink}>
                      @{p.username}{idx < item.participants.length - 1 ? ',' : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {item.photos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
                {item.photos.map((url, idx) => (
                  <TouchableOpacity key={idx} onPress={() => setViewer({ photos: item.photos, index: idx })} activeOpacity={0.9}>
                    <Image source={{ uri: url }} style={styles.feedPhoto} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {item.commentaire ? (
              <Text style={styles.comment}>{item.commentaire}</Text>
            ) : null}

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.reactionRow}
                onPress={() => toggleReaction(item)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={item.myReaction ? 'heart' : 'heart-outline'}
                  size={20}
                  color={item.myReaction ? '#D4517E' : '#B8A9A0'}
                />
                {item.reactionCount > 0 && (
                  <Text style={[styles.reactionCount, item.myReaction && styles.reactionCountActive]}>
                    {item.reactionCount}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.commentRow}
                onPress={() => router.push(`/date/${item.id}`)}
                activeOpacity={0.7}
              >
                <Ionicons name="chatbubble-outline" size={18} color="#B8A9A0" />
                {item.commentCount > 0 && (
                  <Text style={styles.commentCount}>{item.commentCount}</Text>
                )}
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={() => toggleFavorite(item.id)} activeOpacity={0.7}>
                <Ionicons
                  name={myFavorites.has(item.id) ? 'bookmark' : 'bookmark-outline'}
                  size={20}
                  color={myFavorites.has(item.id) ? '#D4517E' : '#B8A9A0'}
                />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color="#D4517E" style={{ marginVertical: 20 }} />
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>💌</Text>
              <Text style={styles.emptyText}>Aucun date dans ton feed</Text>
              <Text style={styles.emptySubtext}>Ajoute des amis pour voir leurs dates ici</Text>
              <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/friends')}>
                <Text style={styles.emptyButtonText}>Gérer mes amis</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />

      {toastText ? (
        <Animated.View style={[styles.toast, {
          opacity: toastAnim,
          transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
        }]}>
          <Text style={styles.toastText}>{toastText}</Text>
        </Animated.View>
      ) : null}

      {viewer && (
        <PhotoViewer
          photos={viewer.photos}
          initialIndex={viewer.index}
          visible
          onClose={() => setViewer(null)}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF8F5' },
  container: { flex: 1, backgroundColor: '#FFF8F5' },
  content: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 24, fontWeight: '600', color: '#D4517E' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  bellBtn: { padding: 4 },
  anniversaryBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FDE8F0', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 12, borderWidth: 1, borderColor: '#F4C0D1' },
  anniversaryText: { fontSize: 13, fontWeight: '600', color: '#D4517E', flex: 1 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#F0D9D9', gap: 8, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 14, color: '#5C4A45', padding: 0 },
  catFilterRow: { marginBottom: 16, flexGrow: 0, minWidth: 0 },
  errorBanner: { backgroundColor: '#FDE8DE', borderRadius: 10, padding: 12, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  errorBannerText: { color: '#993C1D', fontSize: 13, flex: 1 },
  errorBannerRetry: { color: '#D4517E', fontWeight: '700', fontSize: 13 },
  catFilter: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#F0D9D9' },
  catFilterActive: { backgroundColor: '#D4517E', borderColor: '#D4517E' },
  catFilterText: { fontSize: 12, color: '#5C4A45', fontWeight: '500' },
  catFilterTextActive: { color: '#fff', fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F0D9D9' },
  cardConseille: { borderColor: '#D4517E', borderWidth: 1.5 },
  conseilBanner: { backgroundColor: '#FDE8F0', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, marginBottom: 10, alignSelf: 'flex-start' },
  conseilBannerText: { fontSize: 12, fontWeight: '700', color: '#D4517E' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F0D9D9' },
  avatarPlaceholder: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FDE8F0', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 12, fontWeight: '700', color: '#D4517E' },
  username: { fontSize: 14, fontWeight: '600', color: '#D4517E' },
  note: { fontSize: 16, fontWeight: '700', color: '#D4517E' },
  lieuRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lieu: { fontSize: 16, fontWeight: '600', color: '#5C4A45', marginTop: 2 },
  lieuAddress: { fontSize: 12, color: '#888', marginTop: 1 },
  date: { fontSize: 12, color: '#888', marginTop: 2 },
  comment: { fontSize: 14, color: '#5C4A45', marginTop: 8, lineHeight: 20 },
  photoRow: { marginTop: 10, marginBottom: 4, minWidth: 0 },
  feedPhoto: { width: 160, height: 160, borderRadius: 10, marginRight: 8, backgroundColor: '#F0D9D9' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 16 },
  reactionRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  reactionCount: { fontSize: 13, color: '#B8A9A0', fontWeight: '600' },
  reactionCountActive: { color: '#D4517E' },
  commentRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  commentCount: { fontSize: 13, color: '#B8A9A0', fontWeight: '600' },
  dateMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  catChip: { backgroundColor: '#FDE8F0', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  participantsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  participantsLabel: { fontSize: 12, color: '#5C4A45' },
  participantLink: { fontSize: 12, color: '#D4517E', fontWeight: '600' },
  catChipText: { fontSize: 11, color: '#D4517E', fontWeight: '600' },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#5C4A45' },
  emptySubtext: { fontSize: 13, color: '#888', marginTop: 4, marginBottom: 20 },
  emptyButton: { backgroundColor: '#D4517E', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  emptyButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  toast: { position: 'absolute', bottom: 32, left: 24, right: 24, backgroundColor: '#2D6A2D', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.18, shadowOffset: { width: 0, height: 3 }, shadowRadius: 8, elevation: 6 },
  toastText: { color: '#fff', fontWeight: '600', fontSize: 15 },
})
