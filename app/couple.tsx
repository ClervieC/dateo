import { useState, useEffect, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { webContentStyle } from '../lib/webStyles'
import { todayIso, formaterDate } from '../lib/dateUtils'
import { DatePicker } from '../lib/DatePicker'

type CoupleRow = {
  id: string
  status: 'pending' | 'accepted'
  isSender: boolean
  partnerUsername: string
  partnerAvatar: string | null
  partnerId: string
  dateDebut: string | null
}

type CoupleStats = {
  myCount: number
  myMoyenne: number
  partnerCount: number
  partnerMoyenne: number
}

export default function Couple() {
  const [myId, setMyId] = useState('')
  const [couple, setCouple] = useState<CoupleRow | null>(null)
  const [coupleStats, setCoupleStats] = useState<CoupleStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchUsername, setSearchUsername] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchMsg, setSearchMsg] = useState('')
  const [actionMsg, setActionMsg] = useState('')
  const [actioning, setActioning] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [confirmDecline, setConfirmDecline] = useState(false)
  const [dateDebutIso, setDateDebutIso] = useState(todayIso())
  const [dateDebutError, setDateDebutError] = useState('')
  const [editingDateDebut, setEditingDateDebut] = useState(false)
  const [savingDateDebut, setSavingDateDebut] = useState(false)
  const router = useRouter()

  const loadCouple = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setMyId(user.id)

    const { data } = await supabase
      .from('couples')
      .select('id, user1_id, user2_id, status, date_debut')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .maybeSingle()

    if (!data) { setCouple(null); setLoading(false); return }

    const isSender = data.user1_id === user.id
    const partnerId = isSender ? data.user2_id : data.user1_id

    const { data: profile } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', partnerId)
      .single()

    setCouple({
      id: data.id,
      status: data.status,
      isSender,
      partnerUsername: profile?.username ?? '?',
      partnerAvatar: profile?.avatar_url ?? null,
      partnerId,
      dateDebut: (data as any).date_debut ?? null,
    })

    if (data.status === 'accepted') {
      const [{ data: myDates }, { data: partnerDates }] = await Promise.all([
        supabase.from('dates').select('note_globale').eq('user_id', user.id).eq('statut', 'vecu'),
        supabase.from('dates').select('note_globale').eq('user_id', partnerId).eq('statut', 'vecu'),
      ])
      const myMoy = (myDates ?? []).length > 0 ? (myDates as any[]).reduce((s, d) => s + d.note_globale, 0) / (myDates as any[]).length : 0
      const partMoy = (partnerDates ?? []).length > 0 ? (partnerDates as any[]).reduce((s, d) => s + d.note_globale, 0) / (partnerDates as any[]).length : 0
      setCoupleStats({ myCount: (myDates ?? []).length, myMoyenne: myMoy, partnerCount: (partnerDates ?? []).length, partnerMoyenne: partMoy })
    }

    setLoading(false)
  }, [])

  useEffect(() => { loadCouple() }, [loadCouple])

  async function sendInvite() {
    const q = searchUsername.trim().toLowerCase()
    if (!q) return
    setSearching(true)
    setSearchMsg('')

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, username')
      .ilike('username', q)
      .single()

    if (!profile) { setSearchMsg('Utilisateur introuvable'); setSearching(false); return }
    if (profile.id === myId) { setSearchMsg('Tu ne peux pas t\'inviter toi-même'); setSearching(false); return }

    const { error } = await supabase.from('couples').insert({ user1_id: myId, user2_id: profile.id })
    setSearching(false)
    if (error) {
      setSearchMsg(error.code === '23505' ? 'Invitation déjà envoyée' : `Erreur : ${error.message}`)
    } else {
      setSearchMsg('')
      setSearchUsername('')
      sendCoupleInviteNotification(profile.id)
      await loadCouple()
    }
  }

  async function sendCoupleInviteNotification(recipientId: string, type: 'invite' | 'accepted' = 'invite') {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      // Le token push de destinataire n'est jamais lu côté client : la edge function
      // vérifie qu'une ligne "couples" justifie la notification avant de l'envoyer.
      await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/notify-social`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ recipient_id: recipientId, type: type === 'invite' ? 'couple_invite' : 'couple_accepted' }),
      })
    } catch {
      // Notification silencieusement ignorée en cas d'échec réseau
    }
  }

  async function acceptInvite() {
    if (!couple) return
    setDateDebutError('')
    setActioning(true)
    const { error } = await supabase.from('couples').update({ status: 'accepted', date_debut: dateDebutIso }).eq('id', couple.id)
    setActioning(false)
    if (!error) sendCoupleInviteNotification(couple.partnerId, 'accepted')
    if (error) setActionMsg(`Erreur : ${error.message}`)
    else await loadCouple()
  }

  async function saveDateDebut() {
    if (!couple) return
    setDateDebutError('')
    setSavingDateDebut(true)
    const { error } = await supabase.from('couples').update({ date_debut: dateDebutIso }).eq('id', couple.id)
    setSavingDateDebut(false)
    if (error) { setDateDebutError(error.message); return }
    setEditingDateDebut(false)
    await loadCouple()
  }

  async function declineInvite() {
    if (!couple) return
    setActioning(true)
    await supabase.from('couples').delete().eq('id', couple.id)
    setActioning(false)
    setCouple(null)
    setConfirmDecline(false)
  }

  async function disconnect() {
    if (!couple) return
    setActioning(true)
    await supabase.from('couples').delete().eq('id', couple.id)
    setActioning(false)
    setCouple(null)
    setConfirmDisconnect(false)
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ActivityIndicator color="#D4517E" style={{ marginTop: 60 }} size="large" />
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
        <Text style={styles.headerTitle}>Mode Couple</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, webContentStyle]}>
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>💑</Text>
          <Text style={styles.heroTitle}>Lier vos comptes</Text>
          <Text style={styles.heroSub}>
            Reliez votre compte à celui de votre partenaire pour partager vos dates dans le feed et voir un badge couple.
          </Text>
        </View>

        {/* Pas de couple */}
        {!couple && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Inviter mon partenaire</Text>
            <TextInput
              style={styles.input}
              value={searchUsername}
              onChangeText={(v) => { setSearchUsername(v); setSearchMsg('') }}
              placeholder="Pseudo de ton partenaire"
              placeholderTextColor="#B8A9A0"
              autoCapitalize="none"
            />
            {searchMsg ? <Text style={styles.msgError}>{searchMsg}</Text> : null}
            <TouchableOpacity style={styles.btn} onPress={sendInvite} disabled={searching}>
              <Text style={styles.btnText}>{searching ? '...' : 'Envoyer l\'invitation'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Invitation reçue (tu es user2, status pending) */}
        {couple && couple.status === 'pending' && !couple.isSender && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Invitation reçue</Text>
            <View style={styles.partnerCard}>
              {couple.partnerAvatar ? (
                <Image source={{ uri: couple.partnerAvatar }} style={styles.partnerAvatar} />
              ) : (
                <View style={styles.partnerAvatarPlaceholder}>
                  <Text style={styles.partnerAvatarInitial}>{couple.partnerUsername.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.partnerName}>@{couple.partnerUsername}</Text>
                <Text style={styles.partnerSub}>t'a invité(e) en mode couple</Text>
              </View>
            </View>
            <Text style={styles.label}>Vous êtes en couple depuis le :</Text>
            <DatePicker value={dateDebutIso} onChange={(iso) => { setDateDebutIso(iso); setDateDebutError('') }} />
            {dateDebutError ? <Text style={styles.msgError}>{dateDebutError}</Text> : null}
            {actionMsg ? <Text style={styles.msgError}>{actionMsg}</Text> : null}
            <TouchableOpacity style={styles.btn} onPress={acceptInvite} disabled={actioning}>
              <Text style={styles.btnText}>{actioning ? '...' : '✓ Accepter'}</Text>
            </TouchableOpacity>
            {!confirmDecline ? (
              <TouchableOpacity style={styles.outlineBtn} onPress={() => setConfirmDecline(true)} disabled={actioning}>
                <Text style={styles.outlineBtnText}>Refuser</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.confirmBox}>
                <Text style={styles.confirmWarn}>Refuser cette invitation ?</Text>
                <TouchableOpacity style={styles.confirmYes} onPress={declineInvite} disabled={actioning}>
                  <Text style={styles.confirmYesText}>{actioning ? '...' : 'Oui, refuser'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.outlineBtn} onPress={() => setConfirmDecline(false)}>
                  <Text style={styles.outlineBtnText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Invitation envoyée (tu es user1, status pending) */}
        {couple && couple.status === 'pending' && couple.isSender && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Invitation envoyée</Text>
            <View style={styles.partnerCard}>
              {couple.partnerAvatar ? (
                <Image source={{ uri: couple.partnerAvatar }} style={styles.partnerAvatar} />
              ) : (
                <View style={styles.partnerAvatarPlaceholder}>
                  <Text style={styles.partnerAvatarInitial}>{couple.partnerUsername.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.partnerName}>@{couple.partnerUsername}</Text>
                <Text style={styles.partnerSub}>En attente d'acceptation…</Text>
              </View>
            </View>
            {!confirmDecline ? (
              <TouchableOpacity style={styles.outlineBtn} onPress={() => setConfirmDecline(true)}>
                <Text style={styles.outlineBtnText}>Annuler l'invitation</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.confirmBox}>
                <Text style={styles.confirmWarn}>Annuler cette invitation ?</Text>
                <TouchableOpacity style={styles.confirmYes} onPress={declineInvite} disabled={actioning}>
                  <Text style={styles.confirmYesText}>{actioning ? '...' : "Oui, annuler l'invitation"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.outlineBtn} onPress={() => setConfirmDecline(false)}>
                  <Text style={styles.outlineBtnText}>Retour</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Couple actif */}
        {couple && couple.status === 'accepted' && (
          <View style={styles.section}>
            <View style={styles.coupleActiveHeader}>
              <Text style={styles.coupleActiveBadge}>💑 Couple lié</Text>
            </View>
            <View style={styles.partnerCard}>
              {couple.partnerAvatar ? (
                <Image source={{ uri: couple.partnerAvatar }} style={styles.partnerAvatar} />
              ) : (
                <View style={styles.partnerAvatarPlaceholder}>
                  <Text style={styles.partnerAvatarInitial}>{couple.partnerUsername.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.partnerName}>@{couple.partnerUsername}</Text>
                <Text style={styles.partnerSub}>Les dates de votre partenaire apparaissent dans votre feed</Text>
              </View>
            </View>

            {!editingDateDebut ? (
              <TouchableOpacity style={styles.dateDebutRow} onPress={() => { setDateDebutIso(couple.dateDebut ?? todayIso()); setEditingDateDebut(true) }}>
                <Text style={styles.dateDebutText}>
                  {couple.dateDebut ? `💕 Ensemble depuis le ${formaterDate(couple.dateDebut)}` : '💕 Ajouter la date de mise en couple'}
                </Text>
                <Ionicons name="pencil" size={13} color="#D4517E" />
              </TouchableOpacity>
            ) : (
              <View style={styles.dateDebutEditBox}>
                <DatePicker value={dateDebutIso} onChange={(iso) => { setDateDebutIso(iso); setDateDebutError('') }} />
                {dateDebutError ? <Text style={styles.msgError}>{dateDebutError}</Text> : null}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={[styles.btn, { flex: 1 }]} onPress={saveDateDebut} disabled={savingDateDebut}>
                    <Text style={styles.btnText}>{savingDateDebut ? '...' : 'Enregistrer'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.outlineBtn, { flex: 1 }]} onPress={() => { setEditingDateDebut(false); setDateDebutError('') }}>
                    <Text style={styles.outlineBtnText}>Annuler</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {coupleStats && (
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{coupleStats.myCount}</Text>
                  <Text style={styles.statLabel}>tes dates</Text>
                  {coupleStats.myCount > 0 && <Text style={styles.statMoy}>{coupleStats.myMoyenne.toFixed(1)}/20</Text>}
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{coupleStats.partnerCount}</Text>
                  <Text style={styles.statLabel}>dates de {couple.partnerUsername.split(' ')[0]}</Text>
                  {coupleStats.partnerCount > 0 && <Text style={styles.statMoy}>{coupleStats.partnerMoyenne.toFixed(1)}/20</Text>}
                </View>
              </View>
            )}
            {!confirmDisconnect ? (
              <TouchableOpacity style={styles.dangerBtn} onPress={() => setConfirmDisconnect(true)}>
                <Text style={styles.dangerBtnText}>Se déconnecter du couple</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.confirmBox}>
                <Text style={styles.confirmWarn}>Cela supprimera le lien entre vos comptes.</Text>
                <TouchableOpacity style={styles.confirmYes} onPress={disconnect} disabled={actioning}>
                  <Text style={styles.confirmYesText}>{actioning ? '...' : 'Oui, se déconnecter'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.outlineBtn} onPress={() => setConfirmDisconnect(false)}>
                  <Text style={styles.outlineBtnText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
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
  hero: { alignItems: 'center', paddingVertical: 24 },
  heroEmoji: { fontSize: 52, marginBottom: 12 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#D4517E', marginBottom: 8 },
  heroSub: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F0D9D9' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#5C4A45', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#5C4A45', marginBottom: 6 },
  dateDebutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 14 },
  dateDebutText: { fontSize: 13, color: '#D4517E', fontWeight: '600' },
  dateDebutEditBox: { marginBottom: 14, gap: 8 },
  input: { borderRadius: 10, borderWidth: 1, borderColor: '#F0D9D9', padding: 12, fontSize: 14, marginBottom: 8, backgroundColor: '#FFF8F5' },
  btn: { backgroundColor: '#D4517E', borderRadius: 10, padding: 13, alignItems: 'center', marginBottom: 8 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  outlineBtn: { borderRadius: 10, borderWidth: 1, borderColor: '#D0C5C0', padding: 12, alignItems: 'center', marginBottom: 4 },
  outlineBtnText: { color: '#888', fontSize: 14, fontWeight: '600' },
  dangerBtn: { borderRadius: 10, borderWidth: 1, borderColor: '#D85A30', padding: 12, alignItems: 'center' },
  dangerBtnText: { color: '#D85A30', fontWeight: '600', fontSize: 14 },
  msgError: { fontSize: 13, color: '#D85A30', marginBottom: 8 },
  partnerCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14, padding: 12, backgroundColor: '#FFF8F5', borderRadius: 12 },
  partnerAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F0D9D9' },
  partnerAvatarPlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FDE8F0', justifyContent: 'center', alignItems: 'center' },
  partnerAvatarInitial: { fontSize: 20, fontWeight: '700', color: '#D4517E' },
  partnerName: { fontSize: 15, fontWeight: '700', color: '#5C4A45' },
  partnerSub: { fontSize: 12, color: '#888', marginTop: 2 },
  coupleActiveHeader: { marginBottom: 12 },
  coupleActiveBadge: { fontSize: 14, fontWeight: '700', color: '#D4517E', backgroundColor: '#FDE8F0', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF8F5', borderRadius: 12, padding: 14, marginBottom: 14 },
  statCard: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: '#D4517E' },
  statLabel: { fontSize: 11, color: '#888', marginTop: 2, textAlign: 'center' },
  statMoy: { fontSize: 13, fontWeight: '600', color: '#D4517E', marginTop: 4 },
  statDivider: { width: 1, height: 48, backgroundColor: '#F0D9D9', marginHorizontal: 8 },
  confirmBox: { gap: 8 },
  confirmWarn: { fontSize: 13, color: '#D85A30', marginBottom: 4 },
  confirmYes: { backgroundColor: '#D85A30', borderRadius: 10, padding: 13, alignItems: 'center' },
  confirmYesText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})
