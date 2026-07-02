import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Switch, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
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

const CRITERES = [
  { key: 'mood', label: 'Mood' },
  { key: 'nourriture', label: 'Nourriture' },
  { key: 'ambiance', label: 'Ambiance' },
  { key: 'personne', label: 'La personne' },
  { key: 'conversation', label: 'Conversation' },
  { key: 'prix', label: 'Prix / Valeur' },
  { key: 'envie_recommencer', label: 'Envie de recommencer' },
]

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
  const { lieu: lieuParam, intitule: intituleParam } = useLocalSearchParams<{ lieu?: string; intitule?: string }>()
  const [intitule, setIntitule] = useState(typeof intituleParam === 'string' ? intituleParam : '')
  const [lieu, setLieu] = useState(typeof lieuParam === 'string' ? lieuParam : '')
  const [dateIso, setDateIso] = useState(todayIso())
  const [commentaire, setCommentaire] = useState('')
  const [noteGlobale, setNoteGlobale] = useState(10)
  const [ratings, setRatings] = useState({ mood: 3, nourriture: 3, ambiance: 3, personne: 3, conversation: 3, prix: 3, envie_recommencer: 3 })
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
  const router = useRouter()

  useEffect(() => {
    if (lieuParam && typeof lieuParam === 'string') setLieu(lieuParam)
    if (intituleParam && typeof intituleParam === 'string') setIntitule(intituleParam)
  }, [lieuParam, intituleParam])

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

  function updateRating(key: string, value: number) {
    setRatings((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (saving) return
    if (!lieu.trim()) {
      Alert.alert('Oups', 'Indique le lieu du date')
      return
    }

    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      Alert.alert('Erreur', 'Tu dois être connecté')
      return
    }

    const payload = {
      intitule: intitule.trim() || null,
      lieu,
      date_du_date: dateIso,
      note_globale: statut === 'vecu' ? Math.round(noteGlobale * 4) / 4 : null,
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
      Alert.alert('Erreur', dateError.message)
      return
    }

    await uploadPhotos(user.id, dateRow.id)

    const round4 = (v: number) => Math.round(v * 4) / 4
    const { error: ratingError } = await supabase.from('ratings').insert({
      date_id: dateRow.id,
      mood: round4(ratings.mood),
      nourriture: round4(ratings.nourriture),
      ambiance: round4(ratings.ambiance),
      personne: round4(ratings.personne),
      conversation: round4(ratings.conversation),
      prix: round4(ratings.prix),
      envie_recommencer: round4(ratings.envie_recommencer),
    })

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
      Alert.alert('Erreur', ratingError.message)
      return
    }

    setIntitule('')
    setLieu('')
    setDateIso(todayIso())
    setCommentaire('')
    setNoteGlobale(10)
    setRatings({ mood: 3, nourriture: 3, ambiance: 3, personne: 3, conversation: 3, prix: 3, envie_recommencer: 3 })
    setConseilVivement(false)
    setStatut('vecu')
    setCategorie(null)
    setVisibilite('friends')
    setPhotoUris([])
    setEditingPlanifieId(null)
    setSelectedCompanionIds(new Set())
    setSelectedWishlistId(null)

    toastStore.set('Date enregistré avec succès ✓')
    router.replace('/(tabs)/feed')
  }

  async function pickImages() {
    if (photoUris.length >= MAX_PHOTOS) {
      Alert.alert('Limite atteinte', `Tu peux ajouter ${MAX_PHOTOS} photos maximum`)
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
      Alert.alert('Attention', `${failCount} photo(s) n'ont pas pu être uploadées`)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.container} contentContainerStyle={[styles.content, webContentStyle]}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{editingPlanifieId ? 'Noter un date planifié' : 'Nouveau date'}</Text>
            {Platform.OS !== 'web' && (
              <TouchableOpacity onPress={() => router.push('/notifications')} style={styles.bellBtn}>
                <Ionicons name="notifications-outline" size={22} color="#D4517E" />
              </TouchableOpacity>
            )}
          </View>

          {!editingPlanifieId && !selectedWishlistId && (planifiedDates.length > 0 || wishlistLieux.length > 0) && (
            <TouchableOpacity style={styles.sourceEntryBtn} onPress={() => setPickerVisible(true)} activeOpacity={0.8}>
              <Ionicons name="calendar-outline" size={16} color="#D4517E" />
              <Text style={styles.sourceEntryText}>Partir d'un date planifié ou d'un lieu à essayer</Text>
              <Ionicons name="chevron-forward" size={14} color="#B8A9A0" />
            </TouchableOpacity>
          )}

          {(editingPlanifieId || selectedWishlistId) && (
            <View style={styles.sourceBadge}>
              <Text style={styles.sourceBadgeText} numberOfLines={1}>
                {editingPlanifieId ? `📅 Depuis ton date planifié : ${lieu}` : `📍 Depuis "Lieux à essayer" : ${lieu}`}
              </Text>
              <TouchableOpacity onPress={clearSource} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={20} color="#D4517E" />
              </TouchableOpacity>
            </View>
          )}

          {/* Options : statut vécu/planifié + visibilité */}
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>{statut === 'vecu' ? '✓ Déjà vécu' : '📅 À venir'}</Text>
                <Text style={styles.toggleSubtext}>
                  {statut === 'vecu' ? 'Tu peux le noter dès maintenant' : 'Tu pourras le noter une fois passé'}
                </Text>
              </View>
              <Switch
                value={statut === 'vecu'}
                onValueChange={(v) => setStatut(v ? 'vecu' : 'planifie')}
                trackColor={{ false: '#F0D9D9', true: '#D4517E' }}
                thumbColor="#fff"
                ios_backgroundColor="#F0D9D9"
              />
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>{visibilite === 'friends' ? '👫 Visible par mes amis' : '🔒 Privé'}</Text>
                <Text style={styles.toggleSubtext}>
                  {visibilite === 'friends' ? 'Apparaît dans le feed de tes amis' : 'Visible seulement par toi'}
                </Text>
              </View>
              <Switch
                value={visibilite === 'friends'}
                onValueChange={(v) => setVisibilite(v ? 'friends' : 'private')}
                trackColor={{ false: '#F0D9D9', true: '#D4517E' }}
                thumbColor="#fff"
                ios_backgroundColor="#F0D9D9"
              />
            </View>
          </View>

          {/* Infos principales */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Infos</Text>

            <Text style={styles.label}>Lieu</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex : Le Petit Café, Bucarest"
              placeholderTextColor="#B8A9A0"
              value={lieu}
              onChangeText={setLieu}
            />

            <Text style={styles.label}>Intitulé <Text style={styles.labelOptional}>(optionnel)</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="Ex : Dîner romantique, Soirée ciné..."
              placeholderTextColor="#B8A9A0"
              value={intitule}
              onChangeText={setIntitule}
            />

            <Text style={styles.label}>Date</Text>
            <DatePicker value={dateIso} onChange={setDateIso} />

            <Text style={[styles.label, { marginTop: 12 }]}>Catégorie <Text style={styles.labelOptional}>(optionnel)</Text></Text>
            <View style={styles.categoryRow}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.key}
                  style={[styles.categoryChip, categorie === cat.key && styles.categoryChipActive]}
                  onPress={() => setCategorie(categorie === cat.key ? null : cat.key)}
                >
                  <Text style={[styles.categoryChipText, categorie === cat.key && styles.categoryChipTextActive]}>
                    {cat.emoji} {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Note et détails, uniquement si vécu */}
          {statut === 'vecu' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Ta note</Text>

              <View style={styles.globalNoteBox}>
                <Text style={styles.label}>Note globale</Text>
                <Text style={styles.globalNoteValue}>{formatNote(noteGlobale)}<Text style={styles.globalNoteSuffix}>/20</Text></Text>
                <Slider
                  style={{ width: '100%', height: 40 }}
                  minimumValue={0}
                  maximumValue={20}
                  step={0.25}
                  value={noteGlobale}
                  onValueChange={setNoteGlobale}
                  minimumTrackTintColor="#D4517E"
                  maximumTrackTintColor="#F0D9D9"
                  thumbTintColor="#D4517E"
                />
              </View>

              {CRITERES.map((c) => (
                <View key={c.key} style={styles.critereBox}>
                  <View style={styles.critereHeader}>
                    <Text style={styles.label}>{c.label}</Text>
                    <Text style={styles.critereValue}>{formatNote(ratings[c.key as keyof typeof ratings])}/5</Text>
                  </View>
                  <Slider
                    style={{ width: '100%', height: 36 }}
                    minimumValue={0}
                    maximumValue={5}
                    step={0.25}
                    value={ratings[c.key as keyof typeof ratings]}
                    onValueChange={(v) => updateRating(c.key, v)}
                    minimumTrackTintColor="#D4517E"
                    maximumTrackTintColor="#F0D9D9"
                    thumbTintColor="#D4517E"
                  />
                </View>
              ))}

              <TouchableOpacity
                style={[styles.conseilRow, conseilVivement && styles.conseilRowActive]}
                onPress={() => setConseilVivement((v) => !v)}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.conseilLabel, conseilVivement && styles.conseilLabelActive]}>
                    💖 Je conseille vivement
                  </Text>
                  <Text style={styles.conseilSubtext}>Mis en avant sur le feed de tes amis</Text>
                </View>
                <Switch
                  value={conseilVivement}
                  onValueChange={setConseilVivement}
                  trackColor={{ false: '#F0D9D9', true: '#D4517E' }}
                  thumbColor="#fff"
                  ios_backgroundColor="#F0D9D9"
                />
              </TouchableOpacity>
            </View>
          )}

          {/* Participants */}
          {companions.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Avec qui ? <Text style={styles.labelOptional}>(optionnel)</Text></Text>
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
            <Text style={styles.cardTitle}>Souvenirs</Text>

            <Text style={styles.label}>Commentaire</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Raconte ton date..."
              placeholderTextColor="#B8A9A0"
              value={commentaire}
              onChangeText={setCommentaire}
              multiline
              numberOfLines={4}
            />

            <Text style={styles.label}>Photos ({photoUris.length}/{MAX_PHOTOS})</Text>
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

          <TouchableOpacity
            style={styles.button}
            onPress={handleSave}
            disabled={saving || uploadingPhotos}
          >
            <Text style={styles.buttonText}>
              {saving && !uploadingPhotos ? 'Enregistrement...' : 'Enregistrer le date'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

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

      <Modal visible={pickerVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPickerVisible(false)}>
        <SafeAreaView style={styles.modalSafe} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Partir d'un date planifié ou d'un lieu à essayer</Text>
            <TouchableOpacity onPress={() => setPickerVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color="#5C4A45" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {planifiedDates.length > 0 && (
              <>
                <Text style={styles.modalSectionTitle}>📅 Dates planifiés</Text>
                {planifiedDates.map((p) => (
                  <TouchableOpacity key={p.id} style={styles.modalRow} onPress={() => selectPlanifie(p)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalRowTitle}>{p.intitule ?? p.lieu}</Text>
                      <Text style={styles.modalRowSub}>📍 {p.lieu}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#B8A9A0" />
                  </TouchableOpacity>
                ))}
              </>
            )}
            {wishlistLieux.length > 0 && (
              <>
                <Text style={[styles.modalSectionTitle, { marginTop: planifiedDates.length > 0 ? 20 : 0 }]}>📍 Lieux à essayer</Text>
                {wishlistLieux.map((w) => (
                  <TouchableOpacity key={w.id} style={styles.modalRow} onPress={() => selectWishlistLieu(w)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalRowTitle}>{w.nom}</Text>
                      {w.adresse && <Text style={styles.modalRowSub}>📍 {w.adresse}</Text>}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#B8A9A0" />
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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF8F5' },
  container: { flex: 1, backgroundColor: '#FFF8F5' },
  content: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 24, fontWeight: '600', color: '#D4517E' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  bellBtn: { padding: 4 },
  label: { fontSize: 14, fontWeight: '500', color: '#5C4A45', marginBottom: 8 },
  labelOptional: { fontSize: 12, fontWeight: '400', color: '#B8A9A0' },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F0D9D9' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#5C4A45', marginBottom: 14 },
  cardDivider: { height: 1, backgroundColor: '#F0D9D9', marginVertical: 14 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: '#5C4A45' },
  toggleSubtext: { fontSize: 12, color: '#888', marginTop: 2 },
  input: { backgroundColor: '#FFF8F5', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#F0D9D9', fontSize: 15 },
  textarea: { height: 100, textAlignVertical: 'top' },
  globalNoteBox: { backgroundColor: '#FFF8F5', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F0D9D9' },
  globalNoteValue: { fontSize: 32, fontWeight: '800', color: '#D4517E', textAlign: 'center', marginVertical: 4 },
  globalNoteSuffix: { fontSize: 16, fontWeight: '600', color: '#B8A9A0' },
  critereBox: { backgroundColor: '#FFF8F5', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#F0D9D9' },
  critereHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  critereValue: { fontSize: 14, fontWeight: '600', color: '#D4517E' },
  photoGallery: { minWidth: 0 },
  photoThumbWrapper: { position: 'relative', marginRight: 10 },
  photoThumb: { width: 90, height: 90, borderRadius: 10, backgroundColor: '#fff' },
  photoRemove: { position: 'absolute', top: -6, right: -6, backgroundColor: '#D85A30', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  photoRemoveText: { color: '#fff', fontWeight: '700', fontSize: 14, lineHeight: 16 },
  photoAddButton: { width: 90, height: 90, borderRadius: 10, backgroundColor: '#FFF8F5', borderWidth: 1, borderColor: '#F0D9D9', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  photoAddText: { fontSize: 28, color: '#B8A9A0' },
  conseilRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF8F5', borderRadius: 12, padding: 14, marginTop: 4, borderWidth: 1, borderColor: '#F0D9D9' },
  conseilRowActive: { borderColor: '#D4517E', backgroundColor: '#FDE8F0' },
  conseilLabel: { fontSize: 14, fontWeight: '600', color: '#5C4A45', marginBottom: 2 },
  conseilLabelActive: { color: '#D4517E' },
  conseilSubtext: { fontSize: 12, color: '#888' },
  button: { backgroundColor: '#D4517E', borderRadius: 14, padding: 17, alignItems: 'center', marginTop: 4, shadowColor: '#D4517E', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  uploadOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
  uploadCard: { backgroundColor: '#fff', borderRadius: 20, padding: 32, alignItems: 'center', width: '100%', maxWidth: 260, gap: 10 },
  uploadTitle: { fontSize: 16, fontWeight: '700', color: '#5C4A45', marginTop: 4 },
  uploadCount: { fontSize: 14, color: '#888' },
  progressTrack: { flexDirection: 'row', width: '100%', height: 6, backgroundColor: '#F0D9D9', borderRadius: 3, overflow: 'hidden' },
  progressFill: { backgroundColor: '#D4517E' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#FFF8F5', borderWidth: 1, borderColor: '#F0D9D9' },
  categoryChipActive: { backgroundColor: '#D4517E', borderColor: '#D4517E' },
  categoryChipText: { fontSize: 13, color: '#5C4A45', fontWeight: '500' },
  categoryChipTextActive: { color: '#fff', fontWeight: '700' },
  sourceEntryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#F0D9D9', paddingVertical: 12, paddingHorizontal: 14, marginBottom: 16 },
  sourceEntryText: { flex: 1, fontSize: 13, color: '#5C4A45', fontWeight: '500' },
  sourceBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FDE8F0', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 16 },
  sourceBadgeText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#D4517E' },
  modalSafe: { flex: 1, backgroundColor: '#FFF8F5' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0D9D9', gap: 12 },
  modalTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#5C4A45' },
  modalContent: { padding: 20, paddingBottom: 60 },
  modalSectionTitle: { fontSize: 13, fontWeight: '700', color: '#5C4A45', marginBottom: 10 },
  modalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#F0D9D9' },
  modalRowTitle: { fontSize: 14, fontWeight: '700', color: '#5C4A45' },
  modalRowSub: { fontSize: 12, color: '#888', marginTop: 2 },
})
