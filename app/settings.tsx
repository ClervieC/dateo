import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image, Share } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { decode } from 'base64-arraybuffer'
import { supabase } from '../lib/supabase'
import { usernameValide } from '../lib/friendsUtils'
import { webContentStyle } from '../lib/webStyles'

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

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteMsg, setDeleteMsg] = useState('')

  const router = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      setEmail(user.email ?? '')
      const { data } = await supabase.from('profiles').select('username, avatar_url, monthly_goal').eq('id', user.id).single()
      if (data) {
        setUsername(data.username)
        setNewUsername(data.username)
        setAvatarUrl(data.avatar_url ?? null)
        setMonthlyGoal(data.monthly_goal != null ? String(data.monthly_goal) : '')
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
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' })

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, decode(base64), { contentType: `image/${fileExt}`, upsert: true })

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

  async function exportCSV() {
    const { data } = await supabase
      .from('dates')
      .select('intitule, lieu, date_du_date, note_globale, commentaire, categorie, statut, conseil_vivement')
      .eq('user_id', userId)
      .order('date_du_date', { ascending: false })

    if (!data) return

    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`
    const headers = 'Intitulé,Lieu,Date,Note,Commentaire,Catégorie,Statut,Conseillé vivement'
    const rows = (data as any[]).map((d) => [
      escape(d.intitule ?? ''),
      escape(d.lieu),
      d.date_du_date,
      d.note_globale,
      escape(d.commentaire ?? ''),
      d.categorie ?? '',
      d.statut ?? 'vecu',
      d.conseil_vivement ? 'Oui' : 'Non',
    ].join(','))

    await Share.share({ message: [headers, ...rows].join('\n'), title: 'Mes dates Dateo' })
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

        {/* Avatar */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photo de profil</Text>
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
        </View>

        {/* Pseudo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pseudo</Text>
          <Text style={styles.currentValue}>Actuel : @{username}</Text>
          <TextInput
            style={styles.input}
            value={newUsername}
            onChangeText={(v) => { setNewUsername(v); setUsernameMsg('') }}
            autoCapitalize="none"
            placeholder="Nouveau pseudo"
            placeholderTextColor="#B8A9A0"
          />
          {usernameMsg ? (
            <Text style={[styles.msg, usernameMsg.startsWith('Erreur') ? styles.msgError : styles.msgSuccess]}>
              {usernameMsg}
            </Text>
          ) : null}
          <TouchableOpacity style={styles.btn} onPress={handleSaveUsername} disabled={savingUsername}>
            <Text style={styles.btnText}>{savingUsername ? '...' : 'Enregistrer le pseudo'}</Text>
          </TouchableOpacity>
        </View>

        {/* Mot de passe */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mot de passe</Text>
          <Text style={styles.hint}>Compte : {email}</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={(v) => { setNewPassword(v); setPasswordMsg('') }}
            placeholder="Nouveau mot de passe"
            placeholderTextColor="#B8A9A0"
            secureTextEntry
          />
          {passwordMsg ? (
            <Text style={[styles.msg, passwordMsg.startsWith('Erreur') ? styles.msgError : styles.msgSuccess]}>
              {passwordMsg}
            </Text>
          ) : null}
          <TouchableOpacity style={styles.btn} onPress={handleSavePassword} disabled={savingPassword}>
            <Text style={styles.btnText}>{savingPassword ? '...' : 'Changer le mot de passe'}</Text>
          </TouchableOpacity>
        </View>

        {/* Objectif mensuel */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Objectif mensuel</Text>
          <Text style={styles.hint}>Nombre de dates que tu veux faire par mois</Text>
          <TextInput
            style={styles.input}
            value={monthlyGoal}
            onChangeText={(v) => { setMonthlyGoal(v.replace(/[^0-9]/g, '')); setGoalMsg('') }}
            placeholder="Ex : 2"
            placeholderTextColor="#B8A9A0"
            keyboardType="number-pad"
            maxLength={2}
          />
          {goalMsg ? (
            <Text style={[styles.msg, goalMsg.startsWith('Erreur') ? styles.msgError : styles.msgSuccess]}>
              {goalMsg}
            </Text>
          ) : null}
          <TouchableOpacity style={styles.btn} onPress={handleSaveGoal} disabled={savingGoal}>
            <Text style={styles.btnText}>{savingGoal ? '...' : 'Enregistrer'}</Text>
          </TouchableOpacity>
        </View>

        {/* Export CSV */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Exporter mes données</Text>
          <Text style={styles.hint}>Télécharge tous tes dates au format CSV</Text>
          <TouchableOpacity style={styles.btn} onPress={exportCSV}>
            <Text style={styles.btnText}>📥 Exporter en CSV</Text>
          </TouchableOpacity>
        </View>

        {/* Supprimer le compte */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Zone de danger</Text>
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
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F0D9D9' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#5C4A45', marginBottom: 12 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F0D9D9' },
  avatarPlaceholder: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FDE8F0', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 28, fontWeight: '700', color: '#D4517E' },
  avatarEditBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#fff', borderRadius: 10, width: 22, height: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#F0D9D9' },
  avatarEditText: { fontSize: 12 },
  avatarInfo: { flex: 1 },
  avatarName: { fontSize: 16, fontWeight: '700', color: '#5C4A45', marginBottom: 4 },
  avatarChangeBtn: { fontSize: 13, color: '#D4517E', fontWeight: '600' },
  currentValue: { fontSize: 13, color: '#888', marginBottom: 8 },
  hint: { fontSize: 13, color: '#888', marginBottom: 10 },
  input: { borderRadius: 10, borderWidth: 1, borderColor: '#F0D9D9', padding: 12, fontSize: 14, marginBottom: 8, backgroundColor: '#FFF8F5' },
  msg: { fontSize: 13, marginBottom: 8, lineHeight: 18 },
  msgSuccess: { color: '#3B6D11' },
  msgError: { color: '#D85A30', marginBottom: 8 },
  btn: { backgroundColor: '#D4517E', borderRadius: 10, padding: 13, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  dangerBtn: { borderRadius: 10, borderWidth: 1, borderColor: '#D85A30', padding: 13, alignItems: 'center' },
  dangerBtnText: { color: '#D85A30', fontWeight: '600', fontSize: 14 },
  confirmBox: { gap: 10 },
  confirmWarn: { fontSize: 13, color: '#D85A30', lineHeight: 18 },
  confirmYes: { backgroundColor: '#D85A30', borderRadius: 10, padding: 13, alignItems: 'center' },
  confirmYesText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  confirmNo: { borderRadius: 10, borderWidth: 1, borderColor: '#D0C5C0', padding: 12, alignItems: 'center' },
  confirmNoText: { color: '#888', fontSize: 14 },
})
