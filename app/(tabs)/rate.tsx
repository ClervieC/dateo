import { useState, useEffect, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Switch, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { NotificationBell } from '../../lib/NotificationBell'
import { toastStore } from '../../lib/toastStore'
import { CATEGORIES } from '../../lib/categories'
import Slider from '@react-native-community/slider'
import { supabase } from '../../lib/supabase'
import { webContentStyle } from '../../lib/webStyles'
import { todayIso, formatNote } from '../../lib/dateUtils'
import { DatePicker } from '../../lib/DatePicker'
import * as ImagePicker from 'expo-image-picker'
import { Image } from 'react-native'
import { uriToBlob } from '../../lib/uploadImage'
import { showAlert, confirmAction } from '../../lib/alert'
import { saveRatings, EMPTY_RATINGS, Ratings } from '../../lib/ratings'
import { hapticSelect, hapticSuccess } from '../../lib/haptics'
import { CRITERES } from '../../lib/criteres'
import { useBottomTabs } from '../../lib/useBottomTabs'
import { t } from '../../lib/i18n'
import { C, themedStyles } from '../../lib/theme'

const RATE_DRAFT_KEY = 'rateFormDraft'
// Rien n'est pré-noté : une valeur par défaut (10/20, 3/5) fausserait les données
const DEFAULT_RATINGS = EMPTY_RATINGS
const clampNote = (v: number) => Math.max(0, Math.min(20, Math.round(v * 4) / 4))


type PlanifieDate = {
  id: string
  intitule: string | null
  lieu: string
  date_du_date: string
  categorie: string | null
  visibilite: string
}

type Companion = { id: string; username: string }

type WishlistLieu = {
  id: string
  nom: string
  adresse: string | null
  categorie: string | null
}

export default function Rate() {
  const { lieu: lieuParam, intitule: intituleParam, planifieId: planifieIdParam, wishlistId: wishlistIdParam } =
    useLocalSearchParams<{ lieu?: string; intitule?: string; planifieId?: string; wishlistId?: string }>()
  const [intitule, setIntitule] = useState(typeof intituleParam === 'string' ? intituleParam : '')
  const [lieu, setLieu] = useState(typeof lieuParam === 'string' ? lieuParam : '')
  const [dateIso, setDateIso] = useState(todayIso())
  const [commentaire, setCommentaire] = useState('')
  const [noteGlobale, setNoteGlobale] = useState<number | null>(null)
  const [ratings, setRatings] = useState<Ratings>(DEFAULT_RATINGS)
  const [showDetails, setShowDetails] = useState(false)
  const [noteError, setNoteError] = useState('')
  const noteCardY = useRef(0)
  const [conseilVivement, setConseilVivement] = useState(false)
  const [statut, setStatut] = useState<'vecu' | 'planifie'>('vecu')
  const [categorie, setCategorie] = useState<string | null>(null)
  const [visibilite, setVisibilite] = useState<'friends' | 'private'>('friends')
  const [saving, setSaving] = useState(false)
  const [photoUris, setPhotoUris] = useState<string[]>([])
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
  const [planifiedDates, setPlanifiedDates] = useState<PlanifieDate[]>([])
  const [editingPlanifieId, setEditingPlanifieId] = useState<string | null>(null)
  const [companions, setCompanions] = useState<Companion[]>([])
  const [selectedCompanionIds, setSelectedCompanionIds] = useState<Set<string>>(new Set())
  const [partnerId, setPartnerId] = useState<string | null>(null)
  const [partnerDateDebut, setPartnerDateDebut] = useState<string | null>(null)
  const [wishlistLieux, setWishlistLieux] = useState<WishlistLieu[]>([])
  const [selectedWishlistId, setSelectedWishlistId] = useState<string | null>(null)
  const [pickerVisible, setPickerVisible] = useState(false)
  const [lieuError, setLieuError] = useState('')
  const scrollRef = useRef<ScrollView>(null)
  const router = useRouter()
  // Cloche dans l'en-tête sur téléphone ; sur ordinateur elle est dans la barre du haut
  const showBell = useBottomTabs()
  const draftReadyRef = useRef(false)

  useEffect(() => {
    if (lieuParam && typeof lieuParam === 'string') setLieu(lieuParam)
    if (intituleParam && typeof intituleParam === 'string') setIntitule(intituleParam)
  }, [lieuParam, intituleParam])

  // Ouvert depuis le détail d'un date planifié (« Noter ce date ») ou depuis
  // « Lieux à essayer » (« J'y suis allé ») : on préremplit avec cette source.
  useEffect(() => {
    if (typeof planifieIdParam !== 'string' || !planifieIdParam) return
    supabase
      .from('dates')
      .select('id, intitule, lieu, date_du_date, categorie, visibilite')
      .eq('id', planifieIdParam)
      .eq('statut', 'planifie')
      .maybeSingle()
      .then(({ data }) => { if (data) selectPlanifie(data as PlanifieDate) })
  }, [planifieIdParam])

  useEffect(() => {
    if (typeof wishlistIdParam !== 'string' || !wishlistIdParam) return
    supabase
      .from('wishlist_lieux')
      .select('id, nom, adresse, categorie')
      .eq('id', wishlistIdParam)
      .maybeSingle()
      .then(({ data }) => { if (data) selectWishlistLieu(data as WishlistLieu) })
  }, [wishlistIdParam])

  // Restaure le brouillon (si l'écran n'a pas été ouvert avec une source préremplie)
  // pour ne pas perdre la saisie quand on change d'onglet puis qu'on revient.
  useEffect(() => {
    async function restoreDraft() {
      if (!lieuParam && !intituleParam && !planifieIdParam && !wishlistIdParam) {
        const raw = await AsyncStorage.getItem(RATE_DRAFT_KEY)
        if (raw) {
          try {
            const d = JSON.parse(raw)
            setIntitule(d.intitule ?? '')
            setLieu(d.lieu ?? '')
            setDateIso(d.dateIso ?? todayIso())
            setCommentaire(d.commentaire ?? '')
            setNoteGlobale(d.noteGlobale ?? null)
            setRatings(d.ratings ?? DEFAULT_RATINGS)
            setConseilVivement(d.conseilVivement ?? false)
            setStatut(d.statut ?? 'vecu')
            setCategorie(d.categorie ?? null)
            setVisibilite(d.visibilite ?? 'friends')
            setPhotoUris(d.photoUris ?? [])
            setEditingPlanifieId(d.editingPlanifieId ?? null)
            setSelectedCompanionIds(new Set(d.selectedCompanionIds ?? []))
            setSelectedWishlistId(d.selectedWishlistId ?? null)
          } catch {}
        }
      }
      draftReadyRef.current = true
    }
    restoreDraft()
  }, [])

  // Sauvegarde le brouillon à chaque changement, pour survivre à un changement d'onglet.
  useEffect(() => {
    if (!draftReadyRef.current) return
    const draft = {
      intitule, lieu, dateIso, commentaire, noteGlobale, ratings, conseilVivement,
      statut, categorie, visibilite, photoUris, editingPlanifieId,
      selectedCompanionIds: [...selectedCompanionIds], selectedWishlistId,
    }
    AsyncStorage.setItem(RATE_DRAFT_KEY, JSON.stringify(draft)).catch(() => {})
  }, [intitule, lieu, dateIso, commentaire, noteGlobale, ratings, conseilVivement, statut, categorie, visibilite, photoUris, editingPlanifieId, selectedCompanionIds, selectedWishlistId])

  useEffect(() => {
    loadPlanifiedDates()
    loadCompanions()
    loadWishlist()
  }, [])

  // Pré-sélectionne automatiquement le/la partenaire si le date a lieu après la mise en couple.
  // Reste modifiable : l'utilisateur peut le/la retirer ou ajouter d'autres personnes (ex: date entre amis).
  useEffect(() => {
    if (!partnerId || !partnerDateDebut) return
    if (dateIso >= partnerDateDebut) {
      setSelectedCompanionIds((prev) => new Set(prev).add(partnerId))
    }
  }, [dateIso, partnerId, partnerDateDebut])

  async function loadPlanifiedDates() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('dates')
      .select('id, intitule, lieu, date_du_date, categorie, visibilite')
      .eq('user_id', user.id)
      .eq('statut', 'planifie')
      .order('date_du_date', { ascending: true })
    setPlanifiedDates((data ?? []) as PlanifieDate[])
  }

  async function loadCompanions() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: friendships }, { data: coupleRow }] = await Promise.all([
      supabase.from('friends').select('user_id, friend_id').or(`user_id.eq.${user.id},friend_id.eq.${user.id}`).eq('status', 'accepted'),
      supabase.from('couples').select('user1_id, user2_id, date_debut').or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`).eq('status', 'accepted').maybeSingle(),
    ])
    const friendIds = (friendships ?? []).map((f: any) => f.user_id === user.id ? f.friend_id : f.user_id)
    const coupledPartnerId = coupleRow ? (coupleRow.user1_id === user.id ? coupleRow.user2_id : coupleRow.user1_id) : null
    setPartnerId(coupledPartnerId)
    setPartnerDateDebut((coupleRow as any)?.date_debut ?? null)
    const allIds = [...new Set([...friendIds, ...(coupledPartnerId ? [coupledPartnerId] : [])])]
    if (allIds.length === 0) return

    const { data: profiles } = await supabase.from('profiles').select('id, username').in('id', allIds)
    setCompanions((profiles ?? []) as Companion[])
  }

  async function loadWishlist() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('wishlist_lieux')
      .select('id, nom, adresse, categorie')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setWishlistLieux((data ?? []) as WishlistLieu[])
  }

  function selectWishlistLieu(item: WishlistLieu) {
    setEditingPlanifieId(null)
    setSelectedWishlistId(item.id)
    setLieu(item.nom)
    setIntitule('')
    setCategorie(item.categorie)
    setStatut('vecu')
    setPickerVisible(false)
  }

  function toggleCompanion(id: string) {
    setSelectedCompanionIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectPlanifie(item: PlanifieDate) {
    setEditingPlanifieId(item.id)
    setSelectedWishlistId(null)
    setIntitule(item.intitule ?? '')
    setLieu(item.lieu)
    setDateIso(item.date_du_date)
    setCategorie(item.categorie)
    setVisibilite((item.visibilite as 'friends' | 'private') ?? 'friends')
    setStatut('vecu')
    setPickerVisible(false)
  }

  function resetForm() {
    setIntitule('')
    setLieu('')
    setDateIso(todayIso())
    setCommentaire('')
    setNoteGlobale(null)
    setRatings(DEFAULT_RATINGS)
    setShowDetails(false)
    setNoteError('')
    setConseilVivement(false)
    setStatut('vecu')
    setCategorie(null)
    setVisibilite('friends')
    setPhotoUris([])
    setEditingPlanifieId(null)
    setSelectedCompanionIds(new Set())
    setSelectedWishlistId(null)
    AsyncStorage.removeItem(RATE_DRAFT_KEY).catch(() => {})
  }

  function confirmResetForm() {
    confirmAction(t("Réinitialiser le formulaire ?"), t("Toutes les informations saisies seront effacées."), t("Réinitialiser"), resetForm)
  }

  function clearSource() {
    setEditingPlanifieId(null)
    setSelectedWishlistId(null)
    setIntitule('')
    setLieu('')
    setDateIso(todayIso())
    setCategorie(null)
    setVisibilite('friends')
    setStatut('vecu')
  }

  const MAX_PHOTOS = 10

  function updateRating(key: string, value: number | null) {
    setRatings((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (saving) return
    if (!lieu.trim()) {
      setLieuError(t("Indique le lieu du date"))
      scrollRef.current?.scrollTo({ y: 0, animated: true })
      return
    }
    if (statut === 'vecu' && noteGlobale == null) {
      setNoteError(t("Donne une note globale à ton date"))
      scrollRef.current?.scrollTo({ y: Math.max(0, noteCardY.current - 20), animated: true })
      return
    }

    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      showAlert(t("Erreur"), t("Tu dois être connecté"))
      return
    }

    const payload = {
      intitule: intitule.trim() || null,
      lieu: lieu.trim(),
      date_du_date: dateIso,
      note_globale: statut === 'vecu' && noteGlobale != null ? clampNote(noteGlobale) : null,
      commentaire,
      conseil_vivement: conseilVivement,
      statut,
      categorie,
      visibilite,
    }

    const { data: dateRow, error: dateError } = editingPlanifieId
      ? await supabase.from('dates').update(payload).eq('id', editingPlanifieId).select().single()
      : await supabase.from('dates').insert({ user_id: user.id, ...payload }).select().single()

    if (dateError) {
      setSaving(false)
      showAlert(t("Impossible d'enregistrer le date"), dateError.message)
      return
    }

    await uploadPhotos(user.id, dateRow.id)

    // Un date planifié n'a pas encore de note : on n'enregistre pas de critères par défaut
    const { error: ratingError } = statut === 'vecu' ? await saveRatings(dateRow.id, ratings) : { error: null }

    if (selectedCompanionIds.size > 0) {
      await supabase.from('date_participants').upsert(
        [...selectedCompanionIds].map((id) => ({ date_id: dateRow.id, user_id: id })),
        { onConflict: 'date_id,user_id', ignoreDuplicates: true }
      )
    }

    if (statut === 'vecu' && selectedWishlistId) {
      await supabase.from('wishlist_lieux').delete().eq('id', selectedWishlistId)
    }

    setSaving(false)

    if (ratingError) {
      showAlert(t("Date enregistré, mais pas le détail des notes"), ratingError.message)
    }

    resetForm()
    hapticSuccess()

    toastStore.set(statut === 'vecu' ? t("Date enregistré ✓") : t("Date planifié ✓ Tu pourras le noter une fois passé"))
    router.replace('/(tabs)/feed')
  }

  async function pickImages() {
    if (photoUris.length >= MAX_PHOTOS) {
      showAlert(t("Limite atteinte"), t("Tu peux ajouter {n} photos maximum", { n: MAX_PHOTOS }))
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photoUris.length,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    })

    if (!result.canceled) {
      const newUris = result.assets.map((a) => a.uri)
      setPhotoUris((prev) => [...prev, ...newUris].slice(0, MAX_PHOTOS))
    }
  }

  function removePhoto(uri: string) {
    setPhotoUris((prev) => prev.filter((u) => u !== uri))
  }

  async function uploadPhotos(userId: string, dateId: string) {
    if (photoUris.length === 0) return

    const total = photoUris.length
    setUploadingPhotos(true)
    setUploadProgress({ current: 0, total })

    const batchId = Date.now()
    let failCount = 0

    for (let i = 0; i < photoUris.length; i++) {
      try {
        const uri = photoUris[i]
        const fileExt = uri.split('.').pop()?.toLowerCase() ?? 'jpg'
        const fileName = `${userId}/${batchId}_${i}.${fileExt}`

        const blob = await uriToBlob(uri)

        const { error: uploadError } = await supabase.storage
          .from('date-photos')
          .upload(fileName, blob, { contentType: `image/${fileExt}` })

        if (uploadError) throw uploadError

        const { data } = supabase.storage.from('date-photos').getPublicUrl(fileName)

        await supabase.from('date_photos').insert({
          date_id: dateId,
          photo_url: data.publicUrl,
          ordre: i,
        })
      } catch {
        failCount++
      }

      setUploadProgress({ current: i + 1, total })
    }

    setUploadingPhotos(false)

    if (failCount > 0) {
      showAlert(t("Attention"), t("{n} photo(s) n'ont pas pu être envoyée(s)", { n: failCount }))
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={[styles.content, webContentStyle]} keyboardShouldPersistTaps="handled">
          <View style={styles.titleRow}>
            <Text style={styles.title}>{editingPlanifieId ? t("Noter un date planifié") : t("Nouveau date")}</Text>
            {showBell && <NotificationBell style={styles.bellBtn} />}
          </View>

          {!editingPlanifieId && !selectedWishlistId && (planifiedDates.length > 0 || wishlistLieux.length > 0) && (
            <TouchableOpacity style={styles.sourceEntryBtn} onPress={() => setPickerVisible(true)} activeOpacity={0.8}>
              <Ionicons name="calendar-outline" size={16} color={C.primary} />
              <Text style={styles.sourceEntryText}>{t("Partir d'un date planifié ou d'un lieu à essayer")}</Text>
              <Ionicons name="chevron-forward" size={14} color={C.faint} />
            </TouchableOpacity>
          )}

          {(editingPlanifieId || selectedWishlistId) && (
            <View style={styles.sourceBadge}>
              <Text style={styles.sourceBadgeText} numberOfLines={1}>
                {editingPlanifieId ? t("Depuis ton date planifié : {lieu}", { lieu }) : t("Depuis « Lieux à essayer » : {lieu}", { lieu })}
              </Text>
              <TouchableOpacity onPress={clearSource} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={20} color={C.primary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Statut : segmenté plutôt qu'un switch dont le libellé change */}
          <View style={styles.segmented}>
            {([
              { key: 'vecu', label: t("Déjà vécu"), icon: 'checkmark-circle' as const },
              { key: 'planifie', label: t("À venir"), icon: 'calendar' as const },
            ] as const).map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.segment, statut === opt.key && styles.segmentActive]}
                onPress={() => setStatut(opt.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: statut === opt.key }}
              >
                <Ionicons name={opt.icon} size={16} color={statut === opt.key ? C.onPrimary : C.faint} />
                <Text style={[styles.segmentText, statut === opt.key && styles.segmentTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.segmentHint}>
            {statut === 'vecu' ? t("Note ce date dès maintenant") : t("Garde-le de côté, tu pourras le noter une fois passé")}
          </Text>

          {/* Infos principales */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("Infos")}</Text>

            <Text style={styles.label}>{t("Lieu")}</Text>
            <TextInput
              style={[styles.input, !!lieuError && styles.inputError]}
              placeholder={t("Ex : Le Petit Café, Bucarest")}
              placeholderTextColor={C.faint}
              value={lieu}
              onChangeText={(v) => { setLieu(v); if (v.trim()) setLieuError('') }}
            />
            {lieuError ? <Text style={styles.fieldError}>{lieuError}</Text> : null}

            <Text style={styles.label}>{t("Intitulé")} <Text style={styles.labelOptional}>{t("(optionnel)")}</Text></Text>
            <TextInput
              style={styles.input}
              placeholder={t("Ex : Dîner romantique, Soirée ciné...")}
              placeholderTextColor={C.faint}
              value={intitule}
              onChangeText={setIntitule}
            />

            <Text style={styles.label}>{t("Date")}</Text>
            <DatePicker value={dateIso} onChange={setDateIso} />
            {statut === 'vecu' && dateIso > todayIso() && (
              <TouchableOpacity style={styles.dateWarning} onPress={() => setStatut('planifie')}>
                <Text style={styles.dateWarningText}>{t("Cette date est dans le futur.")} <Text style={styles.dateWarningLink}>{t("C'est un date à venir ?")}</Text></Text>
              </TouchableOpacity>
            )}
            {statut === 'planifie' && dateIso < todayIso() && (
              <TouchableOpacity style={styles.dateWarning} onPress={() => setStatut('vecu')}>
                <Text style={styles.dateWarningText}>{t("Cette date est passée.")} <Text style={styles.dateWarningLink}>{t("Le noter maintenant ?")}</Text></Text>
              </TouchableOpacity>
            )}

            <Text style={[styles.label, { marginTop: 12 }]}>{t("Catégorie")} <Text style={styles.labelOptional}>{t("(optionnel)")}</Text></Text>
            <View style={styles.categoryRow}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.key}
                  style={[styles.categoryChip, categorie === cat.key && styles.categoryChipActive]}
                  onPress={() => setCategorie(categorie === cat.key ? null : cat.key)}
                >
                  <Text style={[styles.categoryChipText, categorie === cat.key && styles.categoryChipTextActive]}>
                    {cat.emoji} {t(cat.label)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Note et détails, uniquement si vécu */}
          {statut === 'vecu' && (
            <View style={styles.card} onLayout={(e) => { noteCardY.current = e.nativeEvent.layout.y }}>
              <Text style={styles.cardTitle}>{t("Ta note")}</Text>

              <View style={[styles.globalNoteBox, !!noteError && styles.globalNoteBoxError]}>
                <Text style={styles.label}>{t("Note globale")}</Text>
                <View style={styles.noteStepperRow}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => { hapticSelect(); setNoteError(''); setNoteGlobale((n) => clampNote((n ?? 10.5) - 0.5)) }}
                    accessibilityLabel={t("Baisser la note")}
                  >
                    <Ionicons name="remove" size={22} color={C.primaryText} />
                  </TouchableOpacity>
                  <Text style={[styles.globalNoteValue, noteGlobale == null && styles.globalNoteEmpty]}>
                    {noteGlobale == null ? '–' : formatNote(noteGlobale)}<Text style={styles.globalNoteSuffix}>/20</Text>
                  </Text>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => { hapticSelect(); setNoteError(''); setNoteGlobale((n) => clampNote((n ?? 9.5) + 0.5)) }}
                    accessibilityLabel={t("Monter la note")}
                  >
                    <Ionicons name="add" size={22} color={C.primaryText} />
                  </TouchableOpacity>
                </View>
                <Slider
                  style={{ width: '100%', height: 40 }}
                  minimumValue={0}
                  maximumValue={20}
                  step={0.25}
                  value={noteGlobale ?? 10}
                  onValueChange={(v) => { setNoteError(''); setNoteGlobale(v) }}
                  minimumTrackTintColor={noteGlobale == null ? C.border : C.primary}
                  maximumTrackTintColor={C.border}
                  thumbTintColor={noteGlobale == null ? C.faint : C.primary}
                />
                <Text style={[styles.noteHint, !!noteError && styles.noteHintError]}>
                  {noteError || (noteGlobale == null ? t("Fais glisser ou utilise − / + pour noter") : ' ')}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.detailsToggle}
                onPress={() => setShowDetails((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: showDetails }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailsToggleTitle}>{t("Détailler ma note")} <Text style={styles.labelOptional}>{t("(optionnel)")}</Text></Text>
                  <Text style={styles.detailsToggleSub}>
                    {t("{n}/{total} critères renseignés", { n: Object.values(ratings).filter((v) => v != null).length, total: CRITERES.length })}
                  </Text>
                </View>
                <Ionicons name={showDetails ? 'chevron-up' : 'chevron-down'} size={20} color={C.faint} />
              </TouchableOpacity>

              {showDetails && CRITERES.map((c) => {
                const value = ratings[c.key as keyof Ratings]
                return (
                  <View key={c.key} style={styles.critereBox}>
                    <View style={styles.critereHeader}>
                      <Text style={styles.label}>{t(c.label)}</Text>
                      <View style={styles.critereRight}>
                        <Text style={[styles.critereValue, value == null && styles.critereValueEmpty]}>{value == null ? '–' : formatNote(value)}/5</Text>
                        {value != null && (
                          <TouchableOpacity onPress={() => updateRating(c.key, null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel={t("Effacer")}>
                            <Ionicons name="close-circle" size={16} color={C.faint} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    <Slider
                      style={{ width: '100%', height: 36 }}
                      minimumValue={0}
                      maximumValue={5}
                      step={0.25}
                      value={value ?? 2.5}
                      onValueChange={(v) => updateRating(c.key, v)}
                      minimumTrackTintColor={value == null ? C.border : C.primary}
                      maximumTrackTintColor={C.border}
                      thumbTintColor={value == null ? C.faint : C.primary}
                    />
                  </View>
                )
              })}

              <TouchableOpacity
                style={[styles.conseilRow, conseilVivement && styles.conseilRowActive]}
                onPress={() => setConseilVivement((v) => !v)}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.conseilLabel, conseilVivement && styles.conseilLabelActive]}>
                    <Ionicons name="heart" size={14} color={conseilVivement ? C.primaryText : C.text} /> {t("Je conseille vivement")}
                  </Text>
                  <Text style={styles.conseilSubtext}>{t("Mis en avant sur le feed de tes amis")}</Text>
                </View>
                <Switch
                  value={conseilVivement}
                  onValueChange={setConseilVivement}
                  trackColor={{ false: C.border, true: C.primary }}
                  thumbColor="#fff"
                  ios_backgroundColor={C.border}
                />
              </TouchableOpacity>
            </View>
          )}

          {/* Participants */}
          {companions.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t("Avec qui ?")} <Text style={styles.labelOptional}>{t("(optionnel)")}</Text></Text>
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
            </View>
          )}

          {/* Souvenirs : commentaire + photos */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("Souvenirs")}</Text>

            <Text style={styles.label}>{t("Commentaire")}</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder={t("Raconte ton date...")}
              placeholderTextColor={C.faint}
              value={commentaire}
              onChangeText={setCommentaire}
              multiline
              numberOfLines={4}
            />

            <Text style={styles.label}>{t("Photos")} ({photoUris.length}/{MAX_PHOTOS})</Text>
            <View style={styles.photoGallery}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {photoUris.map((uri) => (
                  <View key={uri} style={styles.photoThumbWrapper}>
                    <Image source={{ uri }} style={styles.photoThumb} />
                    <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(uri)}>
                      <Text style={styles.photoRemoveText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {photoUris.length < MAX_PHOTOS && (
                  <TouchableOpacity style={styles.photoAddButton} onPress={pickImages}>
                    <Text style={styles.photoAddText}>+</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.toggleLabelRow}>
                  <Ionicons name={visibilite === 'friends' ? 'people' : 'lock-closed'} size={16} color={C.text} />
                  <Text style={styles.toggleLabel}>{visibilite === 'friends' ? t("Visible par mes amis") : t("Privé")}</Text>
                </View>
                <Text style={styles.toggleSubtext}>
                  {visibilite === 'friends' ? t("Apparaît dans le feed de tes amis") : t("Visible seulement par toi")}
                </Text>
              </View>
              <Switch
                value={visibilite === 'friends'}
                onValueChange={(v) => setVisibilite(v ? 'friends' : 'private')}
                trackColor={{ false: C.border, true: C.primary }}
                thumbColor="#fff"
                ios_backgroundColor={C.border}
                accessibilityLabel={t("Visible par mes amis")}
              />
            </View>
          </View>


          <TouchableOpacity
            style={styles.resetButton}
            onPress={confirmResetForm}
            disabled={saving || uploadingPhotos}
          >
            <Text style={styles.resetButtonText}>{t("Réinitialiser le formulaire")}</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Toujours visible : plus besoin de descendre tout en bas pour enregistrer */}
        <View style={styles.saveBar}>
          <View style={webContentStyle}>
            <TouchableOpacity
              style={[styles.button, (saving || uploadingPhotos) && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving || uploadingPhotos}
            >
              {saving && !uploadingPhotos
                ? <ActivityIndicator color={C.onPrimary} />
                : <Text style={styles.buttonText}>{statut === 'vecu' ? t("Enregistrer le date") : t("Planifier ce date")}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

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

      <Modal visible={pickerVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPickerVisible(false)}>
        <SafeAreaView style={styles.modalSafe} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t("Partir d'un date planifié ou d'un lieu à essayer")}</Text>
            <TouchableOpacity onPress={() => setPickerVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={C.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {planifiedDates.length > 0 && (
              <>
                <Text style={styles.modalSectionTitle}>{t("Dates planifiés")}</Text>
                {planifiedDates.map((p) => (
                  <TouchableOpacity key={p.id} style={styles.modalRow} onPress={() => selectPlanifie(p)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalRowTitle}>{p.intitule ?? p.lieu}</Text>
                      <Text style={styles.modalRowSub}><Ionicons name="location-outline" size={12} color={C.muted} /> {p.lieu}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={C.faint} />
                  </TouchableOpacity>
                ))}
              </>
            )}
            {wishlistLieux.length > 0 && (
              <>
                <Text style={[styles.modalSectionTitle, { marginTop: planifiedDates.length > 0 ? 20 : 0 }]}>{t("Lieux à essayer")}</Text>
                {wishlistLieux.map((w) => (
                  <TouchableOpacity key={w.id} style={styles.modalRow} onPress={() => selectWishlistLieu(w)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalRowTitle}>{w.nom}</Text>
                      {w.adresse && <Text style={styles.modalRowSub}><Ionicons name="location-outline" size={12} color={C.muted} /> {w.adresse}</Text>}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={C.faint} />
                  </TouchableOpacity>
                ))}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = themedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 20, paddingBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', color: C.primaryText, letterSpacing: -0.3 },
  saveBar: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.border },
  globalNoteBoxError: { borderColor: C.danger },
  globalNoteEmpty: { color: C.faint },
  noteStepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  stepBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
  noteHint: { fontSize: 12, color: C.faint, textAlign: 'center' },
  noteHintError: { color: C.danger, fontWeight: '600' },
  detailsToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 4, marginBottom: 6 },
  detailsToggleTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  detailsToggleSub: { fontSize: 12, color: C.faint, marginTop: 2 },
  critereRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  critereValueEmpty: { color: C.faint },
  toggleLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  bellBtn: { padding: 4 },
  label: { fontSize: 14, fontWeight: '500', color: C.text, marginBottom: 8 },
  labelOptional: { fontSize: 12, fontWeight: '400', color: C.faint },
  card: { backgroundColor: C.card, borderRadius: 18, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 14 },
  segmented: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: C.border },
  segmentInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  segment: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  segmentActive: { backgroundColor: C.primary },
  segmentText: { fontSize: 14, fontWeight: '600', color: C.text },
  segmentTextActive: { color: C.onPrimary },
  segmentHint: { fontSize: 12, color: C.muted, textAlign: 'center', marginTop: 6, marginBottom: 16 },
  inputError: { borderColor: C.danger, marginBottom: 4 },
  fieldError: { color: C.danger, fontSize: 12, marginBottom: 12 },
  dateWarning: { backgroundColor: C.warningBg, borderRadius: 10, padding: 10, marginTop: -8, marginBottom: 8 },
  dateWarningText: { fontSize: 12, color: C.warningText },
  dateWarningLink: { fontWeight: '700', textDecorationLine: 'underline' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: C.text },
  toggleSubtext: { fontSize: 12, color: C.muted, marginTop: 2 },
  input: { backgroundColor: C.bg, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: C.border, fontSize: 15 },
  textarea: { height: 100, textAlignVertical: 'top' },
  globalNoteBox: { backgroundColor: C.bg, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  globalNoteValue: { fontSize: 32, fontWeight: '800', color: C.primaryText, textAlign: 'center', marginVertical: 4 },
  globalNoteSuffix: { fontSize: 16, fontWeight: '600', color: C.faint },
  critereBox: { backgroundColor: C.bg, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  critereHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  critereValue: { fontSize: 14, fontWeight: '600', color: C.primaryText },
  photoGallery: { minWidth: 0 },
  photoThumbWrapper: { position: 'relative', marginRight: 10 },
  photoThumb: { width: 90, height: 90, borderRadius: 10, backgroundColor: C.card },
  photoRemove: { position: 'absolute', top: -6, right: -6, backgroundColor: C.danger, width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  photoRemoveText: { color: C.onPrimary, fontWeight: '700', fontSize: 14, lineHeight: 16 },
  photoAddButton: { width: 90, height: 90, borderRadius: 10, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  photoAddText: { fontSize: 28, color: C.faint },
  conseilRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: 12, padding: 14, marginTop: 4, borderWidth: 1, borderColor: C.border },
  conseilRowActive: { borderColor: C.primary, backgroundColor: C.primarySoft },
  conseilLabel: { fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 2 },
  conseilLabelActive: { color: C.primaryText },
  conseilSubtext: { fontSize: 12, color: C.muted },
  button: { backgroundColor: C.primary, borderRadius: 14, padding: 16, alignItems: 'center', shadowColor: C.primary, shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  buttonText: { color: C.onPrimary, fontWeight: '700', fontSize: 16 },
  resetButton: { alignItems: 'center', padding: 14, marginTop: 8 },
  resetButtonText: { color: C.muted, fontWeight: '600', fontSize: 14 },
  uploadOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
  uploadCard: { backgroundColor: C.card, borderRadius: 20, padding: 32, alignItems: 'center', width: '100%', maxWidth: 260, gap: 10 },
  uploadTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginTop: 4 },
  uploadCount: { fontSize: 14, color: C.muted },
  progressTrack: { flexDirection: 'row', width: '100%', height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { backgroundColor: C.primary },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  categoryChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  categoryChipText: { fontSize: 13, color: C.text, fontWeight: '500' },
  categoryChipTextActive: { color: C.onPrimary, fontWeight: '700' },
  sourceEntryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 16 },
  sourceEntryText: { flex: 1, fontSize: 13, color: C.text, fontWeight: '500' },
  sourceBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.primarySoft, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 16 },
  sourceBadgeText: { flex: 1, fontSize: 13, fontWeight: '600', color: C.primaryText },
  modalSafe: { flex: 1, backgroundColor: C.bg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border, gap: 12 },
  modalTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: C.text },
  modalContent: { padding: 20, paddingBottom: 60 },
  modalSectionTitle: { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 10 },
  modalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  modalRowTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  modalRowSub: { fontSize: 12, color: C.muted, marginTop: 2 },
}))
