import { useState, useCallback, useRef, useMemo } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput, Alert, Image, ScrollView, Modal, KeyboardAvoidingView, Platform, Switch, Share } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import Slider from '@react-native-community/slider'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { decode } from 'base64-arraybuffer'
import { supabase } from '../../lib/supabase'
import { calculerMoyenne, trouverMeilleurLieu, formaterDate, dateIsoToFr, parseDateFr } from '../../lib/dateUtils'
import { webContentStyle } from '../../lib/webStyles'
import { PhotoViewer } from '../../lib/PhotoViewer'
import { CATEGORIES, getCategoryLabel } from '../../lib/categories'

const CRITERES = [
  { key: 'mood', label: 'Mood' },
  { key: 'nourriture', label: 'Nourriture' },
  { key: 'ambiance', label: 'Ambiance' },
  { key: 'personne', label: 'La personne' },
  { key: 'conversation', label: 'Conversation' },
  { key: 'prix', label: 'Prix / Valeur' },
  { key: 'envie_recommencer', label: 'Envie de recommencer' },
]

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
  dateInput: string
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
    dateInput: '',
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
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'month' | '3months' | 'year'>('all')
  const [monthlyGoal, setMonthlyGoal] = useState<number | null>(null)
  const router = useRouter()
  const userIdRef = useRef('')
  const editOriginalPhotosRef = useRef<string[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)

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
    }
    setLoading(false)
  }, [])

  useFocusEffect(useCallback(() => { loadData() }, [loadData]))


  async function openEdit(item: DateRow) {
    editOriginalPhotosRef.current = item.photos
    setEditingDate(item)
    setEditData({
      intitule: item.intitule ?? '',
      lieu: item.lieu,
      dateInput: dateIsoToFr(item.date_du_date),
      statut: item.statut ?? 'vecu',
      noteGlobale: item.note_globale,
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
      .eq('date_id', item.id).single()
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

  function handleDateInputEdit(text: string) {
    let cleaned = text.replace(/[^0-9]/g, '')
    if (cleaned.length > 2) cleaned = cleaned.slice(0, 2) + '/' + cleaned.slice(2)
    if (cleaned.length > 5) cleaned = cleaned.slice(0, 5) + '/' + cleaned.slice(5)
    if (cleaned.length > 10) cleaned = cleaned.slice(0, 10)
    setEditData((prev) => ({ ...prev, dateInput: cleaned }))
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
      Alert.alert('Limite atteinte', `Tu peux avoir ${MAX_PHOTOS} photos maximum`)
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
    if (!editData.lieu.trim()) { Alert.alert('Oups', 'Indique le lieu du date'); return }
    const dateIso = parseDateFr(editData.dateInput)
    if (!dateIso) { Alert.alert('Oups', 'Date invalide — utilise le format JJ/MM/AAAA'); return }
    if (!editingDate) return

    setSaving(true)

    // Si le date était planifié et qu'une note est saisie, il devient vécu
    const statutFinal = (editData.statut === 'planifie' && editData.noteGlobale != null)
      ? 'vecu'
      : editData.statut

    const { data: updatedDate, error: dateError } = await supabase
      .from('dates')
      .update({
        intitule: editData.intitule.trim() || null,
        lieu: editData.lieu.trim(),
        date_du_date: dateIso,
        note_globale: editData.noteGlobale,
        commentaire: editData.commentaire.trim() || null,
        statut: statutFinal,
        categorie: editData.categorie,
        visibilite: editData.visibilite,
      })
      .eq('id', editingDate.id)
      .select('id')

    if (dateError) {
      setSaving(false)
      Alert.alert('Erreur modification', dateError.message)
      return
    }

    if (!updatedDate || updatedDate.length === 0) {
      setSaving(false)
      Alert.alert('Erreur', 'Impossible de modifier ce date. Vérifie les policies RLS dans Supabase (UPDATE sur dates).')
      return
    }

    // Colonnes ajoutées en migration — erreurs ignorées si absentes
    await supabase.from('dates')
      .update({ conseil_vivement: editData.conseilVivement })
      .eq('id', editingDate.id)

    await supabase.from('ratings').update({
      mood: editData.ratings.mood,
      nourriture: editData.ratings.nourriture,
      ambiance: editData.ratings.ambiance,
      personne: editData.ratings.personne,
    }).eq('date_id', editingDate.id)

    await supabase.from('ratings').update({
      conversation: editData.ratings.conversation,
      prix: editData.ratings.prix,
      envie_recommencer: editData.ratings.envie_recommencer,
    }).eq('date_id', editingDate.id)

    const deletedUrls = editOriginalPhotosRef.current.filter(
      (url) => !editData.keptPhotoUrls.includes(url)
    )
    for (const url of deletedUrls) {
      await supabase.from('date_photos').delete()
        .eq('date_id', editingDate.id).eq('photo_url', url)
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
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' })

        const { error: uploadError } = await supabase.storage
          .from('date-photos').upload(fileName, decode(base64), { contentType: `image/${fileExt}` })
        if (uploadError) throw uploadError

        const { data } = supabase.storage.from('date-photos').getPublicUrl(fileName)
        await supabase.from('date_photos').insert({ date_id: dateId, photo_url: data.publicUrl, ordre: startOrdre + i })
      } catch {
        failCount++
      }
      setUploadProgress({ current: i + 1, total: uris.length })
    }

    setUploadingPhotos(false)
    if (failCount > 0) Alert.alert('Attention', `${failCount} photo(s) n'ont pas pu être uploadées`)
  }

  async function execDelete(id: string) {
    setDeleting(true)

    const { error: photosError } = await supabase
      .from('date_photos').delete().eq('date_id', id)
    if (photosError) {
      setDeleting(false)
      setConfirmDeleteId(null)
      Alert.alert('Erreur suppression photos', photosError.message)
      return
    }

    const { error: ratingsError } = await supabase
      .from('ratings').delete().eq('date_id', id)
    if (ratingsError) {
      setDeleting(false)
      setConfirmDeleteId(null)
      Alert.alert('Erreur suppression ratings', ratingsError.message)
      return
    }

    const { data: deleted, error } = await supabase
      .from('dates').delete().eq('id', id).select('id')

    setDeleting(false)
    setConfirmDeleteId(null)

    if (error) Alert.alert('Erreur suppression', error.message)
    else if (!deleted || deleted.length === 0) Alert.alert('Erreur', 'Suppression impossible (RLS). Exécute dans Supabase :\n\nCREATE POLICY "dates_delete_own" ON dates FOR DELETE USING (auth.uid() = user_id);')
    else loadData()
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }


  const vecuDates = useMemo(() => dates.filter((d) => d.statut !== 'planifie'), [dates])
  const planifieDates = useMemo(() => dates.filter((d) => d.statut === 'planifie'), [dates])

  const filteredVecu = useMemo(() => {
    let result = vecuDates
    if (filterCategorie) result = result.filter((d) => d.categorie === filterCategorie)
    if (filterNoteMin > 0) result = result.filter((d) => d.note_globale >= filterNoteMin)
    if (filterPeriod !== 'all') {
      const cutoff = new Date()
      if (filterPeriod === 'month') cutoff.setMonth(cutoff.getMonth() - 1)
      else if (filterPeriod === '3months') cutoff.setMonth(cutoff.getMonth() - 3)
      else cutoff.setFullYear(cutoff.getFullYear() - 1)
      const cutoffStr = cutoff.toISOString().slice(0, 10)
      result = result.filter((d) => d.date_du_date >= cutoffStr)
    }
    if (!searchQuery.trim()) return result
    const q = searchQuery.toLowerCase()
    return result.filter((d) =>
      (d.intitule ?? '').toLowerCase().includes(q) || d.lieu.toLowerCase().includes(q)
    )
  }, [vecuDates, searchQuery, filterCategorie, filterNoteMin, filterPeriod])

  const filteredPlanifie = useMemo(() => {
    if (!searchQuery.trim()) return planifieDates
    const q = searchQuery.toLowerCase()
    return planifieDates.filter((d) =>
      (d.intitule ?? '').toLowerCase().includes(q) || d.lieu.toLowerCase().includes(q)
    )
  }, [planifieDates, searchQuery])

  const moyenne = calculerMoyenne(vecuDates)
  const meilleurLieu = trouverMeilleurLieu(vecuDates)
  const editPhotoCount = editData.keptPhotoUrls.length + editData.newPhotoUris.length

  const CAL_MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
  const CAL_DOW = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

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
    await Share.share({ message: `Rejoins-moi sur Dateo ! Mon profil : @${username}` })
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
              <Text style={styles.title}>Profil</Text>
              <TouchableOpacity onPress={() => router.push('/settings')} style={styles.settingsBtn}>
                <Text style={styles.settingsBtnText}>⚙️</Text>
              </TouchableOpacity>
            </View>

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

            <View style={styles.quickLinks}>
              <TouchableOpacity onPress={() => router.push('/friends')}>
                <Text style={styles.quickLink}>👫 Amis →</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/stats')}>
                <Text style={styles.quickLink}>📊 Stats →</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/recap')}>
                <Text style={styles.quickLink}>🎉 Récap {new Date().getFullYear()} →</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/couple')}>
                <Text style={styles.quickLink}>💑 Couple →</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/notifications')}>
                <Text style={styles.quickLink}>🔔 Notifs →</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/leaderboard')}>
                <Text style={styles.quickLink}>🏆 Classement →</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/badges')}>
                <Text style={styles.quickLink}>🏅 Badges →</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/search')}>
                <Text style={styles.quickLink}>🔍 Recherche →</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/favorites')}>
                <Text style={styles.quickLink}>🔖 Favoris →</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/wishlist')}>
                <Text style={styles.quickLink}>📋 Wishlist →</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={shareProfile}>
                <Text style={styles.quickLink}>🔗 Partager →</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Dates vécus</Text>
                <Text style={styles.statValue}>{vecuDates.length}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Moyenne</Text>
                <Text style={styles.statValue}>{moyenne}/20</Text>
              </View>
            </View>

            <View style={styles.statCardFull}>
              <Text style={styles.statLabel}>Meilleur date</Text>
              <Text style={styles.statValueSmall}>{meilleurLieu}</Text>
            </View>

            {(() => {
              if (!monthlyGoal || monthlyGoal <= 0) return null
              const now = new Date()
              const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
              const thisMonthCount = vecuDates.filter((d) => d.date_du_date.startsWith(thisMonth)).length
              const pct = Math.min(thisMonthCount / monthlyGoal, 1)
              return (
                <View style={styles.goalCard}>
                  <View style={styles.goalHeader}>
                    <Text style={styles.goalLabel}>🎯 Objectif du mois</Text>
                    <Text style={styles.goalCount}>{thisMonthCount}/{monthlyGoal} dates</Text>
                  </View>
                  <View style={styles.goalTrack}>
                    <View style={[styles.goalFill, { flex: pct }]} />
                    {pct < 1 && <View style={{ flex: 1 - pct }} />}
                  </View>
                  {thisMonthCount >= monthlyGoal && (
                    <Text style={styles.goalDone}>🎉 Objectif atteint !</Text>
                  )}
                </View>
              )
            })()}

            {filteredPlanifie.length > 0 && (
              <View>
                <Text style={styles.sectionTitle}>📅 Planifiés ({filteredPlanifie.length})</Text>
                {filteredPlanifie.map((item) => (
                  <View key={item.id} style={[styles.dateCard, styles.dateCardPlanifie]}>
                    <View style={styles.dateCardHeader}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        {item.intitule ? (
                          <>
                            <Text style={styles.dateTitre}>{item.intitule}</Text>
                            <Text style={styles.dateLieu}>📍 {item.lieu}</Text>
                          </>
                        ) : (
                          <Text style={styles.dateLieu}>{item.lieu}</Text>
                        )}
                      </View>
                      <View style={styles.planifieBadge}>
                        <Text style={styles.planifieText}>Planifié</Text>
                      </View>
                    </View>
                    <Text style={styles.dateDate}>{formaterDate(item.date_du_date)}</Text>
                    {item.commentaire ? <Text style={styles.dateComment} numberOfLines={2}>{item.commentaire}</Text> : null}
                    {confirmDeleteId === item.id ? (
                      <View style={styles.dateActions}>
                        <Text style={styles.confirmText}>Supprimer ce date ?</Text>
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => execDelete(item.id)} disabled={deleting}>
                          <Text style={styles.deleteBtnText}>{deleting ? '...' : 'Oui'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.editBtn} onPress={() => setConfirmDeleteId(null)}>
                          <Text style={styles.editBtnText}>Non</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.dateActions}>
                        <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
                          <Text style={styles.editBtnText}>Modifier</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => setConfirmDeleteId(item.id)}>
                          <Text style={styles.deleteBtnText}>Supprimer</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher un date..."
                placeholderTextColor="#B8A9A0"
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
                <Text style={[styles.catFilterText, filterCategorie === null && styles.catFilterTextActive]}>Tous</Text>
              </TouchableOpacity>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.key}
                  style={[styles.catFilterChip, filterCategorie === cat.key && styles.catFilterChipActive]}
                  onPress={() => setFilterCategorie(filterCategorie === cat.key ? null : cat.key)}
                >
                  <Text style={[styles.catFilterText, filterCategorie === cat.key && styles.catFilterTextActive]}>
                    {cat.emoji} {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.advFilterRow} contentContainerStyle={{ gap: 6, paddingRight: 4 }}>
              {([['all', 'Toute période'], ['month', '1 mois'], ['3months', '3 mois'], ['year', '1 an']] as const).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.advChip, filterPeriod === key && styles.advChipActive]}
                  onPress={() => setFilterPeriod(key)}
                >
                  <Text style={[styles.advChipText, filterPeriod === key && styles.advChipTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
              <View style={styles.advChipDivider} />
              {([0, 10, 14, 16, 18] as const).map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[styles.advChip, filterNoteMin === n && styles.advChipActive]}
                  onPress={() => setFilterNoteMin(n)}
                >
                  <Text style={[styles.advChipText, filterNoteMin === n && styles.advChipTextActive]}>{n > 0 ? `≥${n}/20` : 'Toute note'}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Historique ({vecuDates.length})</Text>
              <View style={styles.viewToggle}>
                <TouchableOpacity
                  style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
                  onPress={() => { setViewMode('list'); setSelectedDay(null) }}
                >
                  <Ionicons name="list" size={16} color={viewMode === 'list' ? '#fff' : '#B8A9A0'} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.viewToggleBtn, viewMode === 'calendar' && styles.viewToggleBtnActive]}
                  onPress={() => setViewMode('calendar')}
                >
                  <Ionicons name="calendar" size={16} color={viewMode === 'calendar' ? '#fff' : '#B8A9A0'} />
                </TouchableOpacity>
              </View>
            </View>

            {viewMode === 'calendar' && (
              <View style={styles.calendarBox}>
                <View style={styles.calHeader}>
                  <TouchableOpacity onPress={() => { setSelectedDay(null); setCalMonth((p) => { const d = new Date(p.year, p.month - 1); return { year: d.getFullYear(), month: d.getMonth() } }) }}>
                    <Ionicons name="chevron-back" size={20} color="#D4517E" />
                  </TouchableOpacity>
                  <Text style={styles.calMonthLabel}>{CAL_MOIS[calMonth.month]} {calMonth.year}</Text>
                  <TouchableOpacity onPress={() => { setSelectedDay(null); setCalMonth((p) => { const d = new Date(p.year, p.month + 1); return { year: d.getFullYear(), month: d.getMonth() } }) }}>
                    <Ionicons name="chevron-forward" size={20} color="#D4517E" />
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
                    <Text style={styles.calClearText}>× Effacer la sélection</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {loading && <ActivityIndicator color="#D4517E" style={{ marginTop: 20 }} />}
            {!loading && vecuDates.length === 0 && <Text style={styles.empty}>Aucun date noté pour l'instant</Text>}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.dateCard}>
            {item.conseil_vivement && (
              <View style={styles.conseilBadge}>
                <Text style={styles.conseilBadgeText}>💖 Conseillé vivement</Text>
              </View>
            )}
            <View style={styles.dateCardHeader}>
              <View style={{ flex: 1, marginRight: 8 }}>
                {item.intitule ? (
                  <>
                    <Text style={styles.dateTitre}>{item.intitule}</Text>
                    <Text style={styles.dateLieu}>📍 {item.lieu}</Text>
                  </>
                ) : (
                  <Text style={styles.dateLieu}>{item.lieu}</Text>
                )}
              </View>
              <Text style={styles.dateNote}>{item.note_globale}/20</Text>
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
                <Text style={styles.confirmText}>Supprimer ce date ?</Text>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => execDelete(item.id)} disabled={deleting}>
                  <Text style={styles.deleteBtnText}>{deleting ? '...' : 'Oui'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.editBtn} onPress={() => setConfirmDeleteId(null)}>
                  <Text style={styles.editBtnText}>Non</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.dateActions}>
                <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
                  <Text style={styles.editBtnText}>Modifier</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => setConfirmDeleteId(item.id)}>
                  <Text style={styles.deleteBtnText}>Supprimer</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          !loading && searchQuery.trim() ? (
            <Text style={styles.empty}>Aucun résultat pour "{searchQuery}"</Text>
          ) : null
        }
        ListFooterComponent={
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Se déconnecter</Text>
          </TouchableOpacity>
        }
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
                <Text style={styles.modalCancel}>Annuler</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Modifier le date</Text>
              <TouchableOpacity onPress={handleSaveEdit} disabled={saving || uploadingPhotos}>
                <Text style={styles.modalSave}>{saving ? '...' : 'Enregistrer'}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {editData.statut === 'planifie' && (
                <TouchableOpacity
                  style={styles.marquerVecuBtn}
                  onPress={() => setEditData((prev) => ({ ...prev, statut: 'vecu' }))}
                >
                  <Text style={styles.marquerVecuText}>✓ Marquer comme vécu</Text>
                </TouchableOpacity>
              )}
              {editData.statut === 'vecu' && editingDate?.statut === 'planifie' && (
                <View style={styles.vecuBanner}>
                  <Text style={styles.vecuBannerText}>✓ Ce date sera déplacé dans l'historique</Text>
                </View>
              )}

              <Text style={styles.label}>Intitulé <Text style={styles.labelOptional}>(optionnel)</Text></Text>
              <TextInput
                style={styles.input}
                value={editData.intitule}
                onChangeText={(v) => setEditData((prev) => ({ ...prev, intitule: v }))}
                placeholder="Ex : Dîner romantique, Soirée ciné..."
                placeholderTextColor="#B8A9A0"
              />

              <Text style={styles.label}>Lieu</Text>
              <TextInput
                style={styles.input}
                value={editData.lieu}
                onChangeText={(v) => setEditData((prev) => ({ ...prev, lieu: v }))}
                placeholder="Lieu du date"
                placeholderTextColor="#B8A9A0"
              />

              <Text style={styles.label}>Date</Text>
              <TextInput
                style={styles.input}
                value={editData.dateInput}
                onChangeText={handleDateInputEdit}
                placeholder="JJ/MM/AAAA"
                placeholderTextColor="#B8A9A0"
                keyboardType="numeric"
                maxLength={10}
              />

              <Text style={styles.label}>Catégorie <Text style={styles.labelOptional}>(optionnel)</Text></Text>
              <View style={styles.categoryRow}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.key}
                    style={[styles.categoryChip, editData.categorie === cat.key && styles.categoryChipActive]}
                    onPress={() => setEditData((prev) => ({ ...prev, categorie: prev.categorie === cat.key ? null : cat.key }))}
                  >
                    <Text style={[styles.categoryChipText, editData.categorie === cat.key && styles.categoryChipTextActive]}>
                      {cat.emoji} {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.globalNoteBox}>
                <Text style={styles.label}>Note globale</Text>
                <Text style={styles.globalNoteValue}>{editData.noteGlobale}/20</Text>
                <Slider
                  style={{ width: '100%', height: 40 }}
                  minimumValue={0} maximumValue={20} step={0.25}
                  value={editData.noteGlobale}
                  onValueChange={(v) => setEditData((prev) => ({ ...prev, noteGlobale: v }))}
                  minimumTrackTintColor="#D4517E" maximumTrackTintColor="#F0D9D9" thumbTintColor="#D4517E"
                />
              </View>

              <Text style={styles.sectionTitle}>Détails</Text>
              {loadingEditData ? (
                <ActivityIndicator color="#D4517E" style={{ marginVertical: 12 }} />
              ) : (
                CRITERES.map((c) => (
                  <View key={c.key} style={styles.critereBox}>
                    <View style={styles.critereHeader}>
                      <Text style={styles.label}>{c.label}</Text>
                      <Text style={styles.critereValue}>{editData.ratings[c.key as keyof EditRatings]}/5</Text>
                    </View>
                    <Slider
                      style={{ width: '100%', height: 36 }}
                      minimumValue={0} maximumValue={5} step={0.25}
                      value={editData.ratings[c.key as keyof EditRatings]}
                      onValueChange={(v) => updateEditRating(c.key, v)}
                      minimumTrackTintColor="#D4517E" maximumTrackTintColor="#F0D9D9" thumbTintColor="#D4517E"
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
                    💖 Je conseille vivement
                  </Text>
                  <Text style={styles.conseilSubtext}>Mis en avant sur le feed de tes amis</Text>
                </View>
                <Switch
                  value={editData.conseilVivement}
                  onValueChange={(v) => setEditData((prev) => ({ ...prev, conseilVivement: v }))}
                  trackColor={{ false: '#F0D9D9', true: '#D4517E' }}
                  thumbColor="#fff"
                  ios_backgroundColor="#F0D9D9"
                />
              </TouchableOpacity>

              <View style={styles.visibiliteRow}>
                <TouchableOpacity
                  style={[styles.statutBtn, editData.visibilite === 'friends' && styles.statutBtnActive]}
                  onPress={() => setEditData((prev) => ({ ...prev, visibilite: 'friends' }))}
                >
                  <Text style={[styles.statutBtnText, editData.visibilite === 'friends' && styles.statutBtnTextActive]}>👫 Visible par mes amis</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.statutBtn, editData.visibilite === 'private' && styles.statutBtnActive]}
                  onPress={() => setEditData((prev) => ({ ...prev, visibilite: 'private' }))}
                >
                  <Text style={[styles.statutBtnText, editData.visibilite === 'private' && styles.statutBtnTextActive]}>🔒 Privé</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Commentaire</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={editData.commentaire}
                onChangeText={(v) => setEditData((prev) => ({ ...prev, commentaire: v }))}
                placeholder="Raconte ton date..."
                placeholderTextColor="#B8A9A0"
                multiline
                numberOfLines={4}
              />

              <Text style={styles.label}>Photos ({editPhotoCount}/{MAX_PHOTOS})</Text>
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
                <ActivityIndicator color="#D4517E" size="large" />
                <Text style={styles.uploadTitle}>Envoi des photos</Text>
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
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF8F5' },
  container: { flex: 1, backgroundColor: '#FFF8F5' },
  content: { padding: 20, paddingBottom: 60 },
  profileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '600', color: '#D4517E' },
  settingsBtn: { padding: 4 },
  settingsBtnText: { fontSize: 22 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8, marginBottom: 6 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#F0D9D9' },
  avatarPlaceholder: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FDE8F0', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 24, fontWeight: '700', color: '#D4517E' },
  avatarInfo: { flex: 1 },
  email: { fontSize: 13, color: '#888', marginTop: 1 },
  username: { fontSize: 16, fontWeight: '700', color: '#D4517E' },
  quickLinks: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 16, marginTop: 12 },
  quickLink: { color: '#D4517E', fontSize: 13, fontWeight: '600', backgroundColor: '#FDE8F0', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#F0D9D9' },
  statCardFull: { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#F0D9D9', marginBottom: 20 },
  statLabel: { fontSize: 12, color: '#888' },
  statValue: { fontSize: 22, fontWeight: '700', color: '#D4517E', marginTop: 4 },
  statValueSmall: { fontSize: 16, fontWeight: '600', color: '#5C4A45', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#5C4A45', marginBottom: 8, marginTop: 4 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 4 },
  viewToggle: { flexDirection: 'row', backgroundColor: '#F0D9D9', borderRadius: 8, padding: 2, gap: 2 },
  viewToggleBtn: { padding: 5, borderRadius: 6 },
  viewToggleBtnActive: { backgroundColor: '#D4517E' },
  calendarBox: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#F0D9D9' },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  calMonthLabel: { fontSize: 15, fontWeight: '700', color: '#5C4A45' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calDow: { width: '14.28%', textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#B8A9A0', paddingBottom: 6 },
  calCell: { width: '14.28%', alignItems: 'center', paddingVertical: 4, borderRadius: 8 },
  calCellSel: { backgroundColor: '#D4517E' },
  calDay: { fontSize: 13, fontWeight: '500', color: '#5C4A45' },
  calDaySel: { color: '#fff', fontWeight: '700' },
  calDayEmpty: { color: '#D0C5C0' },
  calDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#D4517E', marginTop: 2 },
  calDotSel: { backgroundColor: '#fff' },
  calClear: { alignItems: 'center', paddingTop: 8 },
  calClearText: { fontSize: 12, color: '#B8A9A0' },
  empty: { color: '#888', textAlign: 'center', marginTop: 20 },
  dateCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#F0D9D9' },
  conseilBadge: { backgroundColor: '#FDE8F0', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 10, marginBottom: 8, alignSelf: 'flex-start' },
  conseilBadgeText: { fontSize: 11, fontWeight: '700', color: '#D4517E' },
  dateCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  dateTitre: { fontSize: 15, fontWeight: '700', color: '#5C4A45', marginBottom: 2 },
  dateLieu: { fontSize: 13, color: '#888' },
  dateNote: { fontSize: 15, fontWeight: '700', color: '#D4517E' },
  dateDate: { fontSize: 12, color: '#888', marginTop: 2 },
  dateComment: { fontSize: 13, color: '#5C4A45', marginTop: 6 },
  photoRow: { marginTop: 10, marginBottom: 4 },
  feedPhoto: { width: 160, height: 160, borderRadius: 10, marginRight: 8, backgroundColor: '#F0D9D9' },
  dateActions: { flexDirection: 'row', gap: 10, marginTop: 12, justifyContent: 'flex-end', alignItems: 'center' },
  confirmText: { flex: 1, fontSize: 13, color: '#D85A30', fontWeight: '500' },
  dateCardPlanifie: { borderColor: '#B8A9A0', borderStyle: 'dashed' },
  planifieBadge: { backgroundColor: '#F0F0F0', borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8 },
  planifieText: { fontSize: 11, fontWeight: '600', color: '#888' },
  searchRow: { marginBottom: 8 },
  searchInput: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#F0D9D9', fontSize: 14 },
  catFilterRow: { marginBottom: 12 },
  catFilterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#F0D9D9' },
  catFilterChipActive: { backgroundColor: '#D4517E', borderColor: '#D4517E' },
  catFilterText: { fontSize: 12, color: '#5C4A45', fontWeight: '500' },
  catFilterTextActive: { color: '#fff', fontWeight: '700' },
  marquerVecuBtn: { backgroundColor: '#D4517E', borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 16 },
  marquerVecuText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  vecuBanner: { backgroundColor: '#EAF3DE', borderRadius: 10, padding: 12, marginBottom: 16 },
  vecuBannerText: { color: '#3B6D11', fontWeight: '600', fontSize: 13 },
  editBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#D4517E' },
  editBtnText: { color: '#D4517E', fontSize: 13, fontWeight: '600' },
  deleteBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#D85A30' },
  deleteBtnText: { color: '#D85A30', fontSize: 13, fontWeight: '600' },
  signOutButton: { marginTop: 20, padding: 14, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#F0D9D9' },
  signOutText: { color: '#D85A30', fontWeight: '600' },
  // Modal
  modalSafe: { flex: 1, backgroundColor: '#FFF8F5' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F0D9D9' },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#5C4A45' },
  modalCancel: { fontSize: 15, color: '#888' },
  modalSave: { fontSize: 15, fontWeight: '600', color: '#D4517E' },
  modalBody: { padding: 20 },
  label: { fontSize: 14, fontWeight: '500', color: '#5C4A45', marginBottom: 8 },
  labelOptional: { fontSize: 12, fontWeight: '400', color: '#B8A9A0' },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#F0D9D9', fontSize: 15 },
  textarea: { height: 100, textAlignVertical: 'top' },
  globalNoteBox: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F0D9D9' },
  globalNoteValue: { fontSize: 28, fontWeight: '700', color: '#D4517E', textAlign: 'center', marginVertical: 4 },
  conseilRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#F0D9D9' },
  conseilRowActive: { borderColor: '#D4517E', backgroundColor: '#FDE8F0' },
  conseilLabel: { fontSize: 14, fontWeight: '600', color: '#5C4A45', marginBottom: 2 },
  conseilLabelActive: { color: '#D4517E' },
  conseilSubtext: { fontSize: 12, color: '#888' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  categoryChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#F0D9D9' },
  categoryChipActive: { backgroundColor: '#D4517E', borderColor: '#D4517E' },
  categoryChipText: { fontSize: 13, color: '#5C4A45', fontWeight: '500' },
  categoryChipTextActive: { color: '#fff', fontWeight: '700' },
  visibiliteRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statutBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#F0D9D9', alignItems: 'center', backgroundColor: '#fff' },
  statutBtnActive: { backgroundColor: '#D4517E', borderColor: '#D4517E' },
  statutBtnText: { fontSize: 14, fontWeight: '600', color: '#5C4A45' },
  statutBtnTextActive: { color: '#fff' },
  critereBox: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#F0D9D9' },
  critereHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  critereValue: { fontSize: 14, fontWeight: '600', color: '#D4517E' },
  photoGallery: { marginBottom: 24 },
  photoThumbWrapper: { position: 'relative', marginRight: 10 },
  photoThumb: { width: 90, height: 90, borderRadius: 10, backgroundColor: '#F0D9D9' },
  newPhotoBadge: { position: 'absolute', bottom: 4, left: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: '#D4517E' },
  photoRemove: { position: 'absolute', top: -6, right: -6, backgroundColor: '#D85A30', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  photoRemoveText: { color: '#fff', fontWeight: '700', fontSize: 14, lineHeight: 16 },
  photoAddButton: { width: 90, height: 90, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#F0D9D9', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  photoAddText: { fontSize: 28, color: '#B8A9A0' },
  // Upload overlay
  uploadOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
  uploadCard: { backgroundColor: '#fff', borderRadius: 20, padding: 32, alignItems: 'center', width: 260, gap: 10 },
  uploadTitle: { fontSize: 16, fontWeight: '700', color: '#5C4A45', marginTop: 4 },
  uploadCount: { fontSize: 14, color: '#888' },
  progressTrack: { flexDirection: 'row', width: '100%', height: 6, backgroundColor: '#F0D9D9', borderRadius: 3, overflow: 'hidden' },
  progressFill: { backgroundColor: '#D4517E' },
  goalCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#F0D9D9' },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  goalLabel: { fontSize: 14, fontWeight: '600', color: '#5C4A45' },
  goalCount: { fontSize: 14, fontWeight: '700', color: '#D4517E' },
  goalTrack: { flexDirection: 'row', height: 8, backgroundColor: '#F0D9D9', borderRadius: 4, overflow: 'hidden' },
  goalFill: { backgroundColor: '#D4517E', borderRadius: 4 },
  goalDone: { fontSize: 13, color: '#2D6A2D', fontWeight: '600', marginTop: 6 },
  advFilterRow: { marginBottom: 10, flexGrow: 0 },
  advChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#F0D9D9' },
  advChipActive: { backgroundColor: '#5C4A45', borderColor: '#5C4A45' },
  advChipText: { fontSize: 12, color: '#5C4A45', fontWeight: '500' },
  advChipTextActive: { color: '#fff', fontWeight: '700' },
  advChipDivider: { width: 1, backgroundColor: '#F0D9D9', marginHorizontal: 4, alignSelf: 'stretch' },
})
