import { useState, useCallback } from 'react'
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { requeteValide, retirerDeLaListe } from '../lib/friendsUtils'
import { webContentStyle } from '../lib/webStyles'


type Profile = { id: string; username: string }
type FriendRequest = { id: string; user_id: string; friend_id: string; status: string; username: string }
type Friend = { id: string; username: string }

export default function Friends() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Profile[]>([])
  const [pending, setPending] = useState<FriendRequest[]>([])
  const [friends, setFriends] = useState<Friend[]>([])
  const [myId, setMyId] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setMyId(user.id)

    const [
      { data: pendingData },
      { data: sentFriends },
      { data: receivedFriends },
    ] = await Promise.all([
      supabase
        .from('friends')
        .select('id, user_id, friend_id, status')
        .eq('friend_id', user.id)
        .eq('status', 'pending'),
      supabase
        .from('friends')
        .select('id, friend_id')
        .eq('user_id', user.id)
        .eq('status', 'accepted'),
      supabase
        .from('friends')
        .select('id, user_id')
        .eq('friend_id', user.id)
        .eq('status', 'accepted'),
    ])

    // Récupère tous les usernames nécessaires en une seule requête
    const allUserIds = [
      ...(pendingData ?? []).map((d) => d.user_id),
      ...(sentFriends ?? []).map((d) => d.friend_id),
      ...(receivedFriends ?? []).map((d) => d.user_id),
    ]
    const uniqueIds = Array.from(new Set(allUserIds))

    const { data: profiles } = uniqueIds.length > 0
      ? await supabase.from('profiles').select('id, username').in('id', uniqueIds)
      : { data: [] }

    const usernameMap = new Map((profiles ?? []).map((p) => [p.id, p.username]))

    if (pendingData) {
      setPending(
        pendingData.map((d) => ({
          id: d.id,
          user_id: d.user_id,
          friend_id: d.friend_id,
          status: d.status,
          username: usernameMap.get(d.user_id) ?? 'Inconnu',
        }))
      )
    }

    setFriends([
      ...(sentFriends ?? []).map((f) => ({ id: f.id, username: usernameMap.get(f.friend_id) ?? 'Inconnu' })),
      ...(receivedFriends ?? []).map((f) => ({ id: f.id, username: usernameMap.get(f.user_id) ?? 'Inconnu' })),
    ])
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [loadData])
  )

  async function handleSearch(text: string) {
    setQuery(text)
    if (!requeteValide(text)) {
      setResults([])
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username')
      .ilike('username', `%${text}%`)
      .neq('id', myId)
      .limit(10)

    if (!error && data) setResults(data)
    setLoading(false)
  }
    
  async function sendRequest(friendId: string) {
    const { data: existing } = await supabase
      .from('friends')
      .select('id')
      .or(`and(user_id.eq.${myId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${myId})`)
      .maybeSingle()

    if (existing) {
      Alert.alert('Déjà en relation', 'Une demande existe déjà avec cette personne')
      setResults((prev) => prev.filter((r) => r.id !== friendId))
      return
    }

    const { error } = await supabase.from('friends').insert({ user_id: myId, friend_id: friendId })
    if (error) {
      Alert.alert('Erreur', error.message)
      return
    }

    setResults((prev) => prev.filter((r) => r.id !== friendId))
    sendFriendRequestNotification(friendId)
  }

  async function sendFriendRequestNotification(recipientId: string) {
    try {
      const [{ data: sender }, { data: recipient }] = await Promise.all([
        supabase.from('profiles').select('username').eq('id', myId).single(),
        supabase.from('profiles').select('expo_push_token').eq('id', recipientId).single(),
      ])

      const token = recipient?.expo_push_token
      if (!token) return

      await fetch('https://exp.host/push/send', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: token,
          title: '💌 Nouvelle demande d\'ami',
          body: `${sender?.username ?? 'Quelqu\'un'} veut être ton ami sur Dateo`,
          data: { screen: 'friends' },
        }),
      })
    } catch {
      // Notification silencieusement ignorée si l'utilisateur n'a pas de token
    }
  }
  
  async function acceptRequest(requestId: string) {
    await supabase.from('friends').update({ status: 'accepted' }).eq('id', requestId)
    loadData()
  }

  async function declineRequest(requestId: string) {
    await supabase.from('friends').delete().eq('id', requestId)
    loadData()
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={[styles.container, webContentStyle]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>‹ Retour</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Amis</Text>
          <View style={{ width: 50 }} />
        </View>

        <TextInput
          style={styles.input}
          placeholder="Chercher un pseudo..."
          placeholderTextColor="#B8A9A0"
          value={query}
          onChangeText={handleSearch}
          autoCapitalize="none"
        />

        {loading && <ActivityIndicator color="#D4517E" style={{ marginTop: 12 }} />}

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View>
              {friends.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Mes amis ({friends.length})</Text>
                  {friends.map((f) => (
                    <View key={f.id} style={styles.row}>
                      <Text style={styles.username}>{f.username}</Text>
                    </View>
                  ))}
                </View>
              )}

              {pending.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Demandes reçues</Text>
                  {pending.map((p) => (
                    <View key={p.id} style={styles.row}>
                      <Text style={styles.username}>{p.username}</Text>
                      <View style={styles.actionButtons}>
                        <TouchableOpacity style={styles.acceptButton} onPress={() => acceptRequest(p.id)}>
                          <Text style={styles.acceptText}>Accepter</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.declineButton} onPress={() => declineRequest(p.id)}>
                          <Text style={styles.declineText}>Refuser</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {query.length >= 2 && results.length > 0 && (
                <Text style={styles.sectionTitle}>Résultats</Text>
              )}
            </View>
          }
          contentContainerStyle={{ paddingTop: 12 }}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.username}>{item.username}</Text>
              <TouchableOpacity style={styles.addButton} onPress={() => sendRequest(item.id)}>
                <Text style={styles.addText}>Ajouter</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            query.length >= 2 && !loading ? (
              <Text style={styles.empty}>Aucun résultat</Text>
            ) : null
          }
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF8F5' },
  container: { flex: 1, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  back: { color: '#D4517E', fontSize: 15 },
  title: { fontSize: 18, fontWeight: '600', color: '#5C4A45' },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#F0D9D9', fontSize: 15 },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#5C4A45', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#F0D9D9' },
  username: { fontSize: 15, color: '#5C4A45', fontWeight: '500' },
  actionButtons: { flexDirection: 'row', gap: 8 },
  addButton: { backgroundColor: '#D4517E', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 14 },
  addText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  acceptButton: { backgroundColor: '#639922', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 14 },
  acceptText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  declineButton: { backgroundColor: '#F0D9D9', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 14 },
  declineText: { color: '#D4517E', fontWeight: '600', fontSize: 13 },
  empty: { color: '#888', textAlign: 'center', marginTop: 20 },
})
