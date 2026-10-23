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
import { useUsernameCheck } from '../lib/useUsernameCheck'
import { MIN_PASSWORD_LENGTH, traduireErreurAuth } from '../lib/authErrors'
import { confirmAction } from '../lib/alert'
import { LanguageSwitcher } from '../lib/LanguageSwitcher'
import { ThemeSwitcher } from '../lib/ThemeSwitcher'
import { CRITERES } from '../lib/criteres'
import { ScreenHeader } from '../lib/ScreenHeader'
import { t } from '../lib/i18n'
import { C, themedStyles } from '../lib/theme'

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
  const [showPassword, setShowPassword] = useState(false)
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
  const [exportingJSON, setExportingJSON] = useState(false)
  const [deleteMsg, setDeleteMsg] = useState('')

  const router = useRouter()
  const usernameCheck = useUsernameCheck(newUsername, username)

  const [loadError, setLoadError] = useState(false)

  // En cas d'échec (réseau, session expirée), on affiche une erreur avec « Réessayer »
  // plutôt qu'une roue de chargement infinie.
  async function load() {
    setLoading(true)
    setLoadError(false)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoadError(true); return }
      setUserId(user.id)
      setEmail(user.email ?? '')
      const { data, error } = await supabase.from('profiles').select('username, avatar_url, monthly_goal, ville').eq('id', user.id).single()
      if (error || !data) { setLoadError(true); return }
      setUsername(data.username)
      setNewUsername(data.username)
      setAvatarUrl(data.avatar_url ?? null)
      setMonthlyGoal(data.monthly_goal != null ? String(data.monthly_goal) : '')
      setVille((data as any).ville ?? '')
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

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
      setAvatarMsg(t("Photo mise à jour !"))
    } catch (e: any) {
      setAvatarMsg(t("Erreur : {message}", { message: e.message }))
    }
    setUploadingAvatar(false)
  }

  async function handleSaveUsername() {
    const validation = usernameValide(newUsername)
    if (!validation.valide) { setUsernameMsg(t("Erreur : {message}", { message: validation.message })); return }
    if (newUsername.trim() === username) return
    if (usernameCheck.status === 'taken') { setUsernameMsg(t("Erreur : {message}", { message: t("Ce pseudo est déjà pris") })); return }
    setSavingUsername(true)
    setUsernameMsg('')
    const { error } = await supabase.from('profiles').update({ username: newUsername.trim() }).eq('id', userId)
    setSavingUsername(false)
    if (error) setUsernameMsg(t("Erreur : {message}", { message: error.code === '23505' ? t("Ce pseudo est déjà pris") : error.message }))
    else { setUsername(newUsername.trim()); setUsernameMsg(t("Pseudo mis à jour !")) }
  }

  async function handleSavePassword() {
    if (newPassword.length < MIN_PASSWORD_LENGTH) { setPasswordMsg(t("Erreur : {message}", { message: t("Au moins {n} caractères", { n: MIN_PASSWORD_LENGTH }) })); return }
    setSavingPassword(true)
    setPasswordMsg('')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)
    if (error) setPasswordMsg(t("Erreur : {message}", { message: traduireErreurAuth(error.message) }))
    else { setNewPassword(''); setPasswordMsg(t("Mot de passe modifié !")) }
  }

  async function handleSaveGoal() {
    const n = parseInt(monthlyGoal, 10)
    if (monthlyGoal !== '' && (isNaN(n) || n < 0 || n > 99)) {
      setGoalMsg(t("Erreur : {message}", { message: t("entre 0 et 99") })); return
    }
    setSavingGoal(true)
    setGoalMsg('')
    await supabase.from('profiles').update({ monthly_goal: monthlyGoal === '' ? null : n }).eq('id', userId)
    setSavingGoal(false)
    setGoalMsg(t("Objectif mis à jour !"))
  }

  async function saveVille(newVille: string) {
    setSavingVille(true)
    setVilleMsg('')
    const { error } = await supabase.from('profiles').update({ ville: newVille.trim() || null }).eq('id', userId)
    setSavingVille(false)
    if (error) { setVilleMsg(t("Erreur : {message}", { message: error.message })); return }
    setVille(newVille.trim())
    setVilleMsg(t("Ville mise à jour !"))
  }

  async function useCurrentLocation() {
    setVilleMsg('')
    setLocatingVille(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setVilleMsg(t("Erreur : {message}", { message: t("permission de localisation refusée") }))
        return
      }
      const position = await Location.getCurrentPositionAsync({})
      const [place] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      })
      const detectedVille = place?.city ?? place?.subregion ?? place?.region ?? null
      if (!detectedVille) {
        setVilleMsg(t("Erreur : {message}", { message: t("impossible de déterminer ta ville, entre-la manuellement") }))
        return
      }
      await saveVille(detectedVille)
    } catch (err) {
      setVilleMsg(t("Erreur : {message}", { message: err instanceof Error ? err.message : t("localisation indisponible") }))
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
      t("Intitulé"), t("Lieu"), t("Date"), t("Note globale"), t("Commentaire"), t("Catégorie"), t("Statut"),
      t("Conseillé vivement"), t("Visibilité"), t("Avec qui"),
      ...CRITERES.map((c) => t(c.label)),
    ].map(escape).join(',')

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
        d.statut === 'planifie' ? t("Planifié") : t("Vécu"),
        d.conseil_vivement ? t("Oui") : t("Non"),
        d.visibilite === 'private' ? t("Privé") : t("Amis"),
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

    await Share.share({ message: [headers, ...rows].join('\n'), title: t("Mes dates Dateo") })
    setExportingCSV(false)
  }

  // Export RGPD complet (droit d'accès / portabilité, art. 15 et 20) : contrairement
  // au CSV ci-dessus (pensé pour un tableur, limité aux dates notés), celui-ci reprend
  // l'intégralité des données personnelles stockées, tables annexes comprises.
  async function exportFullData() {
    setExportingJSON(true)

    const [
      { data: profile },
      { data: dates },
      { data: comments },
      { data: reactions },
      { data: dateFavorites },
      { data: ideaFavorites },
      { data: wishlist },
      { data: partnerRatings },
      { data: couples },
      { data: friends },
    ] = await Promise.all([
      supabase.from('profiles').select('id, username, avatar_url, ville, monthly_goal').eq('id', userId).single(),
      supabase.from('dates').select('*, ratings(*), date_photos(photo_url, ordre), date_participants(user_id)').eq('user_id', userId),
      supabase.from('date_comments').select('*').eq('user_id', userId),
      supabase.from('date_reactions').select('*').eq('user_id', userId),
      supabase.from('date_favorites').select('*').eq('user_id', userId),
      supabase.from('user_favorites').select('*').eq('user_id', userId),
      supabase.from('wishlist_lieux').select('*').eq('user_id', userId),
      supabase.from('date_partner_ratings').select('*').eq('partner_id', userId),
      supabase.from('couples').select('*').or(`user1_id.eq.${userId},user2_id.eq.${userId}`),
      supabase.from('friends').select('*').or(`user_id.eq.${userId},friend_id.eq.${userId}`),
    ])

    const payload = {
      export_genere_le: new Date().toISOString(),
      profil: { ...profile, email },
      dates,
      commentaires: comments,
      reactions,
      dates_favorites: dateFavorites,
      idees_favorites: ideaFavorites,
      lieux_a_essayer: wishlist,
      notes_partenaire: partnerRatings,
      relations_couple: couples,
      amis: friends,
    }

    await Share.share({ message: JSON.stringify(payload, null, 2), title: t("Mes données Dateo (export complet)") })
    setExportingJSON(false)
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
    if (json.error) { setDeleteMsg(t("Erreur : {message}", { message: json.error })); setConfirmDelete(false) }
    else await supabase.auth.signOut()
  }

  if (loading || loadError) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader fallback="/(tabs)/profile" title={t("Paramètres")} />
        {loading ? (
          <ActivityIndicator color={C.primary} style={{ marginTop: 60 }} />
        ) : (
          <View style={styles.errorBox}>
            <Ionicons name="cloud-offline-outline" size={40} color={C.faint} />
            <Text style={styles.errorTitle}>{t("Impossible de charger tes paramètres")}</Text>
            <Text style={styles.hint}>{t("Vérifie ta connexion puis réessaie.")}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={load}>
              <Text style={styles.retryText}>{t("Réessayer")}</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader fallback="/(tabs)/profile" title={t("Paramètres")} />

      <ScrollView contentContainerStyle={[styles.content, webContentStyle]}>

        {/* Profil : avatar + pseudo regroupés */}
        <Text style={styles.groupLabel}>{t("Profil")}</Text>
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
                {uploadingAvatar ? <Text style={styles.avatarEditText}>...</Text> : <Ionicons name="camera" size={12} color={C.primaryText} />}
              </View>
            </TouchableOpacity>
            <View style={styles.avatarInfo}>
              <Text style={styles.avatarName}>@{username}</Text>
              <TouchableOpacity onPress={pickAvatar} disabled={uploadingAvatar}>
                <Text style={styles.avatarChangeBtn}>{uploadingAvatar ? t("Envoi en cours...") : t("Changer la photo")}</Text>
              </TouchableOpacity>
            </View>
          </View>
          {avatarMsg ? (
            <Text style={[styles.msg, avatarMsg.startsWith(t("Erreur")) ? styles.msgError : styles.msgSuccess]}>
              {avatarMsg}
            </Text>
          ) : null}

          <View style={styles.rowDivider} />

          <Text style={styles.fieldLabel}>{t("Pseudo")}</Text>
          <View style={styles.fieldRow}>
            <TextInput
              style={[styles.input, styles.inputInline]}
              value={newUsername}
              onChangeText={(v) => { setNewUsername(v); setUsernameMsg('') }}
              autoCapitalize="none"
              placeholder={t("Pseudo")}
              placeholderTextColor={C.faint}
            />
            <TouchableOpacity
              style={[styles.saveChip, (newUsername.trim() === username || usernameCheck.status === 'taken') && styles.saveChipDisabled]}
              onPress={handleSaveUsername}
              disabled={savingUsername || newUsername.trim() === username}
            >
              <Text style={styles.saveChipText}>{savingUsername ? '...' : 'OK'}</Text>
            </TouchableOpacity>
          </View>
          {!usernameMsg && usernameCheck.status !== 'idle' ? (
            <Text style={[styles.msg, usernameCheck.status === 'available' ? styles.msgSuccess : usernameCheck.status === 'checking' ? styles.msgMuted : styles.msgError]}>
              {usernameCheck.status === 'checking' ? t("Vérification…") : usernameCheck.message}
            </Text>
          ) : null}
          {usernameMsg ? (
            <Text style={[styles.msg, usernameMsg.startsWith(t("Erreur")) ? styles.msgError : styles.msgSuccess]}>
              {usernameMsg}
            </Text>
          ) : null}
        </View>

        {/* Sécurité */}
        <Text style={styles.groupLabel}>{t("Sécurité")}</Text>
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>{t("Mot de passe")}</Text>
          <Text style={styles.hint}>{t("Compte : {email}", { email })}</Text>
          <View style={styles.fieldRow}>
            <TextInput
              style={[styles.input, styles.inputInline]}
              value={newPassword}
              onChangeText={(v) => { setNewPassword(v); setPasswordMsg('') }}
              placeholder={t("Nouveau mot de passe ({n} car. min.)", { n: MIN_PASSWORD_LENGTH })}
              placeholderTextColor={C.faint}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
            />
            <TouchableOpacity
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={showPassword ? t("Masquer le mot de passe") : t("Afficher le mot de passe")}
            >
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.faint} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveChip} onPress={handleSavePassword} disabled={savingPassword}>
              <Text style={styles.saveChipText}>{savingPassword ? '...' : 'OK'}</Text>
            </TouchableOpacity>
          </View>
          {passwordMsg ? (
            <Text style={[styles.msg, passwordMsg.startsWith(t("Erreur")) ? styles.msgError : styles.msgSuccess]}>
              {passwordMsg}
            </Text>
          ) : null}
        </View>

        {/* Préférences : objectif + ville regroupés */}
        <Text style={styles.groupLabel}>{t("Préférences")}</Text>
        <View style={styles.section}>
          <View style={styles.plainRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>{t("Langue")}</Text>
              <Text style={[styles.hint, { marginBottom: 0 }]}>{t("Langue de l'application")}</Text>
            </View>
            <LanguageSwitcher />
          </View>

          <View style={styles.rowDivider} />

          <Text style={styles.fieldLabel}>{t("Apparence")}</Text>
          <Text style={styles.hint}>{t("« Système » suit le mode clair/sombre de ton téléphone")}</Text>
          <ThemeSwitcher />

          <View style={styles.rowDivider} />

          <Text style={styles.fieldLabel}>{t("Objectif mensuel")}</Text>
          <Text style={styles.hint}>{t("Nombre de dates que tu veux faire par mois")}</Text>
          <View style={styles.fieldRow}>
            <TextInput
              style={[styles.input, styles.inputInline]}
              value={monthlyGoal}
              onChangeText={(v) => { setMonthlyGoal(v.replace(/[^0-9]/g, '')); setGoalMsg('') }}
              placeholder={t("Ex : 2")}
              placeholderTextColor={C.faint}
              keyboardType="number-pad"
              maxLength={2}
            />
            <TouchableOpacity style={styles.saveChip} onPress={handleSaveGoal} disabled={savingGoal}>
              <Text style={styles.saveChipText}>{savingGoal ? '...' : 'OK'}</Text>
            </TouchableOpacity>
          </View>
          {goalMsg ? (
            <Text style={[styles.msg, goalMsg.startsWith(t("Erreur")) ? styles.msgError : styles.msgSuccess]}>
              {goalMsg}
            </Text>
          ) : null}

          <View style={styles.rowDivider} />

          <Text style={styles.fieldLabel}>{t("Ma ville")}</Text>
          <Text style={styles.hint}>{t("Utilisée pour te proposer des idées de dates près de chez toi")}</Text>
          <View style={styles.fieldRow}>
            <TextInput
              style={[styles.input, styles.inputInline]}
              value={ville}
              onChangeText={(v) => { setVille(v); setVilleMsg('') }}
              placeholder={t("Ex : Lyon")}
              placeholderTextColor={C.faint}
              returnKeyType="done"
              onSubmitEditing={() => saveVille(ville)}
            />
            <TouchableOpacity style={styles.saveChip} onPress={() => saveVille(ville)} disabled={savingVille}>
              <Text style={styles.saveChipText}>{savingVille ? '...' : 'OK'}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={useCurrentLocation} disabled={locatingVille} style={styles.locateLink}>
            <Ionicons name="navigate-outline" size={13} color={C.primary} />
            <Text style={styles.locateLinkText}>
              {locatingVille ? t("Localisation...") : t("Utiliser ma position actuelle")}
            </Text>
          </TouchableOpacity>
          {villeMsg ? (
            <Text style={[styles.msg, villeMsg.startsWith(t("Erreur")) ? styles.msgError : styles.msgSuccess]}>
              {villeMsg}
            </Text>
          ) : null}
        </View>

        {/* Données */}
        <Text style={styles.groupLabel}>{t("Données")}</Text>
        <View style={styles.section}>
          <TouchableOpacity style={styles.plainRow} onPress={exportCSV} disabled={exportingCSV}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>{t("Exporter mes dates (CSV)")}</Text>
              <Text style={styles.hint}>{t("Tableau de tes dates notés, pour un tableur")}</Text>
            </View>
            {exportingCSV ? <ActivityIndicator color={C.primary} /> : <Ionicons name="download-outline" size={20} color={C.primary} />}
          </TouchableOpacity>
          <View style={styles.rowDivider} />
          <TouchableOpacity style={styles.plainRow} onPress={exportFullData} disabled={exportingJSON}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>{t("Export complet de mes données")}</Text>
              <Text style={styles.hint}>{t("Toutes tes données personnelles au format JSON (RGPD)")}</Text>
            </View>
            {exportingJSON ? <ActivityIndicator color={C.primary} /> : <Ionicons name="download-outline" size={20} color={C.primary} />}
          </TouchableOpacity>
          <View style={styles.rowDivider} />
          <TouchableOpacity style={styles.plainRow} onPress={() => router.push('/privacy')}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>{t("Politique de confidentialité")}</Text>
              <Text style={styles.hint}>{t("Quelles données sont collectées et pourquoi")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={C.faint} />
          </TouchableOpacity>
          <View style={styles.rowDivider} />
          <TouchableOpacity style={styles.plainRow} onPress={() => router.push('/terms')}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>{t("Conditions d'utilisation")}</Text>
              <Text style={styles.hint}>{t("CGU du service")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={C.faint} />
          </TouchableOpacity>
        </View>

        {/* Compte */}
        <Text style={styles.groupLabel}>{t("Compte")}</Text>
        <View style={styles.section}>
          <TouchableOpacity style={styles.plainRow} onPress={() => router.push('/onboarding')}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>{t("Revoir la présentation")}</Text>
              <Text style={styles.hint}>{t("Les principales fonctionnalités de Dateo en 5 écrans")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={C.faint} />
          </TouchableOpacity>
          <View style={styles.rowDivider} />
          <TouchableOpacity
            style={styles.plainRow}
            onPress={() => confirmAction(t("Se déconnecter ?"), t("Tu pourras te reconnecter avec ton email et ton mot de passe."), t("Se déconnecter"), () => { supabase.auth.signOut() })}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>{t("Se déconnecter")}</Text>
              <Text style={styles.hint}>{email}</Text>
            </View>
            <Ionicons name="log-out-outline" size={20} color={C.primary} />
          </TouchableOpacity>
        </View>

        {/* Zone de danger */}
        <Text style={[styles.groupLabel, { color: C.danger }]}>{t("Zone de danger")}</Text>
        <View style={[styles.section, styles.dangerZone]}>
          {deleteMsg ? <Text style={styles.msgError}>{deleteMsg}</Text> : null}
          {!confirmDelete ? (
            <TouchableOpacity style={styles.dangerBtn} onPress={() => setConfirmDelete(true)}>
              <Text style={styles.dangerBtnText}>{t("Supprimer mon compte")}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.confirmBox}>
              <Text style={styles.confirmWarn}>
                {t("Toutes tes données seront effacées définitivement. Cette action est irréversible.")}
              </Text>
              <TouchableOpacity
                style={styles.confirmYes}
                onPress={execDeleteAccount}
                disabled={deletingAccount}
              >
                <Text style={styles.confirmYesText}>
                  {deletingAccount ? t("Suppression...") : t("Oui, supprimer mon compte")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmNo} onPress={() => setConfirmDelete(false)}>
                <Text style={styles.confirmNoText}>{t("Annuler")}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = themedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 80 },
  back: { color: C.primaryText, fontSize: 16, fontWeight: '500' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  content: { padding: 20, paddingBottom: 60 },
  groupLabel: { fontSize: 12, fontWeight: '700', color: C.faint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 4, marginLeft: 4 },
  section: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: C.border },
  dangerZone: { borderColor: C.dangerBorder, backgroundColor: C.bgAlt },
  rowDivider: { height: 1, backgroundColor: C.border, marginVertical: 16 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.border },
  avatarPlaceholder: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.primarySoft, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 26, fontWeight: '700', color: C.primaryText },
  avatarEditBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: C.card, borderRadius: 10, width: 22, height: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },
  avatarEditText: { fontSize: 12 },
  avatarInfo: { flex: 1 },
  avatarName: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 4 },
  avatarChangeBtn: { fontSize: 13, color: C.primaryText, fontWeight: '600' },
  fieldLabel: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 4 },
  hint: { fontSize: 12, color: C.muted, marginBottom: 10 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 12, fontSize: 14, backgroundColor: C.bg },
  inputInline: { flex: 1 },
  saveChip: { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
  saveChipText: { color: C.onPrimary, fontWeight: '700', fontSize: 13 },
  saveChipDisabled: { opacity: 0.4 },
  msgMuted: { color: C.muted },
  locateLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  locateLinkText: { color: C.primaryText, fontWeight: '600', fontSize: 12 },
  plainRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  msg: { fontSize: 13, marginTop: 8, lineHeight: 18 },
  msgSuccess: { color: C.success },
  msgError: { color: C.danger },
  dangerBtn: { borderRadius: 10, borderWidth: 1, borderColor: C.danger, padding: 13, alignItems: 'center' },
  dangerBtnText: { color: C.danger, fontWeight: '600', fontSize: 14 },
  confirmBox: { gap: 10 },
  confirmWarn: { fontSize: 13, color: C.danger, lineHeight: 18 },
  confirmYes: { backgroundColor: C.danger, borderRadius: 10, padding: 13, alignItems: 'center' },
  confirmYesText: { color: C.onPrimary, fontWeight: '700', fontSize: 14 },
  confirmNo: { borderRadius: 10, borderWidth: 1, borderColor: C.borderStrong, padding: 12, alignItems: 'center' },
  errorBox: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32, gap: 6 },
  errorTitle: { fontSize: 16, fontWeight: '700', color: C.text, textAlign: 'center', marginTop: 8 },
  retryBtn: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, marginTop: 8 },
  retryText: { color: C.onPrimary, fontWeight: '700', fontSize: 15 },
  confirmNoText: { color: C.muted, fontSize: 14 },
}))
