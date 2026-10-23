import { useState, useCallback, useRef, ReactNode } from 'react'
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Share, Image } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { requeteValide } from '../lib/friendsUtils'
import { webContentStyle } from '../lib/webStyles'
import { showAlert, confirmAction } from '../lib/alert'
import { ScreenHeader } from '../lib/ScreenHeader'
import { t } from '../lib/i18n'
import { C, themedStyles } from '../lib/theme'

type Person = { id: string; username: string; avatar_url: string | null }
// rowId = id de la ligne « friends », userId = l'autre personne
type Relation = Person & { rowId: string }
type RelationStatus = 'friend' | 'sent' | 'received' | 'none'

export default function Friends() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Person[]>([])
  const [received, setReceived] = useState<Relation[]>([])
  const [sent, setSent] = useState<Relation[]>([])
  const [friends, setFriends] = useState<Relation[]>([])
  const [myId, setMyId] = useState('')
  const [myUsername, setMyUsername] = useState('')
  const [searching, setSearching] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setMyId(user.id)

    const [{ data: rows }, { data: me }] = await Promise.all([
      supabase
        .from('friends')
        .select('id, user_id, friend_id, status')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`),
      supabase.from('profiles').select('username').eq('id', user.id).single(),
    ])
    setMyUsername(me?.username ?? '')

    const otherIds = [...new Set((rows ?? []).map((r) => r.user_id === user.id ? r.friend_id : r.user_id))]
    const { data: profiles } = otherIds.length > 0
      ? await supabase.from('profiles').select('id, username, avatar_url').in('id', otherIds)
      : { data: [] as Person[] }
    const byId = new Map((profiles ?? []).map((p: any) => [p.id, p as Person]))

    const toRelation = (r: any): Relation => {
      const otherId = r.user_id === user.id ? r.friend_id : r.user_id
      const p = byId.get(otherId)
      return { rowId: r.id, id: otherId, username: p?.username ?? t("Inconnu"), avatar_url: p?.avatar_url ?? null }
    }
    const all = rows ?? []
    setFriends(all.filter((r) => r.status === 'accepted').map(toRelation).sort((a, b) => a.username.localeCompare(b.username)))
    setReceived(all.filter((r) => r.status === 'pending' && r.friend_id === user.id).map(toRelation))
    setSent(all.filter((r) => r.status === 'pending' && r.user_id === user.id).map(toRelation))
  }, [])

  useFocusEffect(useCallback(() => { loadData() }, [loadData]))

  function statusOf(personId: string): RelationStatus {
    if (friends.some((f) => f.id === personId)) return 'friend'
    if (sent.some((f) => f.id === personId)) return 'sent'
    if (received.some((f) => f.id === personId)) return 'received'
    return 'none'
  }

  async function doSearch(text: string) {
    if (!requeteValide(text)) { setResults([]); setSearching(false); return }
    setSearching(true)
    const pattern = `%${text.trim().replace(/[%_]/g, (c) => `\\${c}`)}%`
    const [{ data, error }, { data: blockedByMe }, { data: blockedMe }] = await Promise.all([
      supabase.from('profiles').select('id, username, avatar_url').ilike('username', pattern).neq('id', myId).limit(15),
      supabase.from('user_blocks').select('blocked_id').eq('blocker_id', myId),
      supabase.from('user_blocks').select('blocker_id').eq('blocked_id', myId),
    ])
    const blocked = new Set([
      ...(blockedByMe ?? []).map((b: any) => b.blocked_id),
      ...(blockedMe ?? []).map((b: any) => b.blocker_id),
    ])
    if (!error && data) setResults((data as Person[]).filter((p) => !blocked.has(p.id) && p.username))
    setSearching(false)
  }

  function handleSearch(text: string) {
    setQuery(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (requeteValide(text)) setSearching(true)
    debounceRef.current = setTimeout(() => doSearch(text), 350)
  }

  async function sendRequest(person: Person) {
    setBusyId(person.id)
    const { error } = await supabase.from('friends').insert({ user_id: myId, friend_id: person.id })
    setBusyId(null)
    if (error) {
      showAlert(t("Impossible d'envoyer la demande"), error.code === '23505' ? t("Une demande existe déjà avec cette personne.") : error.message)
      loadData()
      return
    }
    sendFriendRequestNotification(person.id)
    await loadData()
  }

  async function sendFriendRequestNotification(recipientId: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      // Le token push de destinataire n'est jamais lu côté client : la edge function
      // vérifie qu'une ligne "friends" justifie la notification avant de l'envoyer.
      await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/notify-social`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ recipient_id: recipientId, type: 'friend_request' }),
      })
    } catch {
      // Notification silencieusement ignorée en cas d'échec réseau
    }
  }

  async function acceptRequest(rel: Relation) {
    setBusyId(rel.id)
    await supabase.from('friends').update({ status: 'accepted' }).eq('id', rel.rowId)
    await loadData()
    setBusyId(null)
  }

  async function deleteRow(rel: Relation) {
    setBusyId(rel.id)
    await supabase.from('friends').delete().eq('id', rel.rowId)
    await loadData()
    setBusyId(null)
  }

  function confirmRemove(rel: Relation) {
    confirmAction(t("Retirer @{username} de tes amis ?", { username: rel.username }), t("Vous ne verrez plus les dates partagés l'un de l'autre."), t("Retirer"), () => deleteRow(rel))
  }

  function inviteFriends() {
    Share.share({ message: t("Rejoins-moi sur Dateo pour partager nos meilleurs dates ! Mon pseudo : @{username}", { username: myUsername }) })
  }

  function Avatar({ person }: { person: Person }) {
    return person.avatar_url
      ? <Image source={{ uri: person.avatar_url }} style={styles.avatar} />
      : (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarInitial}>{person.username.charAt(0).toUpperCase()}</Text>
        </View>
      )
  }

  function PersonRow({ person, children }: { person: Person; children?: ReactNode }) {
    return (
      <View style={styles.row}>
        <TouchableOpacity style={styles.personTap} onPress={() => router.push(`/user/${person.id}`)} activeOpacity={0.7}>
          <Avatar person={person} />
          <Text style={styles.username} numberOfLines={1}>@{person.username}</Text>
        </TouchableOpacity>
        {busyId === person.id ? <ActivityIndicator color={C.primary} /> : children}
      </View>
    )
  }

  const isSearching = requeteValide(query)

  function renderSearchAction(person: Person) {
    const status = statusOf(person.id)
    if (status === 'friend') return <Text style={styles.statusText}>{t("✓ Ami")}</Text>
    if (status === 'sent') return <Text style={styles.statusText}>{t("Demande envoyée")}</Text>
    if (status === 'received') {
      const rel = received.find((r) => r.id === person.id)!
      return (
        <TouchableOpacity style={styles.acceptButton} onPress={() => acceptRequest(rel)}>
          <Text style={styles.acceptText}>{t("Accepter")}</Text>
        </TouchableOpacity>
      )
    }
    return (
      <TouchableOpacity style={styles.addButton} onPress={() => sendRequest(person)}>
        <Text style={styles.addText}>{t("Ajouter")}</Text>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title={t("Amis")} fallback="/(tabs)/profile" />
      <View style={[styles.container, webContentStyle]}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={C.faint} />
          <TextInput
            style={styles.searchInput}
            placeholder={t("Chercher un pseudo…")}
            placeholderTextColor={C.faint}
            value={query}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searching ? <ActivityIndicator size="small" color={C.primary} /> : query ? (
            <TouchableOpacity onPress={() => handleSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel={t("Effacer")}>
              <Ionicons name="close-circle" size={18} color={C.faint} />
            </TouchableOpacity>
          ) : null}
        </View>

        {isSearching ? (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 40 }}
            renderItem={({ item }) => <PersonRow person={item}>{renderSearchAction(item)}</PersonRow>}
            ListEmptyComponent={!searching ? (
              <View style={styles.emptyBox}>
                <Text style={styles.empty}>{t("Aucun pseudo ne correspond à « {q} »", { q: query.trim() })}</Text>
                <TouchableOpacity onPress={inviteFriends}>
                  <Text style={styles.link}>{t("Inviter quelqu'un sur Dateo")}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          />
        ) : (
          <FlatList
            data={friends}
            keyExtractor={(item) => item.rowId}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 40 }}
            ListHeaderComponent={
              <View>
                {received.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t("Demandes reçues")} ({received.length})</Text>
                    {received.map((r) => (
                      <PersonRow key={r.rowId} person={r}>
                        <View style={styles.actionButtons}>
                          <TouchableOpacity style={styles.acceptButton} onPress={() => acceptRequest(r)}>
                            <Text style={styles.acceptText}>{t("Accepter")}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.declineButton} onPress={() => deleteRow(r)}>
                            <Text style={styles.declineText}>{t("Refuser")}</Text>
                          </TouchableOpacity>
                        </View>
                      </PersonRow>
                    ))}
                  </View>
                )}

                {sent.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t("Demandes envoyées")}</Text>
                    {sent.map((r) => (
                      <PersonRow key={r.rowId} person={r}>
                        <TouchableOpacity onPress={() => deleteRow(r)}>
                          <Text style={styles.removeText}>{t("Annuler")}</Text>
                        </TouchableOpacity>
                      </PersonRow>
                    ))}
                  </View>
                )}

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t("Mes amis")}{friends.length > 0 ? ` (${friends.length})` : ''}</Text>
                </View>
              </View>
            }
            renderItem={({ item }) => (
              <PersonRow person={item}>
                <TouchableOpacity onPress={() => confirmRemove(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.removeText}>{t("Retirer")}</Text>
                </TouchableOpacity>
              </PersonRow>
            )}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>👫</Text>
                <Text style={styles.emptyTitle}>{t("Pas encore d'amis sur Dateo")}</Text>
                <Text style={styles.empty}>{t("Cherche leur pseudo ci-dessus, ou invite-les à te rejoindre.")}</Text>
                <TouchableOpacity style={styles.inviteButton} onPress={inviteFriends}>
                  <Ionicons name="share-social-outline" size={16} color={C.onPrimary} />
                  <Text style={styles.inviteText}>{t("Inviter des amis")}</Text>
                </TouchableOpacity>
              </View>
            }
            ListFooterComponent={friends.length > 0 ? (
              <TouchableOpacity style={styles.inviteFooter} onPress={inviteFriends}>
                <Ionicons name="share-social-outline" size={16} color={C.primary} />
                <Text style={styles.link}>{t("Inviter d'autres amis")}</Text>
              </TouchableOpacity>
            ) : null}
          />
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = themedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: C.border },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: C.text, minWidth: 0 },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: C.faint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, backgroundColor: C.card, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border, minHeight: 56 },
  personTap: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.border },
  avatarPlaceholder: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.primarySoft, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 14, fontWeight: '700', color: C.primaryText },
  username: { fontSize: 15, color: C.text, fontWeight: '600', flexShrink: 1 },
  actionButtons: { flexDirection: 'row', gap: 8 },
  addButton: { backgroundColor: C.primary, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14 },
  addText: { color: C.onPrimary, fontWeight: '700', fontSize: 13 },
  acceptButton: { backgroundColor: C.success, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12 },
  acceptText: { color: C.onPrimary, fontWeight: '700', fontSize: 13 },
  declineButton: { backgroundColor: C.border, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12 },
  declineText: { color: C.primaryText, fontWeight: '600', fontSize: 13 },
  statusText: { color: C.muted, fontSize: 13, fontWeight: '500' },
  removeText: { color: C.faint, fontSize: 13, fontWeight: '600' },
  emptyBox: { alignItems: 'center', marginTop: 24, paddingHorizontal: 16 },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 4 },
  empty: { color: C.muted, textAlign: 'center', fontSize: 13, lineHeight: 19, marginBottom: 12 },
  link: { color: C.primaryText, fontWeight: '600', fontSize: 14 },
  inviteButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20 },
  inviteText: { color: C.onPrimary, fontWeight: '700', fontSize: 15 },
  inviteFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16 },
}))
