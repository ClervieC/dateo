import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image, Share } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
import { supabase } from '../lib/supabase'
import { usernameValide } from '../lib/friendsUtils'
import { webContentStyle } from '../lib/webStyles'
import { uriToBlob } from '../lib/uploadImage'

export default function Settings() {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarMsg, setAvatarMsg] = useState('')

  const [newUsername, setNewUsername] = useState('')
  const [savingUsername, setSavingUsername] = useState(false)
  const [usernameMsg, setUsernameMsg] = useState('')

  const [newPassword, setNewPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState('')

  const [monthlyGoal, setMonthlyGoal] = useState('')
  const [savingGoal, setSavingGoal] = useState(false)
  const [goalMsg, setGoalMsg] = useState('')

  const [ville, setVille] = useState('')
  const [savingVille, setSavingVille] = useState(false)
  const [villeMsg, setVilleMsg] = useState('')
  const [locatingVille, setLocatingVille] = useState(false)

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [exportingCSV, setExportingCSV] = useState(false)
  const [deleteMsg, setDeleteMsg] = useState('')

  const router = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      setEmail(user.email ?? '')
      const { data } = await supabase.from('profiles').select('username, avatar_url, monthly_goal, ville').eq('id', user.id).single()
      if (data) {
        setUsername(data.username)
        setNewUsername(data.username)
        setAvatarUrl(data.avatar_url ?? null)
        setMonthlyGoal(data.monthly_goal != null ? String(data.monthly_goal) : '')
        setVille((data as any).ville ?? '')
      }
      setLoading(false)
    }
    load()
  }, [])

  async function pickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (result.canceled || !result.assets[0]) return
    await uploadAvatar(result.assets[0].uri)
  }

  async function uploadAvatar(uri: string) {
    setUploadingAvatar(true)
    setAvatarMsg('')
    try {
      const fileExt = uri.split('.').pop()?.toLowerCase() ?? 'jpg'
      const fileName = `${userId}/avatar.${fileExt}`
      const blob = await uriToBlob(uri)

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, { contentType: `image/${fileExt}`, upsert: true })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
      const url = `${data.publicUrl}?t=${Date.now()}`

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: data.publicUrl })
        .eq('id', userId)

      if (updateError) throw updateError

      setAvatarUrl(url)
      setAvatarMsg('Photo mise à jour !')
    } catch (e: any) {
      setAvatarMsg(`Erreur : ${e.message}`)
    }
    setUploadingAvatar(false)
  }

  async function handleSaveUsername() {
    const validation = usernameValide(newUsername)
    if (!validation.valide) { setUsernameMsg(`Erreur : ${validation.message}`); return }
    setSavingUsername(true)
    setUsernameMsg('')
    const { error } = await supabase.from('profiles').update({ username: newUsername.trim() }).eq('id', userId)
    setSavingUsername(false)
    if (error) setUsernameMsg(error.code === '23505' ? 'Ce pseudo est déjà pris' : `Erreur : ${error.message}`)
    else { setUsername(newUsername.trim()); setUsernameMsg('Pseudo mis à jour !') }
  }

  async function handleSavePassword() {
    if (newPassword.length < 6) { setPasswordMsg('Erreur : au moins 6 caractères requis'); return }
    setSavingPassword(true)
    setPasswordMsg('')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)
    if (error) setPasswordMsg(`Erreur : ${error.message}`)
    else { setNewPassword(''); setPasswordMsg('Mot de passe modifié !') }
  }

  async function handleSaveGoal() {
    const n = parseInt(monthlyGoal, 10)
    if (monthlyGoal !== '' && (isNaN(n) || n < 0 || n > 99)) {
      setGoalMsg('Erreur : entre 0 et 99'); return
    }
    setSavingGoal(true)
    setGoalMsg('')
    await supabase.from('profiles').update({ monthly_goal: monthlyGoal === '' ? null : n }).eq('id', userId)
    setSavingGoal(false)
    setGoalMsg('Objectif mis à jour !')
  }

  async function saveVille(newVille: string) {
    setSavingVille(true)
    setVilleMsg('')
    const { error } = await supabase.from('profiles').update({ ville: newVille.trim() || null }).eq('id', userId)
    setSavingVille(false)
    if (error) { setVilleMsg(`Erreur : ${error.message}`); return }
    setVille(newVille.trim())
    setVilleMsg('Ville mise à jour !')
  }

  async function useCurrentLocation() {
    setVilleMsg('')
    setLocatingVille(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setVilleMsg('Erreur : permission de localisation refusée')
        return
      }
      const position = await Location.getCurrentPositionAsync({})
      const [place] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      })
      const detectedVille = place?.city ?? place?.subregion ?? place?.region ?? null
      if (!detectedVille) {
        setVilleMsg("Erreur : impossible de déterminer ta ville, entre-la manuellement")
        return
      }
      await saveVille(detectedVille)
    } catch (err) {
      setVilleMsg(`Erreur : ${err instanceof Error ? err.message : 'localisation indisponible'}`)
    } finally {
      setLocatingVille(false)
    }
  }

  async function exportCSV() {
    setExportingCSV(true)
    const { data } = await supabase
      .from('dates')
      .select(`
        intitule, lieu, date_du_date, note_globale, commentaire, categorie, statut, conseil_vivement, visibilite,
        ratings(mood, nourriture, ambiance, personne, conversation, prix, envie_recommencer),
        date_participants(profiles(username))
      `)
      .eq('user_id', userId)
      .order('date_du_date', { ascending: false })

    if (!data) { setExportingCSV(false); return }

    const escape = (s: string) => `"${String(s).replace(/"/g, '""')}"`
    const headers = [
      'Intitulé', 'Lieu', 'Date', 'Note globale', 'Commentaire', 'Catégorie', 'Statut',
      'Conseillé vivement', 'Visibilité', 'Avec qui',
      'Mood', 'Nourriture', 'Ambiance', 'La personne', 'Conversation', 'Prix', 'Envie de recommencer',
    ].join(',')

    const rows = (data as any[]).map((d) => {
      const r = Array.isArray(d.ratings) ? d.ratings[0] : d.ratings
      const avecQui = (d.date_participants ?? [])
        .map((p: any) => p.profiles?.username)
        .filter(Boolean)
        .join(' & ')
      return [
        escape(d.intitule ?? ''),
        escape(d.lieu),
        d.date_du_date,
        d.note_globale ?? '',
        escape(d.commentaire ?? ''),
        d.categorie ?? '',
        d.statut ?? 'vecu',
        d.conseil_vivement ? 'Oui' : 'Non',
        d.visibilite === 'private' ? 'Privé' : 'Amis',
        escape(avecQui),
        r?.mood ?? '',
        r?.nourriture ?? '',
        r?.ambiance ?? '',
        r?.personne ?? '',
        r?.conversation ?? '',
        r?.prix ?? '',
        r?.envie_recommencer ?? '',
      ].join(',')
    })

    await Share.share({ message: [headers, ...rows].join('\n'), title: 'Mes dates Dateo' })
    setExportingCSV(false)
  }

  async function execDeleteAccount() {
    setDeletingAccount(true)
    setDeleteMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setDeletingAccount(false); return }
    const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const json = await res.json()
    setDeletingAccount(false)
    if (json.error) { setDeleteMsg(`Erreur : ${json.error}`); setConfirmDelete(false) }
    else await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ActivityIndicator color="#D4517E" style={{ marginTop: 60 }} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color="#D4517E" />
          <Text style={styles.back}>Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paramètres</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, webContentStyle]}>

        {/* Profil : avatar + pseudo regroupés */}
        <Text style={styles.groupLabel}>Profil</Text>
        <View style={styles.section}>
          <View style={styles.avatarRow}>
            <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8} disabled={uploadingAvatar}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>{username.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <Text style={styles.avatarEditText}>{uploadingAvatar ? '...' : '✏️'}</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.avatarInfo}>
              <Text style={styles.avatarName}>@{username}</Text>
              <TouchableOpacity onPress={pickAvatar} disabled={uploadingAvatar}>
                <Text style={styles.avatarChangeBtn}>{uploadingAvatar ? 'Envoi en cours...' : 'Changer la photo'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          {avatarMsg ? (
            <Text style={[styles.msg, avatarMsg.startsWith('Erreur') ? styles.msgError : styles.msgSuccess]}>
              {avatarMsg}
            </Text>
          ) : null}

          <View style={styles.rowDivider} />

          <Text style={styles.fieldLabel}>Pseudo</Text>
          <View style={styles.fieldRow}>
            <TextInput
              style={[styles.input, styles.inputInline]}
              value={newUsername}
              onChangeText={(v) => { setNewUsername(v); setUsernameMsg('') }}
              autoCapitalize="none"
              placeholder="Pseudo"
              placeholderTextColor="#B8A9A0"
            />
            <TouchableOpacity style={styles.saveChip} onPress={handleSaveUsername} disabled={savingUsername}>
              <Text style={styles.saveChipText}>{savingUsername ? '...' : 'OK'}</Text>
            </TouchableOpacity>
          </View>
          {usernameMsg ? (
            <Text style={[styles.msg, usernameMsg.startsWith('Erreur') ? styles.msgError : styles.msgSuccess]}>
              {usernameMsg}
            </Text>
          ) : null}
        </View>

        {/* Sécurité */}
        <Text style={styles.groupLabel}>Sécurité</Text>
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Mot de passe</Text>
          <Text style={styles.hint}>Compte : {email}</Text>
          <View style={styles.fieldRow}>
            <TextInput
              style={[styles.input, styles.inputInline]}
              value={newPassword}
              onChangeText={(v) => { setNewPassword(v); setPasswordMsg('') }}
              placeholder="Nouveau mot de passe"
              placeholderTextColor="#B8A9A0"
              secureTextEntry
            />
            <TouchableOpacity style={styles.saveChip} onPress={handleSavePassword} disabled={savingPassword}>
              <Text style={styles.saveChipText}>{savingPassword ? '...' : 'OK'}</Text>
            </TouchableOpacity>
          </View>
          {passwordMsg ? (
            <Text style={[styles.msg, passwordMsg.startsWith('Erreur') ? styles.msgError : styles.msgSuccess]}>
              {passwordMsg}
            </Text>
          ) : null}
        </View>

        {/* Préférences : objectif + ville regroupés */}
        <Text style={styles.groupLabel}>Préférences</Text>
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Objectif mensuel</Text>
          <Text style={styles.hint}>Nombre de dates que tu veux faire par mois</Text>
          <View style={styles.fieldRow}>
            <TextInput
              style={[styles.input, styles.inputInline]}
              value={monthlyGoal}
              onChangeText={(v) => { setMonthlyGoal(v.replace(/[^0-9]/g, '')); setGoalMsg('') }}
              placeholder="Ex : 2"
              placeholderTextColor="#B8A9A0"
              keyboardType="number-pad"
              maxLength={2}
            />
            <TouchableOpacity style={styles.saveChip} onPress={handleSaveGoal} disabled={savingGoal}>
              <Text style={styles.saveChipText}>{savingGoal ? '...' : 'OK'}</Text>
            </TouchableOpacity>
          </View>
          {goalMsg ? (
            <Text style={[styles.msg, goalMsg.startsWith('Erreur') ? styles.msgError : styles.msgSuccess]}>
              {goalMsg}
            </Text>
          ) : null}

          <View style={styles.rowDivider} />

          <Text style={styles.fieldLabel}>📍 Ma ville</Text>
          <Text style={styles.hint}>Utilisée pour te proposer des idées de dates près de chez toi</Text>
          <View style={styles.fieldRow}>
            <TextInput
              style={[styles.input, styles.inputInline]}
              value={ville}
              onChangeText={(v) => { setVille(v); setVilleMsg('') }}
              placeholder="Ex : Lyon"
              placeholderTextColor="#B8A9A0"
            />
            <TouchableOpacity style={styles.saveChip} onPress={() => saveVille(ville)} disabled={savingVille}>
              <Text style={styles.saveChipText}>{savingVille ? '...' : 'OK'}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={useCurrentLocation} disabled={locatingVille} style={styles.locateLink}>
            <Ionicons name="navigate-outline" size={13} color="#D4517E" />
            <Text style={styles.locateLinkText}>
              {locatingVille ? 'Localisation...' : 'Utiliser ma position actuelle'}
            </Text>
          </TouchableOpacity>
          {villeMsg ? (
            <Text style={[styles.msg, villeMsg.startsWith('Erreur') ? styles.msgError : styles.msgSuccess]}>
              {villeMsg}
            </Text>
          ) : null}
        </View>

        {/* Données */}
        <Text style={styles.groupLabel}>Données</Text>
        <View style={styles.section}>
          <TouchableOpacity style={styles.plainRow} onPress={exportCSV} disabled={exportingCSV}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Exporter mes données</Text>
              <Text style={styles.hint}>Télécharge tous tes dates au format CSV</Text>
            </View>
            {exportingCSV ? <ActivityIndicator color="#D4517E" /> : <Ionicons name="download-outline" size={20} color="#D4517E" />}
          </TouchableOpacity>
        </View>

        {/* Zone de danger */}
        <Text style={styles.groupLabel}>⚠️ Zone de danger</Text>
        <View style={[styles.section, styles.dangerZone]}>
          {deleteMsg ? <Text style={styles.msgError}>{deleteMsg}</Text> : null}
          {!confirmDelete ? (
            <TouchableOpacity style={styles.dangerBtn} onPress={() => setConfirmDelete(true)}>
              <Text style={styles.dangerBtnText}>Supprimer mon compte</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.confirmBox}>
              <Text style={styles.confirmWarn}>
                Toutes tes données seront effacées définitivement. Cette action est irréversible.
              </Text>
              <TouchableOpacity
                style={styles.confirmYes}
                onPress={execDeleteAccount}
                disabled={deletingAccount}
              >
                <Text style={styles.confirmYesText}>
                  {deletingAccount ? 'Suppression...' : 'Oui, supprimer mon compte'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmNo} onPress={() => setConfirmDelete(false)}>
                <Text style={styles.confirmNoText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF8F5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0D9D9' },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 80 },
  back: { color: '#D4517E', fontSize: 16, fontWeight: '500' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#5C4A45' },
  content: { padding: 20, paddingBottom: 60 },
  groupLabel: { fontSize: 12, fontWeight: '700', color: '#B8A9A0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 4, marginLeft: 4 },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#F0D9D9' },
  dangerZone: { borderColor: '#F0B8A8', backgroundColor: '#FFF9F7' },
  rowDivider: { height: 1, backgroundColor: '#F0D9D9', marginVertical: 16 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F0D9D9' },
  avatarPlaceholder: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FDE8F0', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 26, fontWeight: '700', color: '#D4517E' },
  avatarEditBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#fff', borderRadius: 10, width: 22, height: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#F0D9D9' },
  avatarEditText: { fontSize: 12 },
  avatarInfo: { flex: 1 },
  avatarName: { fontSize: 16, fontWeight: '700', color: '#5C4A45', marginBottom: 4 },
  avatarChangeBtn: { fontSize: 13, color: '#D4517E', fontWeight: '600' },
  fieldLabel: { fontSize: 14, fontWeight: '700', color: '#5C4A45', marginBottom: 4 },
  hint: { fontSize: 12, color: '#888', marginBottom: 10 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { borderRadius: 10, borderWidth: 1, borderColor: '#F0D9D9', padding: 12, fontSize: 14, backgroundColor: '#FFF8F5' },
  inputInline: { flex: 1 },
  saveChip: { backgroundColor: '#D4517E', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
  saveChipText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  locateLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  locateLinkText: { color: '#D4517E', fontWeight: '600', fontSize: 12 },
  plainRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  msg: { fontSize: 13, marginTop: 8, lineHeight: 18 },
  msgSuccess: { color: '#3B6D11' },
  msgError: { color: '#D85A30' },
  dangerBtn: { borderRadius: 10, borderWidth: 1, borderColor: '#D85A30', padding: 13, alignItems: 'center' },
  dangerBtnText: { color: '#D85A30', fontWeight: '600', fontSize: 14 },
  confirmBox: { gap: 10 },
  confirmWarn: { fontSize: 13, color: '#D85A30', lineHeight: 18 },
  confirmYes: { backgroundColor: '#D85A30', borderRadius: 10, padding: 13, alignItems: 'center' },
  confirmYesText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  confirmNo: { borderRadius: 10, borderWidth: 1, borderColor: '#D0C5C0', padding: 12, alignItems: 'center' },
  confirmNoText: { color: '#888', fontSize: 14 },
})
