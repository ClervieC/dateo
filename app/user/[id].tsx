import { useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Image, Share } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { formaterDate } from '../../lib/dateUtils'
import { webContentStyle } from '../../lib/webStyles'
import { PhotoViewer } from '../../lib/PhotoViewer'

type DateRow = {
  id: string
  intitule: string | null
  lieu: string
  date_du_date: string
  note_globale: number
  commentaire: string | null
  conseil_vivement: boolean
  photos: string[]
}

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [dates, setDates] = useState<DateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [viewer, setViewer] = useState<{ photos: string[]; index: number } | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!id) return
    loadProfile(id)
  }, [id])

  async function loadProfile(userId: string) {
    setLoading(true)

    const [{ data: profileData }, { data: datesData }] = await Promise.all([
      supabase.from('profiles').select('username, avatar_url').eq('id', userId).single(),
      supabase
        .from('dates')
        .select('id, intitule, lieu, date_du_date, note_globale, commentaire, conseil_vivement, date_photos(photo_url, ordre)')
        .eq('user_id', userId)
        .order('date_du_date', { ascending: false })
        .order('created_at', { ascending: false }),
    ])

    if (profileData) {
      setUsername(profileData.username)
      setAvatarUrl(profileData.avatar_url ?? null)
    }
    if (datesData) {
      setDates(datesData.map((d: any) => ({
        id: d.id,
        intitule: d.intitule ?? null,
        lieu: d.lieu,
        date_du_date: d.date_du_date,
        note_globale: d.note_globale,
        commentaire: d.commentaire,
        conseil_vivement: d.conseil_vivement ?? false,
        photos: (d.date_photos ?? [])
          .sort((a: any, b: any) => a.ordre - b.ordre)
          .map((p: any) => p.photo_url),
      })))
    }

    setLoading(false)
  }

  const moyenne = dates.length > 0
    ? (dates.reduce((s, d) => s + d.note_globale, 0) / dates.length).toFixed(1)
    : null
  const meilleurLieu = dates.length > 0
    ? dates.reduce((best, d) => (d.note_globale > best.note_globale ? d : best)).lieu
    : null

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color="#D4517E" />
          <Text style={styles.back}>Retour</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Share.share({ message: `Regarde le profil de @${username} sur Dateo !` })} style={styles.shareBtn}>
          <Ionicons name="share-outline" size={22} color="#D4517E" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#D4517E" style={{ marginTop: 60 }} size="large" />
      ) : (
        <FlatList
          contentContainerStyle={[styles.content, webContentStyle]}
          data={dates}
          keyExtractor={(item) => item.id}
          refreshing={loading}
          onRefresh={() => id && loadProfile(id)}
          ListHeaderComponent={
            <View>
              <View style={styles.profileAvatarRow}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.profileAvatar} />
                ) : (
                  <View style={styles.profileAvatarPlaceholder}>
                    <Text style={styles.profileAvatarInitial}>{username.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <Text style={styles.username}>@{username}</Text>
              </View>

              {dates.length > 0 && (
                <View style={styles.statsRow}>
                  <View style={styles.stat}>
                    <Text style={styles.statValue}>{dates.length}</Text>
                    <Text style={styles.statLabel}>dates</Text>
                  </View>
                  {moyenne && (
                    <View style={styles.stat}>
                      <Text style={styles.statValue}>{moyenne}</Text>
                      <Text style={styles.statLabel}>moyenne</Text>
                    </View>
                  )}
                  {meilleurLieu && (
                    <View style={[styles.stat, { flex: 2 }]}>
                      <Text style={styles.statValue} numberOfLines={1}>{meilleurLieu}</Text>
                      <Text style={styles.statLabel}>meilleur lieu</Text>
                    </View>
                  )}
                </View>
              )}

              <Text style={styles.sectionTitle}>{dates.length} date{dates.length !== 1 ? 's' : ''}</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Aucun date visible</Text>
              <Text style={styles.emptySubtext}>Cette personne n'a pas encore noté de dates ou ils ne sont pas visibles pour toi</Text>
            </View>
          }
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
                <View style={{ flex: 1, marginRight: 8 }}>
                  {item.intitule ? (
                    <>
                      <Text style={styles.lieu}>{item.intitule}</Text>
                      <Text style={styles.lieuAddress}>📍 {item.lieu}</Text>
                    </>
                  ) : (
                    <Text style={styles.lieu}>{item.lieu}</Text>
                  )}
                </View>
                <Text style={styles.note}>{item.note_globale}/20</Text>
              </View>
              <Text style={styles.date}>{formaterDate(item.date_du_date)}</Text>

              {item.photos.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
                  {item.photos.map((url, idx) => (
                    <TouchableOpacity key={idx} onPress={() => setViewer({ photos: item.photos, index: idx })} activeOpacity={0.9}>
                      <Image source={{ uri: url }} style={styles.photo} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {item.commentaire ? (
                <Text style={styles.comment}>{item.commentaire}</Text>
              ) : null}
            </TouchableOpacity>
          )}
        />
      )}

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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  shareBtn: { padding: 4 },
  back: { color: '#D4517E', fontSize: 16, fontWeight: '500' },
  content: { padding: 20, paddingBottom: 60 },
  profileAvatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  profileAvatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#F0D9D9' },
  profileAvatarPlaceholder: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FDE8F0', justifyContent: 'center', alignItems: 'center' },
  profileAvatarInitial: { fontSize: 24, fontWeight: '700', color: '#D4517E' },
  username: { fontSize: 24, fontWeight: '700', color: '#5C4A45' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  stat: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#F0D9D9' },
  statValue: { fontSize: 18, fontWeight: '700', color: '#D4517E' },
  statLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#5C4A45', marginBottom: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F0D9D9' },
  cardConseille: { borderColor: '#D4517E', borderWidth: 1.5 },
  conseilBanner: { backgroundColor: '#FDE8F0', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10, marginBottom: 8, alignSelf: 'flex-start' },
  conseilBannerText: { fontSize: 12, fontWeight: '700', color: '#D4517E' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  lieu: { fontSize: 16, fontWeight: '600', color: '#5C4A45' },
  lieuAddress: { fontSize: 12, color: '#888', marginTop: 1 },
  note: { fontSize: 16, fontWeight: '700', color: '#D4517E' },
  date: { fontSize: 12, color: '#888' },
  photoRow: { marginTop: 10 },
  photo: { width: 120, height: 120, borderRadius: 10, marginRight: 8, backgroundColor: '#F0D9D9' },
  comment: { fontSize: 14, color: '#5C4A45', marginTop: 8, lineHeight: 20 },
  empty: { alignItems: 'center', marginTop: 40 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#5C4A45' },
  emptySubtext: { fontSize: 13, color: '#888', marginTop: 6, textAlign: 'center', lineHeight: 18 },
})
