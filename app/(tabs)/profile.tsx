import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput, Image, ScrollView, Modal, KeyboardAvoidingView, Platform, Switch, Share } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { NotificationBell } from '../../lib/NotificationBell'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import Slider from '@react-native-community/slider'
import * as ImagePicker from 'expo-image-picker'
import { uriToBlob } from '../../lib/uploadImage'
import { supabase } from '../../lib/supabase'
import { calculerMoyenne, trouverMeilleurLieu, formaterDate, formatNote, nomsDesMois, initialesJours } from '../../lib/dateUtils'
import { CRITERES } from '../../lib/criteres'
import { SkeletonList } from '../../lib/Skeleton'
import { showAlert, confirmAction } from '../../lib/alert'
import { saveRatings } from '../../lib/ratings'
import { DatePicker } from '../../lib/DatePicker'
import { webContentStyle } from '../../lib/webStyles'
import { PhotoViewer } from '../../lib/PhotoViewer'
import { CATEGORIES, getCategoryLabel } from '../../lib/categories'
import { useBottomTabs } from '../../lib/useBottomTabs'
import { t, tn } from '../../lib/i18n'
import { C, themedStyles } from '../../lib/theme'


const MAX_PHOTOS = 10

type DateRow = {
  id: string
  intitule: string | null
  lieu: string
  date_du_date: string
  note_globale: number
  commentaire: string | null
  photos: string[]
  conseil_vivement: boolean
  statut: string
  categorie: string | null
  visibilite: string
}

type EditRatings = { mood: number; nourriture: number; ambiance: number; personne: number; conversation: number; prix: number; envie_recommencer: number }

type EditData = {
  intitule: string
  lieu: string
  dateIso: string
  noteGlobale: number
  commentaire: string
  conseilVivement: boolean
  statut: string
  categorie: string | null
  visibilite: string
  ratings: EditRatings
  keptPhotoUrls: string[]
  newPhotoUris: string[]
}

export default function Profile() {
  const [dates, setDates] = useState<DateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [editModal, setEditModal] = useState(false)
  const [editingDate, setEditingDate] = useState<DateRow | null>(null)
  const [editData, setEditData] = useState<EditData>({
    intitule: '',
    lieu: '',
    dateIso: '',
    noteGlobale: 10,
    commentaire: '',
    conseilVivement: false,
    statut: 'vecu',
    categorie: null,
    visibilite: 'friends',
    ratings: { mood: 3, nourriture: 3, ambiance: 3, personne: 3, conversation: 3, prix: 3, envie_recommencer: 3 },
    keptPhotoUrls: [],
    newPhotoUris: [],
  })
  const [loadingEditData, setLoadingEditData] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategorie, setFilterCategorie] = useState<string | null>(null)
  const [viewer, setViewer] = useState<{ photos: string[]; index: number } | null>(null)
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [calMonth, setCalMonth] = useState(() => { const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() } })
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [filterNoteMin, setFilterNoteMin] = useState(0)
  const [loadError, setLoadError] = useState(false)
  const [monthlyGoal, setMonthlyGoal] = useState<number | null>(null)
  const [companions, setCompanions] = useState<{ id: string; username: string }[]>([])
  const [selectedCompanionIds, setSelectedCompanionIds] = useState<Set<string>>(new Set())
  const [planifieModalVisible, setPlanifieModalVisible] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const router = useRouter()
  // Cloche dans l'en-tête sur téléphone ; sur ordinateur elle est dans la barre du haut
  const showBell = useBottomTabs()
  const userIdRef = useRef('')
  const editOriginalPhotosRef = useRef<string[]>([])
  const editOriginalParticipantIdsRef = useRef<Set<string>>(new Set())

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(false)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    userIdRef.current = user.id
    setEmail(user.email ?? '')

    const { data: profileData } = await supabase
      .from('profiles').select('username, avatar_url, monthly_goal').eq('id', user.id).single()
    if (profileData) {
      setUsername(profileData.username)
      setAvatarUrl(profileData.avatar_url ?? null)
      setMonthlyGoal((profileData as any).monthly_goal ?? null)
    }

    const { data, error } = await supabase
      .from('dates')
      .select('id, intitule, lieu, date_du_date, note_globale, commentaire, conseil_vivement, statut, categorie, visibilite, date_photos(photo_url, ordre)')
      .eq('user_id', user.id)
      .order('date_du_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (!error && data) {
      setDates(data.map((d: any) => ({
        id: d.id,
        intitule: d.intitule ?? null,
        lieu: d.lieu,
        date_du_date: d.date_du_date,
        note_globale: d.note_globale,
        commentaire: d.commentaire,
        conseil_vivement: d.conseil_vivement ?? false,
        statut: d.statut ?? 'vecu',
        categorie: d.categorie ?? null,
        visibilite: d.visibilite ?? 'friends',
        photos: (d.date_photos ?? [])
          .sort((a: any, b: any) => a.ordre - b.ordre)
          .map((p: any) => p.photo_url),
      })))
    } else if (error) {
      setLoadError(true)
    }
    setLoading(false)
  }, [])

  useFocusEffect(useCallback(() => { loadData() }, [loadData]))


  async function loadCompanionsList() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: friendships }, { data: coupleRow }] = await Promise.all([
      supabase.from('friends').select('user_id, friend_id').or(`user_id.eq.${user.id},friend_id.eq.${user.id}`).eq('status', 'accepted'),
      supabase.from('couples').select('user1_id, user2_id').or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`).eq('status', 'accepted').maybeSingle(),
    ])
    const friendIds = (friendships ?? []).map((f: any) => f.user_id === user.id ? f.friend_id : f.user_id)
    const partnerId = coupleRow ? (coupleRow.user1_id === user.id ? coupleRow.user2_id : coupleRow.user1_id) : null
    const allIds = [...new Set([...friendIds, ...(partnerId ? [partnerId] : [])])]
    if (allIds.length === 0) { setCompanions([]); return }

    const { data: profiles } = await supabase.from('profiles').select('id, username').in('id', allIds)
    setCompanions((profiles ?? []) as { id: string; username: string }[])
  }

  function toggleCompanion(id: string) {
    setSelectedCompanionIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function openEdit(item: DateRow) {
    editOriginalPhotosRef.current = item.photos
    setEditingDate(item)
    loadCompanionsList()
    supabase.from('date_participants').select('user_id').eq('date_id', item.id).then(({ data }) => {
      const ids = new Set((data ?? []).map((p: any) => p.user_id as string))
      editOriginalParticipantIdsRef.current = ids
      setSelectedCompanionIds(ids)
    })
    setEditData({
      intitule: item.intitule ?? '',
      lieu: item.lieu,
      dateIso: item.date_du_date,
      statut: item.statut ?? 'vecu',
      noteGlobale: item.note_globale ?? 10,
      commentaire: item.commentaire ?? '',
      ratings: { mood: 3, nourriture: 3, ambiance: 3, personne: 3, conversation: 3, prix: 3, envie_recommencer: 3 },
      conseilVivement: item.conseil_vivement,
      categorie: item.categorie ?? null,
      visibilite: item.visibilite ?? 'friends',
      keptPhotoUrls: [...item.photos],
      newPhotoUris: [],
    })
    setEditModal(true)

    setLoadingEditData(true)
    const { data } = await supabase
      .from('ratings').select('mood, nourriture, ambiance, personne, conversation, prix, envie_recommencer')
      .eq('date_id', item.id).limit(1).maybeSingle()
    if (data) setEditData((prev) => ({
      ...prev,
      ratings: {
        mood: data.mood ?? 3,
        nourriture: data.nourriture ?? 3,
        ambiance: data.ambiance ?? 3,
        personne: data.personne ?? 3,
        conversation: data.conversation ?? 3,
        prix: data.prix ?? 3,
        envie_recommencer: data.envie_recommencer ?? 3,
      },
    }))
    setLoadingEditData(false)
  }

  function updateEditRating(key: string, value: number) {
    setEditData((prev) => ({ ...prev, ratings: { ...prev.ratings, [key]: value } }))
  }

  function removeKeptPhoto(url: string) {
    setEditData((prev) => ({ ...prev, keptPhotoUrls: prev.keptPhotoUrls.filter((u) => u !== url) }))
  }

  function removeNewPhoto(uri: string) {
    setEditData((prev) => ({ ...prev, newPhotoUris: prev.newPhotoUris.filter((u) => u !== uri) }))
  }

  async function pickEditImages() {
    const totalKept = editData.keptPhotoUrls.length + editData.newPhotoUris.length
    const remaining = MAX_PHOTOS - totalKept
    if (remaining <= 0) {
      showAlert(t("Limite atteinte"), t("Tu peux avoir {n} photos maximum", { n: MAX_PHOTOS }))
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    })

    if (!result.canceled) {
      const uris = result.assets.map((a) => a.uri)
      setEditData((prev) => ({
        ...prev,
        newPhotoUris: [...prev.newPhotoUris, ...uris].slice(0, prev.newPhotoUris.length + remaining),
      }))
    }
  }

  async function handleSaveEdit() {
    if (saving) return
    if (!editData.lieu.trim()) { showAlert(t("Oups"), t("Indique le lieu du date")); return }
    if (!editingDate) return

    setSaving(true)

    // Le passage planifié → vécu se fait explicitement via « Marquer comme vécu »
    const statutFinal = editData.statut

    const { data: updatedDate, error: dateError } = await supabase
      .from('dates')
      .update({
        intitule: editData.intitule.trim() || null,
        lieu: editData.lieu.trim(),
        date_du_date: editData.dateIso,
        note_globale: statutFinal === 'vecu' ? Math.round(editData.noteGlobale * 4) / 4 : null,
        commentaire: editData.commentaire.trim() || null,
        statut: statutFinal,
        categorie: editData.categorie,
        visibilite: editData.visibilite,
      })
      .eq('id', editingDate.id)
      .select('id')

    if (dateError) {
      setSaving(false)
      showAlert(t("Impossible de modifier ce date"), dateError.message)
      return
    }

    if (!updatedDate || updatedDate.length === 0) {
      setSaving(false)
      showAlert(t("Impossible de modifier ce date"), t("Réessaie dans un instant."))
      return
    }

    // Colonnes ajoutées en migration — erreurs ignorées si absentes
    await supabase.from('dates')
      .update({ conseil_vivement: editData.conseilVivement })
      .eq('id', editingDate.id)

    if (statutFinal === 'vecu') await saveRatings(editingDate.id, editData.ratings)

    const deletedUrls = editOriginalPhotosRef.current.filter(
      (url) => !editData.keptPhotoUrls.includes(url)
    )
    for (const url of deletedUrls) {
      await supabase.from('date_photos').delete()
        .eq('date_id', editingDate.id).eq('photo_url', url)
    }

    const originalParticipantIds = editOriginalParticipantIdsRef.current
    const addedParticipantIds = [...selectedCompanionIds].filter((id) => !originalParticipantIds.has(id))
    const removedParticipantIds = [...originalParticipantIds].filter((id) => !selectedCompanionIds.has(id))
    if (addedParticipantIds.length > 0) {
      await supabase.from('date_participants').upsert(
        addedParticipantIds.map((id) => ({ date_id: editingDate.id, user_id: id })),
        { onConflict: 'date_id,user_id', ignoreDuplicates: true }
      )
    }
    for (const id of removedParticipantIds) {
      await supabase.from('date_participants').delete()
        .eq('date_id', editingDate.id).eq('user_id', id)
    }

    setSaving(false)

    if (editData.newPhotoUris.length > 0) {
      await uploadNewPhotos(
        userIdRef.current,
        editingDate.id,
        editData.newPhotoUris,
        editData.keptPhotoUrls.length
      )
    }

    setEditModal(false)
    setEditingDate(null)
    loadData()
  }

  async function uploadNewPhotos(userId: string, dateId: string, uris: string[], startOrdre: number) {
    setUploadingPhotos(true)
    setUploadProgress({ current: 0, total: uris.length })
    const batchId = Date.now()
    let failCount = 0

    for (let i = 0; i < uris.length; i++) {
      try {
        const uri = uris[i]
        const fileExt = uri.split('.').pop()?.toLowerCase() ?? 'jpg'
        const fileName = `${userId}/${batchId}_edit_${i}.${fileExt}`
        const blob = await uriToBlob(uri)

        const { error: uploadError } = await supabase.storage
          .from('date-photos').upload(fileName, blob, { contentType: `image/${fileExt}` })
        if (uploadError) throw uploadError

        const { data } = supabase.storage.from('date-photos').getPublicUrl(fileName)
        await supabase.from('date_photos').insert({ date_id: dateId, photo_url: data.publicUrl, ordre: startOrdre + i })
      } catch {
        failCount++
      }
      setUploadProgress({ current: i + 1, total: uris.length })
    }

    setUploadingPhotos(false)
    if (failCount > 0) showAlert(t("Attention"), t("{n} photo(s) n'ont pas pu être envoyée(s)", { n: failCount }))
  }

  async function execDelete(id: string) {
    setDeleting(true)

    const { error: photosError } = await supabase
      .from('date_photos').delete().eq('date_id', id)
    if (photosError) {
      setDeleting(false)
      setConfirmDeleteId(null)
      showAlert(t("Impossible de supprimer ce date"), photosError.message)
      return
    }

    const { error: ratingsError } = await supabase
      .from('ratings').delete().eq('date_id', id)
    if (ratingsError) {
      setDeleting(false)
      setConfirmDeleteId(null)
      showAlert(t("Impossible de supprimer ce date"), ratingsError.message)
      return
    }

    const { data: deleted, error } = await supabase
      .from('dates').delete().eq('id', id).select('id')

    setDeleting(false)
    setConfirmDeleteId(null)

    if (error) showAlert(t("Impossible de supprimer ce date"), error.message)
    else if (!deleted || deleted.length === 0) showAlert(t("Impossible de supprimer ce date"), t("Réessaie dans un instant."))
    else loadData()
  }

  function handleSignOut() {
    confirmAction(t("Se déconnecter ?"), t("Tu pourras te reconnecter avec ton email et ton mot de passe."), t("Se déconnecter"), () => {
      supabase.auth.signOut()
    })
  }


  const vecuDates = useMemo(() => dates.filter((d) => d.statut !== 'planifie'), [dates])
  const planifieDates = useMemo(() => dates.filter((d) => d.statut === 'planifie'), [dates])

  const filteredVecu = useMemo(() => {
    let result = vecuDates
    if (filterCategorie) result = result.filter((d) => d.categorie === filterCategorie)
    if (filterNoteMin > 0) result = result.filter((d) => d.note_globale >= filterNoteMin)
    if (!searchQuery.trim()) return result
    const q = searchQuery.toLowerCase()
    return result.filter((d) =>
      (d.intitule ?? '').toLowerCase().includes(q) || d.lieu.toLowerCase().includes(q)
    )
  }, [vecuDates, searchQuery, filterCategorie, filterNoteMin])

  const filteredPlanifie = useMemo(() => {
    if (!searchQuery.trim()) return planifieDates
    const q = searchQuery.toLowerCase()
    return planifieDates.filter((d) =>
      (d.intitule ?? '').toLowerCase().includes(q) || d.lieu.toLowerCase().includes(q)
    )
  }, [planifieDates, searchQuery])

  useEffect(() => {
    if (planifieModalVisible && filteredPlanifie.length === 0) setPlanifieModalVisible(false)
  }, [planifieModalVisible, filteredPlanifie])

  const moyenne = calculerMoyenne(vecuDates)
  const meilleurLieu = trouverMeilleurLieu(vecuDates)
  const editPhotoCount = editData.keptPhotoUrls.length + editData.newPhotoUris.length

  const CAL_MOIS = nomsDesMois('long')
  const CAL_DOW = initialesJours()

  const calDateSet = useMemo(() => new Set(
    vecuDates
      .filter((d) => { const dd = new Date(d.date_du_date); return dd.getFullYear() === calMonth.year && dd.getMonth() === calMonth.month })
      .map((d) => d.date_du_date)
  ), [vecuDates, calMonth])

  const calCells = useMemo(() => {
    const firstDow = (new Date(calMonth.year, calMonth.month, 1).getDay() + 6) % 7
    const daysInMonth = new Date(calMonth.year, calMonth.month + 1, 0).getDate()
    const cells: (number | null)[] = Array(firstDow).fill(null)
    for (let i = 1; i <= daysInMonth; i++) cells.push(i)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [calMonth])

  const displayDates = useMemo(() => {
    if (viewMode !== 'calendar') return filteredVecu
    const monthDates = vecuDates.filter((d) => {
      const dd = new Date(d.date_du_date)
      return dd.getFullYear() === calMonth.year && dd.getMonth() === calMonth.month
    })
    if (selectedDay) return monthDates.filter((d) => d.date_du_date === selectedDay)
    return monthDates
  }, [viewMode, vecuDates, calMonth, selectedDay, filteredVecu])

  async function shareProfile() {
    await Share.share({ message: t("Rejoins-moi sur Dateo ! Mon profil : @{username}", { username }) })
  }

  function renderPlanifieCard(item: DateRow) {
    return (
      <View key={item.id} style={[styles.dateCard, styles.dateCardPlanifie]}>
        <View style={styles.dateCardHeader}>
          <View style={{ flex: 1, marginRight: 8 }}>
            {item.intitule ? (
              <>
                <Text style={styles.dateTitre}>{item.intitule}</Text>
                <View style={styles.iconLine}>
                      <Ionicons name="location-outline" size={12} color={C.muted} />
                      <Text style={styles.dateLieu}>{item.lieu}</Text>
                    </View>
              </>
            ) : (
              <Text style={styles.dateLieu}>{item.lieu}</Text>
            )}
          </View>
          <View style={styles.planifieBadge}>
            <Text style={styles.planifieText}>{t("Planifié")}</Text>
          </View>
        </View>
        <Text style={styles.dateDate}>{formaterDate(item.date_du_date)}</Text>
        {item.commentaire ? <Text style={styles.dateComment} numberOfLines={2}>{item.commentaire}</Text> : null}
        {confirmDeleteId === item.id ? (
          <View style={styles.dateActions}>
            <Text style={styles.confirmText}>{t("Supprimer ce date ?")}</Text>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => execDelete(item.id)} disabled={deleting}>
              <Text style={styles.deleteBtnText}>{deleting ? '...' : t("Oui")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.editBtn} onPress={() => setConfirmDeleteId(null)}>
              <Text style={styles.editBtnText}>{t("Non")}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.dateActions}>
            <TouchableOpacity style={styles.editBtn} onPress={() => { setPlanifieModalVisible(false); openEdit(item) }}>
              <Text style={styles.editBtnText}>{t("Modifier")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => setConfirmDeleteId(item.id)}>
              <Text style={styles.deleteBtnText}>{t("Supprimer")}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FlatList
        style={styles.container}
        contentContainerStyle={[styles.content, webContentStyle]}
        data={displayDates}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={loadData}
        ListHeaderComponent={
          <View>
            <View style={styles.profileHeader}>
              <Text style={styles.title}>{t("Profil")}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {showBell && <NotificationBell style={styles.settingsBtn} />}
                <TouchableOpacity onPress={() => router.push('/settings')} style={styles.settingsBtn} accessibilityLabel={t("Paramètres")}>
                  <Ionicons name="settings-outline" size={22} color={C.primary} />
                </TouchableOpacity>
              </View>
            </View>

            {loadError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{t("Impossible de charger tes dates. Vérifie ta connexion.")}</Text>
                <TouchableOpacity onPress={loadData}>
                  <Text style={styles.errorBannerRetry}>{t("Réessayer")}</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.avatarRow}>
              <TouchableOpacity onPress={() => router.push('/settings')} activeOpacity={0.8}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitial}>{username.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <View style={styles.avatarInfo}>
                <Text style={styles.username}>@{username}</Text>
                <Text style={styles.email}>{email}</Text>
              </View>
            </View>

            {/* 4 raccourcis principaux, le reste derrière « Plus » pour alléger l'écran */}
            <View style={styles.quickLinks}>
              {[
                { icon: 'people-outline' as const, label: t("Amis"), onPress: () => router.push('/friends') },
                { icon: 'stats-chart-outline' as const, label: t("Stats"), onPress: () => router.push('/stats') },
                { icon: 'heart-outline' as const, label: t("Couple"), onPress: () => router.push('/couple') },
                { icon: 'location-outline' as const, label: t("À essayer"), onPress: () => router.push('/wishlist') },
                { icon: 'grid-outline' as const, label: t("Plus"), onPress: () => setMoreOpen(true) },
              ].map((item) => (
                <TouchableOpacity key={item.label} style={styles.quickLink} onPress={item.onPress}>
                  <Ionicons name={item.icon} size={20} color={C.primaryText} />
                  <Text style={styles.quickLinkText} numberOfLines={1} adjustsFontSizeToFit>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {vecuDates.length > 0 && (<>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{t("Dates vécus")}</Text>
                <Text style={styles.statValue}>{vecuDates.length}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{t("Moyenne")}</Text>
                <Text style={styles.statValue}>{moyenne}/20</Text>
              </View>
            </View>

            <View style={styles.statCardFull}>
              <Text style={styles.statLabel}>{t("Meilleur date")}</Text>
              <Text style={styles.statValueSmall}>{meilleurLieu}</Text>
            </View>
            </>)}

            {(() => {
              if (!monthlyGoal || monthlyGoal <= 0) return null
              const now = new Date()
              const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
              const thisMonthCount = vecuDates.filter((d) => d.date_du_date.startsWith(thisMonth)).length
              const pct = Math.min(thisMonthCount / monthlyGoal, 1)
              return (
                <View style={styles.goalCard}>
                  <View style={styles.goalHeader}>
                    <Text style={styles.goalLabel}>{t("Objectif du mois")}</Text>
                    <Text style={styles.goalCount}>{t("{fait}/{objectif} dates", { fait: thisMonthCount, objectif: monthlyGoal })}</Text>
                  </View>
                  <View style={styles.goalTrack}>
                    <View style={[styles.goalFill, { flex: pct }]} />
                    {pct < 1 && <View style={{ flex: 1 - pct }} />}
                  </View>
                  {thisMonthCount >= monthlyGoal && (
                    <Text style={styles.goalDone}>{t("Objectif atteint !")}</Text>
                  )}
                </View>
              )
            })()}

            {filteredPlanifie.length > 0 && (
              <TouchableOpacity style={styles.planifieSummary} onPress={() => setPlanifieModalVisible(true)} activeOpacity={0.8}>
                <View style={styles.planifieSummaryIcon}>
                  <Ionicons name="calendar" size={18} color={C.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planifieSummaryTitle}>
                    {tn(filteredPlanifie.length, "{n} date planifié", "{n} dates planifiés")}
                  </Text>
                  <Text style={styles.planifieSummarySub} numberOfLines={1}>
                    {filteredPlanifie[0].intitule ?? filteredPlanifie[0].lieu}
                    {filteredPlanifie.length > 1 ? ` ${tn(filteredPlanifie.length - 1, "+{n} autre", "+{n} autres")}` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.faint} />
              </TouchableOpacity>
            )}

            {vecuDates.length >= 4 && (<>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder={t("Rechercher un date...")}
                placeholderTextColor={C.faint}
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catFilterRow} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
              <TouchableOpacity
                style={[styles.catFilterChip, filterCategorie === null && styles.catFilterChipActive]}
                onPress={() => setFilterCategorie(null)}
              >
                <Text style={[styles.catFilterText, filterCategorie === null && styles.catFilterTextActive]}>{t("Tous")}</Text>
              </TouchableOpacity>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.key}
                  style={[styles.catFilterChip, filterCategorie === cat.key && styles.catFilterChipActive]}
                  onPress={() => setFilterCategorie(filterCategorie === cat.key ? null : cat.key)}
                >
                  <Text style={[styles.catFilterText, filterCategorie === cat.key && styles.catFilterTextActive]}>
                    {cat.emoji} {t(cat.label)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.advFilterRow} contentContainerStyle={{ gap: 6, paddingRight: 4 }}>
              {([0, 10, 14, 16, 18] as const).map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[styles.advChip, filterNoteMin === n && styles.advChipActive]}
                  onPress={() => setFilterNoteMin(n)}
                >
                  <Text style={[styles.advChipText, filterNoteMin === n && styles.advChipTextActive]}>{n > 0 ? `≥${n}/20` : t("Toute note")}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            </>)}

            {vecuDates.length > 0 && (
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>{t("Historique")} ({vecuDates.length})</Text>
              <View style={styles.viewToggle}>
                <TouchableOpacity
                  style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
                  onPress={() => { setViewMode('list'); setSelectedDay(null) }}
                >
                  <Ionicons name="list" size={16} color={viewMode === 'list' ? C.onPrimary : C.faint} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.viewToggleBtn, viewMode === 'calendar' && styles.viewToggleBtnActive]}
                  onPress={() => setViewMode('calendar')}
                >
                  <Ionicons name="calendar" size={16} color={viewMode === 'calendar' ? C.onPrimary : C.faint} />
                </TouchableOpacity>
              </View>
            </View>
            )}

            {viewMode === 'calendar' && (
              <View style={styles.calendarBox}>
                <View style={styles.calHeader}>
                  <TouchableOpacity onPress={() => { setSelectedDay(null); setCalMonth((p) => { const d = new Date(p.year, p.month - 1); return { year: d.getFullYear(), month: d.getMonth() } }) }}>
                    <Ionicons name="chevron-back" size={20} color={C.primary} />
                  </TouchableOpacity>
                  <Text style={styles.calMonthLabel}>{CAL_MOIS[calMonth.month]} {calMonth.year}</Text>
                  <TouchableOpacity onPress={() => { setSelectedDay(null); setCalMonth((p) => { const d = new Date(p.year, p.month + 1); return { year: d.getFullYear(), month: d.getMonth() } }) }}>
                    <Ionicons name="chevron-forward" size={20} color={C.primary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.calGrid}>
                  {CAL_DOW.map((d, i) => <Text key={i} style={styles.calDow}>{d}</Text>)}
                  {calCells.map((day, idx) => {
                    if (day === null) return <View key={`e${idx}`} style={styles.calCell} />
                    const iso = `${calMonth.year}-${String(calMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                    const has = calDateSet.has(iso)
                    const sel = selectedDay === iso
                    return (
                      <TouchableOpacity key={iso} style={[styles.calCell, sel && styles.calCellSel]} onPress={() => has && setSelectedDay(sel ? null : iso)} activeOpacity={has ? 0.7 : 1}>
                        <Text style={[styles.calDay, sel && styles.calDaySel, !has && styles.calDayEmpty]}>{day}</Text>
                        {has && <View style={[styles.calDot, sel && styles.calDotSel]} />}
                      </TouchableOpacity>
                    )
                  })}
                </View>
                {selectedDay && (
                  <TouchableOpacity onPress={() => setSelectedDay(null)} style={styles.calClear}>
                    <Text style={styles.calClearText}>{t("× Effacer la sélection")}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {loading && dates.length === 0 && <SkeletonList count={2} />}
            {!loading && vecuDates.length === 0 && (
              <View style={styles.emptyBox}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="create-outline" size={28} color={C.primaryText} />
                </View>
                <Text style={styles.emptyTitle}>{t("Aucun date noté pour l'instant")}</Text>
                <Text style={styles.emptySub}>{t("Note ta première sortie pour commencer ton historique")}</Text>
                <TouchableOpacity style={styles.emptyCta} onPress={() => router.push('/(tabs)/rate')}>
                  <Text style={styles.emptyCtaText}>{t("Noter un date")}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.dateCard}>
            {item.conseil_vivement && (
              <View style={styles.conseilBadge}>
                <Ionicons name="heart" size={11} color={C.primaryText} />
                <Text style={styles.conseilBadgeText}>{t("Conseillé vivement")}</Text>
              </View>
            )}
            <View style={styles.dateCardHeader}>
              <View style={{ flex: 1, marginRight: 8 }}>
                {item.intitule ? (
                  <>
                    <Text style={styles.dateTitre}>{item.intitule}</Text>
                    <View style={styles.iconLine}>
                      <Ionicons name="location-outline" size={12} color={C.muted} />
                      <Text style={styles.dateLieu}>{item.lieu}</Text>
                    </View>
                  </>
                ) : (
                  <Text style={styles.dateLieu}>{item.lieu}</Text>
                )}
              </View>
              <Text style={styles.dateNote}>{formatNote(item.note_globale)}/20</Text>
            </View>
            <Text style={styles.dateDate}>{formaterDate(item.date_du_date)}</Text>

            {item.photos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
                {item.photos.map((url, idx) => (
                  <TouchableOpacity key={idx} onPress={() => setViewer({ photos: item.photos, index: idx })} activeOpacity={0.9}>
                    <Image source={{ uri: url }} style={styles.feedPhoto} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {item.commentaire ? <Text style={styles.dateComment} numberOfLines={2}>{item.commentaire}</Text> : null}

            {confirmDeleteId === item.id ? (
              <View style={styles.dateActions}>
                <Text style={styles.confirmText}>{t("Supprimer ce date ?")}</Text>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => execDelete(item.id)} disabled={deleting}>
                  <Text style={styles.deleteBtnText}>{deleting ? '...' : t("Oui")}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.editBtn} onPress={() => setConfirmDeleteId(null)}>
                  <Text style={styles.editBtnText}>{t("Non")}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.dateActions}>
                <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
                  <Text style={styles.editBtnText}>{t("Modifier")}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => setConfirmDeleteId(item.id)}>
                  <Text style={styles.deleteBtnText}>{t("Supprimer")}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          !loading && searchQuery.trim() ? (
            <Text style={styles.empty}>{t("Aucun résultat pour « {q} »", { q: searchQuery })}</Text>
          ) : null
        }
        ListFooterComponent={<View style={{ height: 24 }} />}
      />

      {viewer && (
        <PhotoViewer
          photos={viewer.photos}
          initialIndex={viewer.index}
          visible
          onClose={() => setViewer(null)}
        />
      )}

      <Modal visible={editModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={styles.modalSafe} edges={['top']}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setEditModal(false)}>
                <Text style={styles.modalCancel}>{t("Annuler")}</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{t("Modifier le date")}</Text>
              <TouchableOpacity onPress={handleSaveEdit} disabled={saving || uploadingPhotos}>
                <Text style={styles.modalSave}>{saving ? '...' : t("Enregistrer")}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {editData.statut === 'planifie' && (
                <TouchableOpacity
                  style={styles.marquerVecuBtn}
                  onPress={() => setEditData((prev) => ({ ...prev, statut: 'vecu' }))}
                >
                  <Text style={styles.marquerVecuText}><Ionicons name="checkmark-circle" size={15} color={C.onPrimary} /> {t("Marquer comme vécu")}</Text>
                </TouchableOpacity>
              )}
              {editData.statut === 'vecu' && editingDate?.statut === 'planifie' && (
                <View style={styles.vecuBanner}>
                  <Text style={styles.vecuBannerText}>{t("Ce date sera déplacé dans l'historique")}</Text>
                </View>
              )}

              <Text style={styles.label}>{t("Intitulé")} <Text style={styles.labelOptional}>{t("(optionnel)")}</Text></Text>
              <TextInput
                style={styles.input}
                value={editData.intitule}
                onChangeText={(v) => setEditData((prev) => ({ ...prev, intitule: v }))}
                placeholder={t("Ex : Dîner romantique, Soirée ciné...")}
                placeholderTextColor={C.faint}
              />

              <Text style={styles.label}>{t("Lieu")}</Text>
              <TextInput
                style={styles.input}
                value={editData.lieu}
                onChangeText={(v) => setEditData((prev) => ({ ...prev, lieu: v }))}
                placeholder={t("Lieu du date")}
                placeholderTextColor={C.faint}
              />

              <Text style={styles.label}>{t("Date")}</Text>
              <DatePicker
                value={editData.dateIso}
                onChange={(iso) => setEditData((prev) => ({ ...prev, dateIso: iso }))}
              />

              <Text style={styles.label}>{t("Catégorie")} <Text style={styles.labelOptional}>{t("(optionnel)")}</Text></Text>
              <View style={styles.categoryRow}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.key}
                    style={[styles.categoryChip, editData.categorie === cat.key && styles.categoryChipActive]}
                    onPress={() => setEditData((prev) => ({ ...prev, categorie: prev.categorie === cat.key ? null : cat.key }))}
                  >
                    <Text style={[styles.categoryChipText, editData.categorie === cat.key && styles.categoryChipTextActive]}>
                      {cat.emoji} {t(cat.label)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {editData.statut === 'vecu' && (<>
              <View style={styles.globalNoteBox}>
                <Text style={styles.label}>{t("Note globale")}</Text>
                <Text style={styles.globalNoteValue}>{formatNote(editData.noteGlobale)}/20</Text>
                <Slider
                  style={{ width: '100%', height: 40 }}
                  minimumValue={0} maximumValue={20} step={0.25}
                  value={editData.noteGlobale}
                  onValueChange={(v) => setEditData((prev) => ({ ...prev, noteGlobale: v }))}
                  minimumTrackTintColor={C.primary} maximumTrackTintColor={C.border} thumbTintColor={C.primary}
                />
              </View>

              <Text style={styles.sectionTitle}>{t("Détails")}</Text>
              {loadingEditData ? (
                <ActivityIndicator color={C.primary} style={{ marginVertical: 12 }} />
              ) : (
                CRITERES.map((c) => (
                  <View key={c.key} style={styles.critereBox}>
                    <View style={styles.critereHeader}>
                      <Text style={styles.label}>{t(c.label)}</Text>
                      <Text style={styles.critereValue}>{formatNote(editData.ratings[c.key as keyof EditRatings])}/5</Text>
                    </View>
                    <Slider
                      style={{ width: '100%', height: 36 }}
                      minimumValue={0} maximumValue={5} step={0.25}
                      value={editData.ratings[c.key as keyof EditRatings]}
                      onValueChange={(v) => updateEditRating(c.key, v)}
                      minimumTrackTintColor={C.primary} maximumTrackTintColor={C.border} thumbTintColor={C.primary}
                    />
                  </View>
                ))
              )}

              <TouchableOpacity
                style={[styles.conseilRow, editData.conseilVivement && styles.conseilRowActive]}
                onPress={() => setEditData((prev) => ({ ...prev, conseilVivement: !prev.conseilVivement }))}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.conseilLabel, editData.conseilVivement && styles.conseilLabelActive]}>
                    <Ionicons name="heart" size={14} color={editData.conseilVivement ? C.primaryText : C.text} /> {t("Je conseille vivement")}
                  </Text>
                  <Text style={styles.conseilSubtext}>{t("Mis en avant sur le feed de tes amis")}</Text>
                </View>
                <Switch
                  value={editData.conseilVivement}
                  onValueChange={(v) => setEditData((prev) => ({ ...prev, conseilVivement: v }))}
                  trackColor={{ false: C.border, true: C.primary }}
                  thumbColor="#fff"
                  ios_backgroundColor={C.border}
                />
              </TouchableOpacity>
              </>)}

              <View style={styles.visibiliteRow}>
                <TouchableOpacity
                  style={[styles.statutBtn, editData.visibilite === 'friends' && styles.statutBtnActive]}
                  onPress={() => setEditData((prev) => ({ ...prev, visibilite: 'friends' }))}
                >
                  <Text style={[styles.statutBtnText, editData.visibilite === 'friends' && styles.statutBtnTextActive]}><Ionicons name="people" size={13} /> {t("Visible par mes amis")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.statutBtn, editData.visibilite === 'private' && styles.statutBtnActive]}
                  onPress={() => setEditData((prev) => ({ ...prev, visibilite: 'private' }))}
                >
                  <Text style={[styles.statutBtnText, editData.visibilite === 'private' && styles.statutBtnTextActive]}><Ionicons name="lock-closed" size={13} /> {t("Privé")}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>{t("Commentaire")}</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={editData.commentaire}
                onChangeText={(v) => setEditData((prev) => ({ ...prev, commentaire: v }))}
                placeholder={t("Raconte ton date...")}
                placeholderTextColor={C.faint}
                multiline
                numberOfLines={4}
              />

              {companions.length > 0 && (
                <>
                  <Text style={styles.label}>{t("Avec qui ?")} <Text style={styles.labelOptional}>{t("(optionnel)")}</Text></Text>
                  <View style={styles.categoryRow}>
                    {companions.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        style={[styles.categoryChip, selectedCompanionIds.has(c.id) && styles.categoryChipActive]}
                        onPress={() => toggleCompanion(c.id)}
                      >
                        <Text style={[styles.categoryChipText, selectedCompanionIds.has(c.id) && styles.categoryChipTextActive]}>
                          @{c.username}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.label}>{t("Photos")} ({editPhotoCount}/{MAX_PHOTOS})</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoGallery}>
                {editData.keptPhotoUrls.map((url) => (
                  <View key={url} style={styles.photoThumbWrapper}>
                    <Image source={{ uri: url }} style={styles.photoThumb} />
                    <TouchableOpacity style={styles.photoRemove} onPress={() => removeKeptPhoto(url)}>
                      <Text style={styles.photoRemoveText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {editData.newPhotoUris.map((uri) => (
                  <View key={uri} style={styles.photoThumbWrapper}>
                    <Image source={{ uri }} style={styles.photoThumb} />
                    <View style={styles.newPhotoBadge} />
                    <TouchableOpacity style={styles.photoRemove} onPress={() => removeNewPhoto(uri)}>
                      <Text style={styles.photoRemoveText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {editPhotoCount < MAX_PHOTOS && (
                  <TouchableOpacity style={styles.photoAddButton} onPress={pickEditImages}>
                    <Text style={styles.photoAddText}>+</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </ScrollView>
          </SafeAreaView>

          {uploadingPhotos && (
            <View style={styles.uploadOverlay}>
              <View style={styles.uploadCard}>
                <ActivityIndicator color={C.primary} size="large" />
                <Text style={styles.uploadTitle}>{t("Envoi des photos")}</Text>
                <Text style={styles.uploadCount}>{uploadProgress.current} / {uploadProgress.total}</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { flex: uploadProgress.current }]} />
                  {uploadProgress.current < uploadProgress.total && (
                    <View style={{ flex: uploadProgress.total - uploadProgress.current }} />
                  )}
                </View>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={moreOpen} transparent animationType="fade" onRequestClose={() => setMoreOpen(false)}>
        <TouchableOpacity style={styles.moreBackdrop} activeOpacity={1} onPress={() => setMoreOpen(false)}>
          <View style={styles.moreSheet}>
            <Text style={styles.moreTitle}>{t("Plus")}</Text>
            {[
              { icon: 'sparkles-outline' as const, label: t("Récap"), onPress: () => router.push('/recap') },
              { icon: 'trophy-outline' as const, label: t("Classement"), onPress: () => router.push('/leaderboard') },
              { icon: 'ribbon-outline' as const, label: t("Badges"), onPress: () => router.push('/badges') },
              { icon: 'search-outline' as const, label: t("Recherche"), onPress: () => router.push('/search') },
              { icon: 'bookmark-outline' as const, label: t("Favoris"), onPress: () => router.push('/favorites') },
              { icon: 'share-social-outline' as const, label: t("Partager mon profil"), onPress: shareProfile },
              { icon: 'settings-outline' as const, label: t("Paramètres"), onPress: () => router.push('/settings') },
            ].map((item) => (
              <TouchableOpacity key={item.label} style={styles.moreRow} onPress={() => { setMoreOpen(false); item.onPress() }}>
                <Ionicons name={item.icon} size={20} color={C.primaryText} />
                <Text style={styles.moreRowText}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={C.faint} />
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={planifieModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPlanifieModalVisible(false)}>
        <SafeAreaView style={styles.modalSafe} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t("Dates planifiés")}</Text>
            <TouchableOpacity onPress={() => setPlanifieModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={C.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody}>
            {filteredPlanifie.map((item) => renderPlanifieCard(item))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = themedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 20, paddingBottom: 60 },
  profileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: C.primaryText, letterSpacing: -0.3 },
  iconLine: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  emptyIconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  moreBackdrop: { flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' },
  moreSheet: { backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, width: '100%', maxWidth: 640, alignSelf: 'center' },
  moreTitle: { fontSize: 17, fontWeight: '800', color: C.text, marginBottom: 6 },
  moreRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  moreRowText: { flex: 1, fontSize: 15, fontWeight: '600', color: C.text },
  settingsBtn: { padding: 4 },
  settingsBtnText: { fontSize: 22 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8, marginBottom: 6 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: C.border },
  avatarPlaceholder: { width: 60, height: 60, borderRadius: 30, backgroundColor: C.primarySoft, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 24, fontWeight: '700', color: C.primaryText },
  avatarInfo: { flex: 1 },
  email: { fontSize: 13, color: C.muted, marginTop: 1 },
  username: { fontSize: 16, fontWeight: '700', color: C.primaryText },
  quickLinks: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8, marginBottom: 16, marginTop: 12 },
  quickLink: { alignItems: 'center', gap: 4, backgroundColor: C.primarySoft, width: '18.5%', paddingVertical: 12, paddingHorizontal: 2, borderRadius: 16 },
  quickLinkText: { color: C.primaryText, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border },
  statCardFull: { backgroundColor: C.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border, marginBottom: 20 },
  statLabel: { fontSize: 12, color: C.muted },
  statValue: { fontSize: 22, fontWeight: '700', color: C.primaryText, marginTop: 4 },
  statValueSmall: { fontSize: 16, fontWeight: '600', color: C.text, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: C.text, marginBottom: 8, marginTop: 4 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 4 },
  viewToggle: { flexDirection: 'row', backgroundColor: C.border, borderRadius: 8, padding: 2, gap: 2 },
  viewToggleBtn: { padding: 5, borderRadius: 6 },
  viewToggleBtnActive: { backgroundColor: C.primary },
  calendarBox: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  calMonthLabel: { fontSize: 15, fontWeight: '700', color: C.text },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calDow: { width: '14.28%', textAlign: 'center', fontSize: 11, fontWeight: '700', color: C.faint, paddingBottom: 6 },
  calCell: { width: '14.28%', alignItems: 'center', paddingVertical: 4, borderRadius: 8 },
  calCellSel: { backgroundColor: C.primary },
  calDay: { fontSize: 13, fontWeight: '500', color: C.text },
  calDaySel: { color: C.onPrimary, fontWeight: '700' },
  calDayEmpty: { color: C.borderStrong },
  calDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.primary, marginTop: 2 },
  calDotSel: { backgroundColor: C.card },
  calClear: { alignItems: 'center', paddingTop: 8 },
  calClearText: { fontSize: 12, color: C.faint },
  empty: { color: C.muted, textAlign: 'center', marginTop: 20 },
  emptyBox: { alignItems: 'center', backgroundColor: C.card, borderRadius: 16, padding: 24, marginTop: 8, borderWidth: 1, borderColor: C.border },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  emptySub: { fontSize: 13, color: C.muted, marginTop: 4, marginBottom: 16, textAlign: 'center' },
  emptyCta: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  emptyCtaText: { color: C.onPrimary, fontWeight: '700', fontSize: 15 },
  dateCard: { backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  conseilBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.primarySoft, borderRadius: 6, paddingVertical: 4, paddingHorizontal: 10, marginBottom: 8, alignSelf: 'flex-start' },
  conseilBadgeText: { fontSize: 11, fontWeight: '700', color: C.primaryText },
  dateCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  dateTitre: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 2 },
  dateLieu: { fontSize: 13, color: C.muted },
  dateNote: { fontSize: 15, fontWeight: '700', color: C.primaryText },
  dateDate: { fontSize: 12, color: C.muted, marginTop: 2 },
  dateComment: { fontSize: 13, color: C.text, marginTop: 6 },
  photoRow: { marginTop: 10, marginBottom: 4, minWidth: 0 },
  feedPhoto: { width: 160, height: 160, borderRadius: 10, marginRight: 8, backgroundColor: C.border },
  dateActions: { flexDirection: 'row', gap: 10, marginTop: 12, justifyContent: 'flex-end', alignItems: 'center' },
  confirmText: { flex: 1, fontSize: 13, color: C.danger, fontWeight: '500' },
  dateCardPlanifie: { borderColor: C.faint, borderStyle: 'dashed' },
  planifieSummary: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  planifieSummaryIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.primarySoft, justifyContent: 'center', alignItems: 'center' },
  planifieSummaryTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  planifieSummarySub: { fontSize: 12, color: C.muted, marginTop: 2 },
  planifieBadge: { backgroundColor: C.border, borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8 },
  planifieText: { fontSize: 11, fontWeight: '600', color: C.muted },
  searchRow: { marginBottom: 8 },
  searchInput: { backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: C.border, fontSize: 14 },
  catFilterRow: { marginBottom: 12, minWidth: 0 },
  errorBanner: { backgroundColor: C.errorBg, borderRadius: 10, padding: 12, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  errorBannerText: { color: C.errorText, fontSize: 13, flex: 1 },
  errorBannerRetry: { color: C.primaryText, fontWeight: '700', fontSize: 13 },
  catFilterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  catFilterChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  catFilterText: { fontSize: 12, color: C.text, fontWeight: '500' },
  catFilterTextActive: { color: C.onPrimary, fontWeight: '700' },
  marquerVecuBtn: { backgroundColor: C.primary, borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 16 },
  marquerVecuText: { color: C.onPrimary, fontWeight: '700', fontSize: 14 },
  vecuBanner: { backgroundColor: C.successBg, borderRadius: 10, padding: 12, marginBottom: 16 },
  vecuBannerText: { color: C.success, fontWeight: '600', fontSize: 13 },
  editBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: C.primary },
  editBtnText: { color: C.primaryText, fontSize: 13, fontWeight: '600' },
  deleteBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: C.danger },
  deleteBtnText: { color: C.danger, fontSize: 13, fontWeight: '600' },
  signOutButton: { marginTop: 20, padding: 14, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: C.border },
  signOutText: { color: C.danger, fontWeight: '600' },
  // Modal
  modalSafe: { flex: 1, backgroundColor: C.bg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle: { fontSize: 16, fontWeight: '600', color: C.text },
  modalCancel: { fontSize: 15, color: C.muted },
  modalSave: { fontSize: 15, fontWeight: '600', color: C.primaryText },
  modalBody: { padding: 20 },
  label: { fontSize: 14, fontWeight: '500', color: C.text, marginBottom: 8 },
  labelOptional: { fontSize: 12, fontWeight: '400', color: C.faint },
  input: { backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: C.border, fontSize: 15 },
  textarea: { height: 100, textAlignVertical: 'top' },
  globalNoteBox: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  globalNoteValue: { fontSize: 28, fontWeight: '700', color: C.primaryText, textAlign: 'center', marginVertical: 4 },
  conseilRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  conseilRowActive: { borderColor: C.primary, backgroundColor: C.primarySoft },
  conseilLabel: { fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 2 },
  conseilLabelActive: { color: C.primaryText },
  conseilSubtext: { fontSize: 12, color: C.muted },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  categoryChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  categoryChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  categoryChipText: { fontSize: 13, color: C.text, fontWeight: '500' },
  categoryChipTextActive: { color: C.onPrimary, fontWeight: '700' },
  visibiliteRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statutBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: 'center', backgroundColor: C.card },
  statutBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  statutBtnText: { fontSize: 14, fontWeight: '600', color: C.text },
  statutBtnTextActive: { color: C.onPrimary },
  critereBox: { backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  critereHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  critereValue: { fontSize: 14, fontWeight: '600', color: C.primaryText },
  photoGallery: { marginBottom: 24, minWidth: 0 },
  photoThumbWrapper: { position: 'relative', marginRight: 10 },
  photoThumb: { width: 90, height: 90, borderRadius: 10, backgroundColor: C.border },
  newPhotoBadge: { position: 'absolute', bottom: 4, left: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
  photoRemove: { position: 'absolute', top: -6, right: -6, backgroundColor: C.danger, width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  photoRemoveText: { color: C.onPrimary, fontWeight: '700', fontSize: 14, lineHeight: 16 },
  photoAddButton: { width: 90, height: 90, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  photoAddText: { fontSize: 28, color: C.faint },
  // Upload overlay
  uploadOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
  uploadCard: { backgroundColor: C.card, borderRadius: 20, padding: 32, alignItems: 'center', width: '100%', maxWidth: 260, gap: 10 },
  uploadTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginTop: 4 },
  uploadCount: { fontSize: 14, color: C.muted },
  progressTrack: { flexDirection: 'row', width: '100%', height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { backgroundColor: C.primary },
  goalCard: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  goalLabel: { fontSize: 14, fontWeight: '600', color: C.text },
  goalCount: { fontSize: 14, fontWeight: '700', color: C.primaryText },
  goalTrack: { flexDirection: 'row', height: 8, backgroundColor: C.border, borderRadius: 4, overflow: 'hidden' },
  goalFill: { backgroundColor: C.primary, borderRadius: 4 },
  goalDone: { fontSize: 13, color: '#2D6A2D', fontWeight: '600', marginTop: 6 },
  advFilterRow: { marginBottom: 10, flexGrow: 0, minWidth: 0 },
  advChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  advChipActive: { backgroundColor: C.text, borderColor: C.text },
  advChipText: { fontSize: 12, color: C.text, fontWeight: '500' },
  advChipTextActive: { color: C.onPrimary, fontWeight: '700' },
}))
