import { useEffect, useState, useRef } from 'react'
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator, TouchableOpacity, TextInput, Share, KeyboardAvoidingView, Platform, Animated, Linking } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { formaterDate, formatNote } from '../../lib/dateUtils'
import { webContentStyle } from '../../lib/webStyles'
import { PhotoViewer } from '../../lib/PhotoViewer'
import { getCategoryLabel } from '../../lib/categories'

const CRITERES = [
  { key: 'mood', label: 'Mood' },
  { key: 'nourriture', label: 'Nourriture' },
  { key: 'ambiance', label: 'Ambiance' },
  { key: 'personne', label: 'La personne' },
  { key: 'conversation', label: 'Conversation' },
  { key: 'prix', label: 'Prix / Valeur' },
  { key: 'envie_recommencer', label: 'Envie de recommencer' },
]

type DateDetail = {
  id: string
  intitule: string | null
  lieu: string
  date_du_date: string
  note_globale: number
  commentaire: string | null
  conseil_vivement: boolean
  user_id: string
  username: string
  photos: string[]
  ratings: Record<string, number> | null
  categorie: string | null
  visibilite: string
  participants: string[]
  participantIds: string[]
}

type DateComment = {
  id: string
  user_id: string
  username: string
  avatar_url: string | null
  content: string
  created_at: string
}

export default function DateDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [detail, setDetail] = useState<DateDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [myId, setMyId] = useState('')
  const [viewer, setViewer] = useState<{ photos: string[]; index: number } | null>(null)
  const [reactionCount, setReactionCount] = useState(0)
  const [myReaction, setMyReaction] = useState(false)
  const [comments, setComments] = useState<DateComment[]>([])
  const [commentText, setCommentText] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [commentError, setCommentError] = useState('')
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)
  const [confirmDeleteCommentId, setConfirmDeleteCommentId] = useState<string | null>(null)
  const [partnerId, setPartnerId] = useState<string | null>(null)
  const [partnerRating, setPartnerRating] = useState<{ note_globale: number; commentaire: string | null; username: string } | null>(null)
  const [myPartnerNote, setMyPartnerNote] = useState<{ note_globale: number; commentaire: string } | null>(null)
  const [editingPartnerNote, setEditingPartnerNote] = useState(false)
  const [partnerNoteInput, setPartnerNoteInput] = useState(10)
  const [partnerCommentInput, setPartnerCommentInput] = useState('')
  const [savingPartnerNote, setSavingPartnerNote] = useState(false)
  const myIdRef = useRef('')
  const heartAnim = useRef(new Animated.Value(1)).current
  const router = useRouter()
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    if (!id) return
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setMyId(user.id)
        myIdRef.current = user.id
        loadPartnerContext(id, user.id)
      }
    })
    loadDetail(id)
    loadComments(id)
    loadReactions(id)
  }, [id])

  async function loadPartnerContext(dateId: string, userId: string) {
    const { data: coupleRow } = await supabase
      .from('couples')
      .select('user1_id, user2_id')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .eq('status', 'accepted')
      .maybeSingle()

    if (!coupleRow) return
    const pid = coupleRow.user1_id === userId ? coupleRow.user2_id : coupleRow.user1_id
    setPartnerId(pid)

    const { data: prData } = await supabase
      .from('date_partner_ratings')
      .select('note_globale, commentaire, partner_id')
      .eq('date_id', dateId)
      .maybeSingle()

    if (!prData) return

    if (prData.partner_id === userId) {
      setMyPartnerNote({ note_globale: prData.note_globale, commentaire: prData.commentaire ?? '' })
      setPartnerNoteInput(prData.note_globale)
      setPartnerCommentInput(prData.commentaire ?? '')
    } else {
      const { data: partnerProfile } = await supabase.from('profiles').select('username').eq('id', prData.partner_id).single()
      setPartnerRating({ note_globale: prData.note_globale, commentaire: prData.commentaire ?? null, username: (partnerProfile as any)?.username ?? '?' })
    }
  }

  async function savePartnerNote() {
    if (!id || !myIdRef.current) return
    setSavingPartnerNote(true)
    await supabase.from('date_partner_ratings').upsert(
      { date_id: id, partner_id: myIdRef.current, note_globale: partnerNoteInput, commentaire: partnerCommentInput.trim() || null },
      { onConflict: 'date_id,partner_id' }
    )
    setMyPartnerNote({ note_globale: partnerNoteInput, commentaire: partnerCommentInput.trim() })
    setEditingPartnerNote(false)
    setSavingPartnerNote(false)
  }

  async function loadReactions(dateId: string) {
    const { data } = await supabase
      .from('date_reactions')
      .select('user_id')
      .eq('date_id', dateId)
    const userId = myIdRef.current || (await supabase.auth.getUser()).data.user?.id || ''
    setReactionCount(data?.length ?? 0)
    setMyReaction((data ?? []).some((r: any) => r.user_id === userId))
  }

  async function toggleReaction() {
    const userId = myIdRef.current
    if (!userId || !id) return

    const wasReacted = myReaction
    setMyReaction(!wasReacted)
    setReactionCount((c) => wasReacted ? c - 1 : c + 1)

    Animated.sequence([
      Animated.timing(heartAnim, { toValue: 1.3, duration: 120, useNativeDriver: true }),
      Animated.timing(heartAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start()

    if (wasReacted) {
      await supabase.from('date_reactions').delete().eq('date_id', id).eq('user_id', userId)
    } else {
      await supabase.from('date_reactions').insert({ date_id: id, user_id: userId })
    }
  }

  async function loadDetail(dateId: string) {
    setLoading(true)
    const [{ data: dateData }, { data: ratingsData }, { data: participantsData }] = await Promise.all([
      supabase
        .from('dates')
        .select('id, intitule, lieu, date_du_date, note_globale, commentaire, conseil_vivement, user_id, categorie, visibilite, profiles(username), date_photos(photo_url, ordre)')
        .eq('id', dateId)
        .single(),
      supabase
        .from('ratings')
        .select('mood, nourriture, ambiance, personne, conversation, prix, envie_recommencer')
        .eq('date_id', dateId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('date_participants')
        .select('user_id, profiles(username)')
        .eq('date_id', dateId),
    ])

    if (dateData) {
      setDetail({
        id: dateData.id,
        intitule: (dateData as any).intitule ?? null,
        lieu: dateData.lieu,
        date_du_date: dateData.date_du_date,
        note_globale: dateData.note_globale,
        commentaire: dateData.commentaire,
        conseil_vivement: dateData.conseil_vivement ?? false,
        user_id: dateData.user_id,
        username: (dateData as any).profiles?.username ?? 'Quelqu\'un',
        categorie: (dateData as any).categorie ?? null,
        visibilite: (dateData as any).visibilite ?? 'friends',
        photos: ((dateData as any).date_photos ?? [])
          .sort((a: any, b: any) => a.ordre - b.ordre)
          .map((p: any) => p.photo_url),
        ratings: ratingsData ?? null,
        participants: (participantsData ?? []).map((p: any) => p.profiles?.username).filter(Boolean),
        participantIds: (participantsData ?? []).map((p: any) => p.user_id),
      })
    }
    setLoading(false)
  }

  async function loadComments(dateId: string) {
    const { data } = await supabase
      .from('date_comments')
      .select('id, user_id, content, created_at')
      .eq('date_id', dateId)
      .order('created_at', { ascending: true })

    if (!data || data.length === 0) {
      setComments([])
      return
    }

    const userIds = [...new Set(data.map((c: any) => c.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds)

    const profileMap: Record<string, { username: string; avatar_url: string | null }> = {}
    for (const p of profiles ?? []) {
      profileMap[p.id] = { username: p.username, avatar_url: p.avatar_url ?? null }
    }

    setComments(data.map((c: any) => ({
      id: c.id,
      user_id: c.user_id,
      username: profileMap[c.user_id]?.username ?? 'Quelqu\'un',
      avatar_url: profileMap[c.user_id]?.avatar_url ?? null,
      content: c.content,
      created_at: c.created_at,
    })))
  }

  async function sendComment() {
    if (!commentText.trim() || !id) return
    setCommentError('')

    let userId = myIdRef.current
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setCommentError('Non connecté'); return }
      userId = user.id
      setMyId(userId)
      myIdRef.current = userId
    }

    setSendingComment(true)
    const { error } = await supabase.from('date_comments').insert({
      date_id: id,
      user_id: userId,
      content: commentText.trim(),
    })
    setSendingComment(false)

    if (error) {
      setCommentError(`Erreur : ${error.message}`)
      return
    }

    setCommentText('')
    await loadComments(id)
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)

    // Notifier le propriétaire du date
    if (detail && detail.user_id !== userId) {
      const { data: { session } } = await supabase.auth.getSession()
      const { data: me } = await supabase.from('profiles').select('username').eq('id', userId).single()
      if (session && me) {
        fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/notify-comment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            date_owner_id: detail.user_id,
            commenter_username: me.username,
            date_intitule: detail.intitule ?? detail.lieu,
            comment_preview: commentText.trim().slice(0, 80),
          }),
        })
      }
    }
  }

  async function deleteComment(commentId: string) {
    setConfirmDeleteCommentId(null)
    setDeletingCommentId(commentId)
    await supabase.from('date_comments').delete().eq('id', commentId).eq('user_id', myId)
    setDeletingCommentId(null)
    if (id) await loadComments(id)
  }

  async function handleShare() {
    if (!detail) return
    const title = detail.intitule ?? detail.lieu
    const text = `${title} — ${detail.note_globale}/20 sur Dateo ✨\n📍 ${detail.lieu} · ${formaterDate(detail.date_du_date)}`
    await Share.share({ message: text, title: 'Dateo' })
  }

  function renderBar(value: number, max: number) {
    const pct = Math.min(value / max, 1)
    return (
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { flex: pct }]} />
        {pct < 1 && <View style={{ flex: 1 - pct }} />}
      </View>
    )
  }

  function formatCommentTime(iso: string) {
    const d = new Date(iso)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
    if (diff < 60) return 'à l\'instant'
    if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
    if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`
    return formaterDate(d.toISOString().slice(0, 10))
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color="#D4517E" />
          <Text style={styles.back}>Retour</Text>
        </TouchableOpacity>
        {detail && (
          <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
            <Text style={styles.shareText}>Partager</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color="#D4517E" style={{ marginTop: 60 }} size="large" />
      ) : !detail ? (
        <Text style={styles.error}>Date introuvable</Text>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
          <ScrollView ref={scrollRef} contentContainerStyle={[styles.content, webContentStyle]}>
            {detail.conseil_vivement && (
              <View style={styles.conseilBanner}>
                <Text style={styles.conseilBannerText}>💖 Conseillé vivement</Text>
              </View>
            )}

            {detail.intitule ? (
              <>
                <View style={styles.lieuRow}>
                  <Text style={styles.lieu}>{detail.intitule}</Text>
                  {detail.visibilite === 'private' && <Ionicons name="lock-closed" size={16} color="#B8A9A0" style={{ marginTop: 4 }} />}
                </View>
                <Text style={styles.lieuAddress}>📍 {detail.lieu}</Text>
              </>
            ) : (
              <View style={styles.lieuRow}>
                <Text style={styles.lieu}>{detail.lieu}</Text>
                {detail.visibilite === 'private' && <Ionicons name="lock-closed" size={16} color="#B8A9A0" style={{ marginTop: 4 }} />}
              </View>
            )}
            <TouchableOpacity
              onPress={() =>
                detail.user_id === myId
                  ? router.push('/(tabs)/profile')
                  : router.push(`/user/${detail.user_id}`)
              }
              activeOpacity={0.7}
            >
              <Text style={styles.metaUsername}>@{detail.username}</Text>
            </TouchableOpacity>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>{formaterDate(detail.date_du_date)}</Text>
              {detail.categorie && (
                <View style={styles.catBadge}>
                  <Text style={styles.catBadgeText}>{getCategoryLabel(detail.categorie)}</Text>
                </View>
              )}
              <TouchableOpacity
                onPress={() => {
                  const q = encodeURIComponent(detail.lieu)
                  Linking.openURL(Platform.OS === 'ios' ? `maps:?q=${q}` : `https://maps.google.com/?q=${q}`)
                }}
                style={styles.mapBtn}
              >
                <Ionicons name="map-outline" size={14} color="#D4517E" />
                <Text style={styles.mapBtnText}>Carte</Text>
              </TouchableOpacity>
            </View>

            {detail.participants.length > 0 && (
              <Text style={styles.participants}>👥 Avec {detail.participants.map((u) => `@${u}`).join(', ')}</Text>
            )}

            <View style={styles.noteGlobaleBox}>
              <Text style={styles.noteGlobaleLabel}>Note globale</Text>
              <Text style={styles.noteGlobaleValue}>{detail.note_globale}<Text style={styles.noteGlobaleSuffix}>/20</Text></Text>
              {renderBar(detail.note_globale, 20)}
            </View>

            {/* Note du partenaire (uniquement si j'ai participé à ce date précis) */}
            {detail.user_id !== myId && partnerId && detail.user_id === partnerId && detail.participantIds.includes(myId) && (
              <View style={styles.partnerRatingBox}>
                <Text style={styles.partnerRatingTitle}>Mon avis sur ce date</Text>
                {myPartnerNote && !editingPartnerNote ? (
                  <>
                    <Text style={styles.partnerNoteValue}>{myPartnerNote.note_globale}/20</Text>
                    {myPartnerNote.commentaire ? <Text style={styles.partnerNoteComment}>{myPartnerNote.commentaire}</Text> : null}
                    <TouchableOpacity onPress={() => setEditingPartnerNote(true)} style={styles.partnerEditBtn}>
                      <Text style={styles.partnerEditBtnText}>Modifier</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <View style={styles.notePickerRow}>
                      {Array.from({ length: 21 }, (_, i) => i).filter((n) => n % 2 === 0 || n === 1 || n === 19 || n === 20).map((n) => (
                        <TouchableOpacity
                          key={n}
                          style={[styles.notePill, partnerNoteInput === n && styles.notePillActive]}
                          onPress={() => setPartnerNoteInput(n)}
                        >
                          <Text style={[styles.notePillText, partnerNoteInput === n && styles.notePillTextActive]}>{n}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TextInput
                      style={styles.partnerCommentInput}
                      value={partnerCommentInput}
                      onChangeText={setPartnerCommentInput}
                      placeholder="Mon commentaire (optionnel)..."
                      placeholderTextColor="#B8A9A0"
                      multiline
                    />
                    <View style={styles.partnerBtnRow}>
                      {editingPartnerNote && (
                        <TouchableOpacity onPress={() => setEditingPartnerNote(false)} style={styles.partnerCancelBtn}>
                          <Text style={styles.partnerCancelBtnText}>Annuler</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={savePartnerNote} disabled={savingPartnerNote} style={styles.partnerSaveBtn}>
                        <Text style={styles.partnerSaveBtnText}>{savingPartnerNote ? '...' : myPartnerNote ? 'Modifier' : 'Enregistrer'}</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* Note de mon partenaire sur mon propre date */}
            {detail.user_id === myId && partnerRating && (
              <View style={styles.partnerRatingBox}>
                <Text style={styles.partnerRatingTitle}>Note de @{partnerRating.username}</Text>
                <Text style={styles.partnerNoteValue}>{partnerRating.note_globale}/20</Text>
                {partnerRating.commentaire && <Text style={styles.partnerNoteComment}>{partnerRating.commentaire}</Text>}
              </View>
            )}

            {detail.photos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
                {detail.photos.map((url, idx) => (
                  <TouchableOpacity key={idx} onPress={() => setViewer({ photos: detail.photos, index: idx })} activeOpacity={0.9}>
                    <Image source={{ uri: url }} style={styles.photo} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {detail.commentaire ? (
              <View style={styles.commentBox}>
                <Text style={styles.commentLabel}>Commentaire</Text>
                <Text style={styles.comment}>{detail.commentaire}</Text>
              </View>
            ) : null}

            {detail.ratings && (
              <View style={styles.ratingsSection}>
                <Text style={styles.ratingsTitle}>Détails</Text>
                {CRITERES.map((c) => {
                  const val = detail.ratings![c.key] ?? 0
                  return (
                    <View key={c.key} style={styles.critereRow}>
                      <View style={styles.critereLeft}>
                        <Text style={styles.critereLabel}>{c.label}</Text>
                        {renderBar(val, 5)}
                      </View>
                      <Text style={styles.critereValue}>{formatNote(val)}/5</Text>
                    </View>
                  )
                })}
              </View>
            )}

            {/* Likes */}
            <TouchableOpacity style={styles.likesRow} onPress={toggleReaction} activeOpacity={0.7}>
              <Animated.View style={{ transform: [{ scale: heartAnim }] }}>
                <Ionicons
                  name={myReaction ? 'heart' : 'heart-outline'}
                  size={26}
                  color={myReaction ? '#D4517E' : '#B8A9A0'}
                />
              </Animated.View>
              <Text style={[styles.likesCount, myReaction && styles.likesCountActive]}>
                {reactionCount > 0 ? reactionCount : ''} {reactionCount === 1 ? 'j\'aime' : reactionCount > 1 ? 'j\'aimes' : 'Aimer'}
              </Text>
            </TouchableOpacity>

            {/* Commentaires */}
            <View style={styles.commentsSection}>
              <Text style={styles.commentsTitle}>
                Commentaires {comments.length > 0 ? `(${comments.length})` : ''}
              </Text>

              {comments.length === 0 && (
                <Text style={styles.commentsEmpty}>Aucun commentaire pour l'instant</Text>
              )}

              {comments.map((c) => (
                <View key={c.id} style={styles.commentCard}>
                  <View style={styles.commentCardHeader}>
                    {c.avatar_url ? (
                      <Image source={{ uri: c.avatar_url }} style={styles.commentAvatar} />
                    ) : (
                      <View style={styles.commentAvatarPlaceholder}>
                        <Text style={styles.commentAvatarInitial}>{c.username.charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.commentUsername}>@{c.username}</Text>
                      <Text style={styles.commentTime}>{formatCommentTime(c.created_at)}</Text>
                    </View>
                    {c.user_id === myId && confirmDeleteCommentId !== c.id && (
                      <TouchableOpacity
                        onPress={() => setConfirmDeleteCommentId(c.id)}
                        disabled={deletingCommentId === c.id}
                      >
                        <Text style={styles.commentDelete}>{deletingCommentId === c.id ? '...' : '×'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.commentContent}>{c.content}</Text>
                  {confirmDeleteCommentId === c.id && (
                    <View style={styles.commentConfirmRow}>
                      <Text style={styles.commentConfirmText}>Supprimer ce commentaire ?</Text>
                      <TouchableOpacity onPress={() => deleteComment(c.id)}>
                        <Text style={styles.commentConfirmYes}>Oui</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setConfirmDeleteCommentId(null)}>
                        <Text style={styles.commentConfirmNo}>Non</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}

              {commentError ? <Text style={styles.commentErrText}>{commentError}</Text> : null}

              <View style={styles.commentInputRow}>
                <TextInput
                  style={styles.commentInput}
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder="Ajoute un commentaire..."
                  placeholderTextColor="#B8A9A0"
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity
                  style={[styles.commentSendBtn, !commentText.trim() && styles.commentSendBtnDisabled]}
                  onPress={sendComment}
                  disabled={sendingComment || !commentText.trim()}
                >
                  <Text style={styles.commentSendText}>{sendingComment ? '...' : '↑'}</Text>
                </TouchableOpacity>
              </View>
              {commentText.length > 400 && (
                <Text style={styles.commentCharCount}>{commentText.length}/500</Text>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  back: { color: '#D4517E', fontSize: 16, fontWeight: '500' },
  shareBtn: { padding: 4 },
  shareText: { color: '#D4517E', fontSize: 14, fontWeight: '600' },
  content: { padding: 20, paddingBottom: 60 },
  error: { color: '#888', textAlign: 'center', marginTop: 60 },
  conseilBanner: { backgroundColor: '#FDE8F0', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, alignSelf: 'flex-start', marginBottom: 16 },
  conseilBannerText: { fontSize: 13, fontWeight: '700', color: '#D4517E' },
  lieuRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lieu: { fontSize: 26, fontWeight: '700', color: '#5C4A45', marginBottom: 4 },
  lieuAddress: { fontSize: 14, color: '#888', marginBottom: 6 },
  metaUsername: { fontSize: 14, fontWeight: '600', color: '#D4517E', marginBottom: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  meta: { fontSize: 13, color: '#888' },
  catBadge: { backgroundColor: '#FDE8F0', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  catBadgeText: { fontSize: 12, color: '#D4517E', fontWeight: '600' },
  participants: { fontSize: 13, color: '#5C4A45', marginTop: -12, marginBottom: 20 },
  noteGlobaleBox: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#F0D9D9', alignItems: 'center' },
  noteGlobaleLabel: { fontSize: 13, color: '#888', marginBottom: 4 },
  noteGlobaleValue: { fontSize: 52, fontWeight: '800', color: '#D4517E', lineHeight: 60 },
  noteGlobaleSuffix: { fontSize: 22, fontWeight: '500', color: '#B8A9A0' },
  photoRow: { marginBottom: 20, minWidth: 0 },
  photo: { width: 240, height: 240, borderRadius: 14, marginRight: 12, backgroundColor: '#F0D9D9' },
  commentBox: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#F0D9D9' },
  commentLabel: { fontSize: 12, color: '#888', fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  comment: { fontSize: 15, color: '#5C4A45', lineHeight: 22 },
  ratingsSection: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F0D9D9', marginBottom: 20 },
  ratingsTitle: { fontSize: 14, fontWeight: '700', color: '#5C4A45', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  critereRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  critereLeft: { flex: 1, marginRight: 12 },
  critereLabel: { fontSize: 13, color: '#5C4A45', fontWeight: '500', marginBottom: 5 },
  barTrack: { flexDirection: 'row', height: 6, backgroundColor: '#F0D9D9', borderRadius: 3, overflow: 'hidden' },
  barFill: { backgroundColor: '#D4517E', borderRadius: 3 },
  critereValue: { fontSize: 13, fontWeight: '700', color: '#D4517E', width: 32, textAlign: 'right' },
  likesRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F0D9D9' },
  likesCount: { fontSize: 15, fontWeight: '600', color: '#B8A9A0' },
  likesCountActive: { color: '#D4517E' },
  commentsSection: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F0D9D9' },
  commentsTitle: { fontSize: 14, fontWeight: '700', color: '#5C4A45', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  commentsEmpty: { fontSize: 13, color: '#B8A9A0', marginBottom: 12 },
  commentCard: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F0D9D9' },
  commentCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  commentAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F0D9D9' },
  commentAvatarPlaceholder: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FDE8F0', justifyContent: 'center', alignItems: 'center' },
  commentAvatarInitial: { fontSize: 13, fontWeight: '700', color: '#D4517E' },
  commentUsername: { fontSize: 13, fontWeight: '600', color: '#D4517E' },
  commentTime: { fontSize: 11, color: '#B8A9A0' },
  commentDelete: { fontSize: 18, color: '#B8A9A0', paddingHorizontal: 4 },
  commentContent: { fontSize: 14, color: '#5C4A45', lineHeight: 20, marginLeft: 38 },
  commentConfirmRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 38, marginTop: 6 },
  commentConfirmText: { fontSize: 12, color: '#888', flex: 1 },
  commentConfirmYes: { fontSize: 13, fontWeight: '700', color: '#D85A30' },
  commentConfirmNo: { fontSize: 13, fontWeight: '600', color: '#5C4A45' },
  commentInputRow: { flexDirection: 'row', gap: 8, marginTop: 4, alignItems: 'flex-end' },
  commentCharCount: { fontSize: 11, color: '#B8A9A0', textAlign: 'right', marginTop: 2 },
  commentInput: { flex: 1, backgroundColor: '#FFF8F5', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#F0D9D9', fontSize: 14, maxHeight: 100 },
  commentSendBtn: { backgroundColor: '#D4517E', width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  commentSendBtnDisabled: { backgroundColor: '#F0D9D9' },
  commentSendText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  commentErrText: { fontSize: 13, color: '#D85A30', marginBottom: 8 },
  mapBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#FDE8F0', borderRadius: 8 },
  mapBtnText: { fontSize: 12, color: '#D4517E', fontWeight: '600' },
  partnerRatingBox: { backgroundColor: '#FFF4F7', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#F4C0D1' },
  partnerRatingTitle: { fontSize: 13, fontWeight: '700', color: '#D4517E', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  partnerNoteValue: { fontSize: 32, fontWeight: '800', color: '#D4517E', marginBottom: 4 },
  partnerNoteComment: { fontSize: 14, color: '#5C4A45', lineHeight: 20, marginBottom: 8 },
  partnerEditBtn: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#D4517E' },
  partnerEditBtnText: { fontSize: 13, color: '#D4517E', fontWeight: '600' },
  notePickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  notePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#F0D9D9' },
  notePillActive: { backgroundColor: '#D4517E', borderColor: '#D4517E' },
  notePillText: { fontSize: 13, color: '#5C4A45', fontWeight: '600' },
  notePillTextActive: { color: '#fff' },
  partnerCommentInput: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#F0D9D9', padding: 10, fontSize: 14, marginBottom: 10, minHeight: 60, textAlignVertical: 'top' },
  partnerBtnRow: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  partnerCancelBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#D0C5C0' },
  partnerCancelBtnText: { color: '#888', fontSize: 14 },
  partnerSaveBtn: { backgroundColor: '#D4517E', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10 },
  partnerSaveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})
