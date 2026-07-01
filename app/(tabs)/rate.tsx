import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Switch } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { toastStore } from '../../lib/toastStore'
import { CATEGORIES } from '../../lib/categories'
import Slider from '@react-native-community/slider'
import { supabase } from '../../lib/supabase'
import { webContentStyle } from '../../lib/webStyles'
import { todayFr, parseDateFr } from '../../lib/dateUtils'
import * as ImagePicker from 'expo-image-picker'
import { Image } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import { decode } from 'base64-arraybuffer'

const CRITERES = [
  { key: 'mood', label: 'Mood' },
  { key: 'nourriture', label: 'Nourriture' },
  { key: 'ambiance', label: 'Ambiance' },
  { key: 'personne', label: 'La personne' },
  { key: 'conversation', label: 'Conversation' },
  { key: 'prix', label: 'Prix / Valeur' },
  { key: 'envie_recommencer', label: 'Envie de recommencer' },
]

export default function Rate() {
  const { lieu: lieuParam, intitule: intituleParam } = useLocalSearchParams<{ lieu?: string; intitule?: string }>()
  const [intitule, setIntitule] = useState(typeof intituleParam === 'string' ? intituleParam : '')
  const [lieu, setLieu] = useState(typeof lieuParam === 'string' ? lieuParam : '')
  const [dateInput, setDateInput] = useState(todayFr())
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
  const router = useRouter()

  useEffect(() => {
    if (lieuParam && typeof lieuParam === 'string') setLieu(lieuParam)
    if (intituleParam && typeof intituleParam === 'string') setIntitule(intituleParam)
  }, [lieuParam, intituleParam])

  const MAX_PHOTOS = 10

  function handleDateInput(text: string) {
    let cleaned = text.replace(/[^0-9]/g, '')
    if (cleaned.length > 2) cleaned = cleaned.slice(0, 2) + '/' + cleaned.slice(2)
    if (cleaned.length > 5) cleaned = cleaned.slice(0, 5) + '/' + cleaned.slice(5)
    if (cleaned.length > 10) cleaned = cleaned.slice(0, 10)
    setDateInput(cleaned)
  }

  function updateRating(key: string, value: number) {
    setRatings((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!lieu.trim()) {
      Alert.alert('Oups', 'Indique le lieu du date')
      return
    }

    const dateIso = parseDateFr(dateInput)
    if (!dateIso) {
      Alert.alert('Oups', 'Date invalide — utilise le format JJ/MM/AAAA')
      return
    }

    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      Alert.alert('Erreur', 'Tu dois être connecté')
      return
    }

    const { data: dateRow, error: dateError } = await supabase
      .from('dates')
      .insert({
        user_id: user.id,
        intitule: intitule.trim() || null,
        lieu,
        date_du_date: dateIso,
        note_globale: statut === 'vecu' ? noteGlobale : null,
        commentaire,
        conseil_vivement: conseilVivement,
        statut,
        categorie,
        visibilite,
      })
      .select()
      .single()

    if (dateError) {
      setSaving(false)
      Alert.alert('Erreur', dateError.message)
      return
    }

    await uploadPhotos(user.id, dateRow.id)

    const { error: ratingError } = await supabase.from('ratings').insert({
      date_id: dateRow.id,
      mood: ratings.mood,
      nourriture: ratings.nourriture,
      ambiance: ratings.ambiance,
      personne: ratings.personne,
      conversation: ratings.conversation,
      prix: ratings.prix,
      envie_recommencer: ratings.envie_recommencer,
    })

    setSaving(false)

    if (ratingError) {
      Alert.alert('Erreur', ratingError.message)
      return
    }

    setIntitule('')
    setLieu('')
    setDateInput(todayFr())
    setCommentaire('')
    setNoteGlobale(10)
    setRatings({ mood: 3, nourriture: 3, ambiance: 3, personne: 3, conversation: 3, prix: 3, envie_recommencer: 3 })
    setConseilVivement(false)
    setStatut('vecu')
    setCategorie(null)
    setVisibilite('friends')
    setPhotoUris([])

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

        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' })

        const { error: uploadError } = await supabase.storage
          .from('date-photos')
          .upload(fileName, decode(base64), { contentType: `image/${fileExt}` })

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
          <Text style={styles.title}>Nouveau date</Text>

          <View style={styles.statutRow}>
            <TouchableOpacity
              style={[styles.statutBtn, statut === 'vecu' && styles.statutBtnActive]}
              onPress={() => setStatut('vecu')}
            >
              <Text style={[styles.statutBtnText, statut === 'vecu' && styles.statutBtnTextActive]}>✓ Vécu</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.statutBtn, statut === 'planifie' && styles.statutBtnActive]}
              onPress={() => setStatut('planifie')}
            >
              <Text style={[styles.statutBtnText, statut === 'planifie' && styles.statutBtnTextActive]}>📅 Planifié</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Catégorie <Text style={styles.labelOptional}>(optionnel)</Text></Text>
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

          <View style={styles.visibiliteRow}>
            <TouchableOpacity
              style={[styles.statutBtn, visibilite === 'friends' && styles.statutBtnActive]}
              onPress={() => setVisibilite('friends')}
            >
              <Text style={[styles.statutBtnText, visibilite === 'friends' && styles.statutBtnTextActive]}>👫 Visible par mes amis</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.statutBtn, visibilite === 'private' && styles.statutBtnActive]}
              onPress={() => setVisibilite('private')}
            >
              <Text style={[styles.statutBtnText, visibilite === 'private' && styles.statutBtnTextActive]}>🔒 Privé</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Intitulé <Text style={styles.labelOptional}>(optionnel)</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="Ex : Dîner romantique, Soirée ciné..."
            placeholderTextColor="#B8A9A0"
            value={intitule}
            onChangeText={setIntitule}
          />

          <Text style={styles.label}>Lieu</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex : Le Petit Café, Bucarest"
            placeholderTextColor="#B8A9A0"
            value={lieu}
            onChangeText={setLieu}
          />

          <Text style={styles.label}>Date</Text>
          <TextInput
            style={styles.input}
            placeholder="JJ/MM/AAAA"
            placeholderTextColor="#B8A9A0"
            value={dateInput}
            onChangeText={handleDateInput}
            keyboardType="numeric"
            maxLength={10}
          />

          {statut === 'vecu' && (
            <>
              <View style={styles.globalNoteBox}>
                <Text style={styles.label}>Note globale</Text>
                <Text style={styles.globalNoteValue}>{noteGlobale}/20</Text>
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

              <Text style={styles.sectionTitle}>Détails</Text>
            </>
          )}

          {statut === 'vecu' && CRITERES.map((c) => (
            <View key={c.key} style={styles.critereBox}>
              <View style={styles.critereHeader}>
                <Text style={styles.label}>{c.label}</Text>
                <Text style={styles.critereValue}>{ratings[c.key as keyof typeof ratings]}/5</Text>
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

          {statut === 'vecu' && (
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
          )}

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

          <Text style={styles.label}>Photos (optionnel, {photoUris.length}/{MAX_PHOTOS})</Text>
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
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF8F5' },
  container: { flex: 1, backgroundColor: '#FFF8F5' },
  content: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 24, fontWeight: '600', color: '#D4517E', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '500', color: '#5C4A45', marginBottom: 8 },
  labelOptional: { fontSize: 12, fontWeight: '400', color: '#B8A9A0' },
  statutRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statutBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#F0D9D9', alignItems: 'center', backgroundColor: '#fff' },
  statutBtnActive: { backgroundColor: '#D4517E', borderColor: '#D4517E' },
  statutBtnText: { fontSize: 14, fontWeight: '600', color: '#5C4A45' },
  statutBtnTextActive: { color: '#fff' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#5C4A45', marginTop: 12, marginBottom: 8 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#F0D9D9', fontSize: 15 },
  textarea: { height: 100, textAlignVertical: 'top' },
  globalNoteBox: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#F0D9D9' },
  globalNoteValue: { fontSize: 28, fontWeight: '700', color: '#D4517E', textAlign: 'center', marginVertical: 4 },
  critereBox: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#F0D9D9' },
  critereHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  critereValue: { fontSize: 14, fontWeight: '600', color: '#D4517E' },
  photoGallery: { marginBottom: 16 },
  photoThumbWrapper: { position: 'relative', marginRight: 10 },
  photoThumb: { width: 90, height: 90, borderRadius: 10, backgroundColor: '#fff' },
  photoRemove: { position: 'absolute', top: -6, right: -6, backgroundColor: '#D85A30', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  photoRemoveText: { color: '#fff', fontWeight: '700', fontSize: 14, lineHeight: 16 },
  photoAddButton: { width: 90, height: 90, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#F0D9D9', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  photoAddText: { fontSize: 28, color: '#B8A9A0' },
  conseilRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#F0D9D9' },
  conseilRowActive: { borderColor: '#D4517E', backgroundColor: '#FDE8F0' },
  conseilLabel: { fontSize: 14, fontWeight: '600', color: '#5C4A45', marginBottom: 2 },
  conseilLabelActive: { color: '#D4517E' },
  conseilSubtext: { fontSize: 12, color: '#888' },
  button: { backgroundColor: '#D4517E', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  uploadOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
  uploadCard: { backgroundColor: '#fff', borderRadius: 20, padding: 32, alignItems: 'center', width: 260, gap: 10 },
  uploadTitle: { fontSize: 16, fontWeight: '700', color: '#5C4A45', marginTop: 4 },
  uploadCount: { fontSize: 14, color: '#888' },
  progressTrack: { flexDirection: 'row', width: '100%', height: 6, backgroundColor: '#F0D9D9', borderRadius: 3, overflow: 'hidden' },
  progressFill: { backgroundColor: '#D4517E' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  categoryChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#F0D9D9' },
  categoryChipActive: { backgroundColor: '#D4517E', borderColor: '#D4517E' },
  categoryChipText: { fontSize: 13, color: '#5C4A45', fontWeight: '500' },
  categoryChipTextActive: { color: '#fff', fontWeight: '700' },
  visibiliteRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
})
