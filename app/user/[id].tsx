import { useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Image, Share, Modal, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { formaterDate, formatNote } from '../../lib/dateUtils'
import { ScreenHeader } from '../../lib/ScreenHeader'
import { confirmAction, showAlert } from '../../lib/alert'
import { webContentStyle } from '../../lib/webStyles'
import { PhotoViewer } from '../../lib/PhotoViewer'
import { t, tn, tKey } from '../../lib/i18n'

// Enregistrées en français en base (pour la modération), affichées traduites
const REPORT_REASONS = [
  tKey("Harcèlement ou comportement abusif"),
  tKey("Contenu inapproprié"),
  tKey("Spam ou faux compte"),
  tKey("Usurpation d'identité"),
  tKey("Autre"),
]

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
  const [profileNotFound, setProfileNotFound] = useState(false)
  const [datesLoadError, setDatesLoadError] = useState(false)
  const [myId, setMyId] = useState('')
  const [isBlocked, setIsBlocked] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [blockSaving, setBlockSaving] = useState(false)
  const [reportSaving, setReportSaving] = useState(false)
  const [reportSent, setReportSent] = useState(false)
  // Relation d'amitié avec ce profil : aucune, demande envoyée/reçue, amis
  const [friendship, setFriendship] = useState<{ id: string; status: string; sentByMe: boolean } | null>(null)
  const [friendSaving, setFriendSaving] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!id) return
    loadProfile(id)
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setMyId(user.id)
      supabase.from('user_blocks').select('id').eq('blocker_id', user.id).eq('blocked_id', id).maybeSingle()
        .then(({ data }) => setIsBlocked(!!data))
      loadFriendship(user.id, id)
    })
  }, [id])

  async function loadFriendship(me: string, other: string) {
    const { data } = await supabase
      .from('friends')
      .select('id, user_id, status')
      .or(`and(user_id.eq.${me},friend_id.eq.${other}),and(user_id.eq.${other},friend_id.eq.${me})`)
      .limit(1)
    const row = (data ?? [])[0] as any
    setFriendship(row ? { id: row.id, status: row.status, sentByMe: row.user_id === me } : null)
  }

  async function handleFriendAction() {
    if (!myId || !id || friendSaving) return
    setFriendSaving(true)
    if (!friendship) {
      const { error } = await supabase.from('friends').insert({ user_id: myId, friend_id: id })
      if (error) showAlert(t("Impossible d'envoyer la demande"), error.message)
      else {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/notify-social`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ recipient_id: id, type: 'friend_request' }),
          }).catch(() => {})
        }
      }
    } else if (friendship.status === 'pending' && !friendship.sentByMe) {
      await supabase.from('friends').update({ status: 'accepted' }).eq('id', friendship.id)
    } else if (friendship.status === 'pending' && friendship.sentByMe) {
      await supabase.from('friends').delete().eq('id', friendship.id)
    }
    await loadFriendship(myId, id)
    setFriendSaving(false)
    loadProfile(id)
  }

  function confirmToggleBlock() {
    setMenuOpen(false)
    if (isBlocked) { toggleBlock(); return }
    confirmAction(
      t("Bloquer @{username} ?", { username }),
      t("Vous ne verrez plus les dates l'un de l'autre et votre amitié sera retirée. Tu pourras le/la débloquer plus tard."),
      t("Bloquer"),
      toggleBlock,
    )
  }

  async function toggleBlock() {
    if (!myId || !id || blockSaving) return
    setBlockSaving(true)
    setMenuOpen(false)
    if (isBlocked) {
      await supabase.from('user_blocks').delete().eq('blocker_id', myId).eq('blocked_id', id)
      setIsBlocked(false)
    } else {
      await supabase.from('user_blocks').insert({ blocker_id: myId, blocked_id: id })
      // Le blocage rompt aussi une relation d'amitié existante, dans les deux sens.
      await supabase.from('friends').delete().or(
        `and(user_id.eq.${myId},friend_id.eq.${id}),and(user_id.eq.${id},friend_id.eq.${myId})`
      )
      setIsBlocked(true)
      setFriendship(null)
    }
    setBlockSaving(false)
  }

  async function submitReport(reason: string) {
    if (!myId || !id || reportSaving) return
    setReportSaving(true)
    await supabase.from('user_reports').insert({ reporter_id: myId, reported_id: id, reason })
    setReportSaving(false)
    setReportSent(true)
    setTimeout(() => {
      setReportOpen(false)
      setReportSent(false)
    }, 1200)
  }

  async function loadProfile(userId: string) {
    setLoading(true)
    setProfileNotFound(false)
    setDatesLoadError(false)

    const [{ data: profileData, error: profileError }, { data: datesData, error: datesError }] = await Promise.all([
      supabase.from('profiles').select('username, avatar_url').eq('id', userId).single(),
      supabase
        .from('dates')
        .select('id, intitule, lieu, date_du_date, note_globale, commentaire, conseil_vivement, date_photos(photo_url, ordre)')
        .eq('user_id', userId)
        .eq('statut', 'vecu')
        .order('date_du_date', { ascending: false })
        .order('created_at', { ascending: false }),
    ])

    if (profileData) {
      setUsername(profileData.username)
      setAvatarUrl(profileData.avatar_url ?? null)
    } else if (profileError) {
      setProfileNotFound(true)
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
    } else if (datesError) {
      setDatesLoadError(true)
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
      <ScreenHeader
        fallback="/(tabs)/feed"
        bordered={false}
        right={
          <>
            <TouchableOpacity onPress={() => Share.share({ message: t("Regarde le profil de @{username} sur Dateo !", { username }) })} style={styles.shareBtn} accessibilityLabel={t("Partager le profil")}>
              <Ionicons name="share-outline" size={22} color="#D4517E" />
            </TouchableOpacity>
            {myId && myId !== id ? (
              <TouchableOpacity onPress={() => setMenuOpen(true)} style={styles.shareBtn} accessibilityLabel={t("Plus d'options")}>
                <Ionicons name="ellipsis-horizontal" size={22} color="#D4517E" />
              </TouchableOpacity>
            ) : null}
          </>
        }
      />

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuOpen(false)}>
          <View style={styles.menuCard}>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuOpen(false); setReportOpen(true) }}>
              <Ionicons name="flag-outline" size={18} color="#5C4A45" />
              <Text style={styles.menuItemText}>{t("Signaler ce profil")}</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={confirmToggleBlock} disabled={blockSaving}>
              <Ionicons name={isBlocked ? 'lock-open-outline' : 'ban-outline'} size={18} color="#D85A30" />
              <Text style={[styles.menuItemText, { color: '#D85A30' }]}>
                {blockSaving ? '...' : isBlocked ? t("Débloquer") : t("Bloquer cet utilisateur")}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={reportOpen} transparent animationType="fade" onRequestClose={() => setReportOpen(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setReportOpen(false)}>
          <View style={styles.menuCard}>
            {reportSent ? (
              <Text style={styles.reportSentText}>{t("Signalement envoyé, merci.")}</Text>
            ) : (
              <>
                <Text style={styles.reportTitle}>{t("Pourquoi signaler @{username} ?", { username })}</Text>
                {REPORT_REASONS.map((reason) => (
                  <TouchableOpacity key={reason} style={styles.menuItem} onPress={() => submitReport(reason)} disabled={reportSaving}>
                    <Text style={styles.menuItemText}>{t(reason)}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {loading ? (
        <ActivityIndicator color="#D4517E" style={{ marginTop: 60 }} size="large" />
      ) : profileNotFound ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t("Profil introuvable")}</Text>
          <Text style={styles.emptySubtext}>{t("Ce profil n'existe plus ou n'est pas accessible")}</Text>
        </View>
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
                <View style={{ flex: 1, alignItems: 'flex-start' }}>
                <Text style={styles.username}>@{username}</Text>
                {myId && myId !== id && !isBlocked && friendship?.status !== 'accepted' && (
                  <TouchableOpacity
                    style={[styles.friendBtn, friendship && styles.friendBtnPending]}
                    onPress={handleFriendAction}
                    disabled={friendSaving}
                  >
                    {friendSaving ? <ActivityIndicator size="small" color={friendship ? '#D4517E' : '#fff'} /> : (
                      <Text style={[styles.friendBtnText, friendship && styles.friendBtnTextPending]}>
                        {!friendship ? t("+ Ajouter en ami") : friendship.sentByMe ? t("Demande envoyée · Annuler") : t("Accepter sa demande")}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
                {friendship?.status === 'accepted' && <Text style={styles.friendTag}>{t("✓ Vous êtes amis")}</Text>}
                </View>
              </View>

              {isBlocked && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorBannerText}>{t("Tu as bloqué ce profil.")}</Text>
                  <TouchableOpacity onPress={toggleBlock}>
                    <Text style={styles.errorBannerRetry}>{t("Débloquer")}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {dates.length > 0 && (
                <View style={styles.statsRow}>
                  <View style={styles.stat}>
                    <Text style={styles.statValue}>{dates.length}</Text>
                    <Text style={styles.statLabel}>{t("dates")}</Text>
                  </View>
                  {moyenne && (
                    <View style={styles.stat}>
                      <Text style={styles.statValue}>{moyenne}</Text>
                      <Text style={styles.statLabel}>{t("moyenne")}</Text>
                    </View>
                  )}
                  {meilleurLieu && (
                    <View style={[styles.stat, { flex: 2 }]}>
                      <Text style={styles.statValue} numberOfLines={1}>{meilleurLieu}</Text>
                      <Text style={styles.statLabel}>{t("meilleur lieu")}</Text>
                    </View>
                  )}
                </View>
              )}

              {datesLoadError && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorBannerText}>{t("Impossible de charger les dates. Vérifie ta connexion.")}</Text>
                  <TouchableOpacity onPress={() => id && loadProfile(id)}>
                    <Text style={styles.errorBannerRetry}>{t("Réessayer")}</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.sectionTitle}>{tn(dates.length, "{n} date", "{n} dates")}</Text>
            </View>
          }
          ListEmptyComponent={
            datesLoadError ? null : (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>{t("Aucun date visible")}</Text>
                <Text style={styles.emptySubtext}>
                  {friendship?.status === 'accepted'
                    ? t("Cette personne n'a pas encore partagé de date.")
                    : t("Ajoute cette personne en ami pour voir les dates qu'elle partage.")}
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, item.conseil_vivement && styles.cardConseille]}
              onPress={() => router.push(`/date/${item.id}`)}
              activeOpacity={0.88}
            >
              {item.conseil_vivement && (
                <View style={styles.conseilBanner}>
                  <Text style={styles.conseilBannerText}>{t("💖 Conseillé vivement")}</Text>
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
                <Text style={styles.note}>{formatNote(item.note_globale)}/20</Text>
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
  friendBtn: { backgroundColor: '#D4517E', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 18, marginTop: 10, minHeight: 36, justifyContent: 'center' },
  friendBtnPending: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D4517E' },
  friendBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  friendBtnTextPending: { color: '#D4517E' },
  friendTag: { marginTop: 8, fontSize: 13, color: '#3B6D11', fontWeight: '600' },
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
  photoRow: { marginTop: 10, minWidth: 0 },
  photo: { width: 120, height: 120, borderRadius: 10, marginRight: 8, backgroundColor: '#F0D9D9' },
  comment: { fontSize: 14, color: '#5C4A45', marginTop: 8, lineHeight: 20 },
  errorBanner: { backgroundColor: '#FDE8DE', borderRadius: 10, padding: 12, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  errorBannerText: { color: '#993C1D', fontSize: 13, flex: 1 },
  errorBannerRetry: { color: '#D4517E', fontWeight: '700', fontSize: 13 },
  empty: { alignItems: 'center', marginTop: 40 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#5C4A45' },
  emptySubtext: { fontSize: 13, color: '#888', marginTop: 6, textAlign: 'center', lineHeight: 18 },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  menuCard: { backgroundColor: '#fff', borderRadius: 16, padding: 8, width: '100%', maxWidth: 340 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 12 },
  menuItemText: { fontSize: 14, color: '#5C4A45', fontWeight: '500' },
  menuDivider: { height: 1, backgroundColor: '#F0D9D9', marginVertical: 4 },
  reportTitle: { fontSize: 14, fontWeight: '700', color: '#5C4A45', padding: 12, paddingBottom: 4 },
  reportSentText: { fontSize: 14, color: '#3B6D11', fontWeight: '600', textAlign: 'center', padding: 20 },
})
