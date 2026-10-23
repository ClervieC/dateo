import { useEffect, useState, useRef } from 'react'
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator, TouchableOpacity, TextInput, Share, KeyboardAvoidingView, Platform, Animated, Linking } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { formaterDate, formatNote, formaterIlYa } from '../../lib/dateUtils'
import { ScreenHeader } from '../../lib/ScreenHeader'
import { CRITERES } from '../../lib/criteres'
import { LikeButton } from '../../lib/LikeButton'
import { webContentStyle } from '../../lib/webStyles'
import { PhotoViewer } from '../../lib/PhotoViewer'
import { getCategoryLabel } from '../../lib/categories'
import { t } from '../../lib/i18n'
import { C, themedStyles } from '../../lib/theme'


type DateDetail = {
  id: string
  intitule: string | null
  lieu: string
  date_du_date: string
  note_globale: number | null
  statut: string
  commentaire: string | null
  conseil_vivement: boolean
  user_id: string
  username: string
  photos: string[]
  ratings: Record<string, number | null> | null
  categorie: string | null
  visibilite: string
  participants: { id: string; username: string }[]
}

type DateComment = {
  id: string
  user_id: string
  username: string
  avatar_url: string | null
  content: string
  created_at: string
  parent_id: string | null
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
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionSuggestions, setMentionSuggestions] = useState<{ id: string; username: string }[]>([])
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [partnerId, setPartnerId] = useState<string | null>(null)
  const [partnerRating, setPartnerRating] = useState<{ note_globale: number; commentaire: string | null; username: string } | null>(null)
  const [myPartnerNote, setMyPartnerNote] = useState<{ note_globale: number; commentaire: string } | null>(null)
  const [editingPartnerNote, setEditingPartnerNote] = useState(false)
  const [partnerNoteInput, setPartnerNoteInput] = useState(10)
  const [partnerCommentInput, setPartnerCommentInput] = useState('')
  const [savingPartnerNote, setSavingPartnerNote] = useState(false)
  const myIdRef = useRef('')
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


    if (wasReacted) {
      await supabase.from('date_reactions').delete().eq('date_id', id).eq('user_id', userId)
    } else {
      await supabase.from('date_reactions').insert({ date_id: id, user_id: userId })
      const { data: { session } } = await supabase.auth.getSession()
      if (session && detail && detail.user_id !== userId) {
        fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/notify-reaction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ date_id: id }),
        })
      }
    }
  }

  async function loadDetail(dateId: string) {
    setLoading(true)
    const [{ data: dateData }, { data: ratingsData }, { data: participantsData }] = await Promise.all([
      supabase
        .from('dates')
        .select('id, intitule, lieu, date_du_date, note_globale, statut, commentaire, conseil_vivement, user_id, categorie, visibilite, profiles(username), date_photos(photo_url, ordre)')
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
        statut: (dateData as any).statut ?? 'vecu',
        commentaire: dateData.commentaire,
        conseil_vivement: dateData.conseil_vivement ?? false,
        user_id: dateData.user_id,
        username: (dateData as any).profiles?.username ?? t("Quelqu'un"),
        categorie: (dateData as any).categorie ?? null,
        visibilite: (dateData as any).visibilite ?? 'friends',
        photos: ((dateData as any).date_photos ?? [])
          .sort((a: any, b: any) => a.ordre - b.ordre)
          .map((p: any) => p.photo_url),
        ratings: ratingsData ?? null,
        participants: (participantsData ?? [])
          .filter((p: any) => p.profiles?.username)
          .map((p: any) => ({ id: p.user_id, username: p.profiles.username })),
      })
    }
    setLoading(false)
  }

  async function loadComments(dateId: string) {
    const { data } = await supabase
      .from('date_comments')
      .select('id, user_id, content, created_at, parent_id')
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
      username: profileMap[c.user_id]?.username ?? t("Quelqu'un"),
      avatar_url: profileMap[c.user_id]?.avatar_url ?? null,
      content: c.content,
      created_at: c.created_at,
      parent_id: c.parent_id ?? null,
    })))
  }

  function handleCommentTextChange(text: string) {
    setCommentText(text)
    const match = text.match(/(?:^|\s)@(\w{1,30})$/)
    if (match) {
      setMentionQuery(match[1])
    } else {
      setMentionQuery(null)
      setMentionSuggestions([])
    }
  }

  useEffect(() => {
    if (mentionQuery === null) return
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, username')
        .ilike('username', `${mentionQuery}%`)
        .limit(5)
      setMentionSuggestions((data ?? []).filter((p) => p.username))
    }, 200)
    return () => clearTimeout(timeout)
  }, [mentionQuery])

  function selectMention(username: string) {
    setCommentText((prev) => prev.replace(/(?:^|\s)@(\w{1,30})$/, (m) => (m.startsWith(' ') ? ' ' : '') + `@${username} `))
    setMentionQuery(null)
    setMentionSuggestions([])
  }

  async function navigateToMention(username: string) {
    const { data } = await supabase.from('profiles').select('id').eq('username', username).single()
    if (data) {
      if (data.id === myId) router.push('/(tabs)/profile')
      else router.push(`/user/${data.id}`)
    }
  }

  function renderCommentContent(content: string) {
    const parts = content.split(/(@\w{1,30})/g)
    return (
      <Text style={styles.commentContent}>
        {parts.map((part, idx) =>
          part.startsWith('@') ? (
            <Text key={idx} style={styles.commentMention} onPress={() => navigateToMention(part.slice(1))}>
              {part}
            </Text>
          ) : (
            <Text key={idx}>{part}</Text>
          )
        )}
      </Text>
    )
  }

  function renderCommentCard(c: DateComment, isReply = false) {
    return (
      <View style={[styles.commentCard, isReply && styles.commentCardReply]}>
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
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel={t("Supprimer le commentaire")}
            >
              <Text style={styles.commentDelete}>{deletingCommentId === c.id ? '...' : '×'}</Text>
            </TouchableOpacity>
          )}
        </View>
        {renderCommentContent(c.content)}
        <TouchableOpacity
          onPress={() => {
            if (replyingTo === c.id) {
              setReplyingTo(null)
            } else {
              setReplyingTo(c.id)
              setReplyText(`@${c.username} `)
            }
          }}
        >
          <Text style={styles.commentReplyBtn}>{replyingTo === c.id ? t("Annuler") : t("Répondre")}</Text>
        </TouchableOpacity>
        {confirmDeleteCommentId === c.id && (
          <View style={styles.commentConfirmRow}>
            <Text style={styles.commentConfirmText}>{t("Supprimer ce commentaire ?")}</Text>
            <TouchableOpacity onPress={() => deleteComment(c.id)}>
              <Text style={styles.commentConfirmYes}>{t("Oui")}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setConfirmDeleteCommentId(null)}>
              <Text style={styles.commentConfirmNo}>{t("Non")}</Text>
            </TouchableOpacity>
          </View>
        )}
        {replyingTo === c.id && (
          <View style={styles.replyInputRow}>
            <TextInput
              style={styles.replyInput}
              value={replyText}
              onChangeText={setReplyText}
              placeholder={t("Répondre à @{username}...", { username: c.username })}
              placeholderTextColor={C.faint}
              multiline
              maxLength={500}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.replySendBtn, !replyText.trim() && styles.commentSendBtnDisabled]}
              onPress={() => sendComment(replyText, c.id)}
              disabled={sendingReply || !replyText.trim()}
            >
              {sendingReply ? <ActivityIndicator size="small" color={C.onPrimary} /> : <Ionicons name="arrow-up" size={18} color={C.onPrimary} />}
            </TouchableOpacity>
          </View>
        )}
      </View>
    )
  }

  async function sendComment(overrideText?: string, parentId: string | null = null) {
    const text = (overrideText ?? commentText).trim()
    if (!text || !id) return
    setCommentError('')

    let userId = myIdRef.current
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setCommentError(t("Non connecté")); return }
      userId = user.id
      setMyId(userId)
      myIdRef.current = userId
    }

    if (parentId) setSendingReply(true)
    else setSendingComment(true)
    const { data: inserted, error } = await supabase.from('date_comments').insert({
      date_id: id,
      user_id: userId,
      content: text,
      parent_id: parentId,
    }).select('id').single()
    if (parentId) setSendingReply(false)
    else setSendingComment(false)

    if (error) {
      setCommentError(t("Ton commentaire n'a pas pu être envoyé. Réessaie."))
      return
    }

    if (parentId) {
      setReplyingTo(null)
      setReplyText('')
    } else {
      setCommentText('')
    }
    await loadComments(id)
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)

    // La edge function relit le commentaire en base pour vérifier son auteur et
    // dériver elle-même les destinataires (propriétaire, réponse, mentions) et le
    // texte des notifications : le client n'envoie que l'id du commentaire créé.
    const { data: { session } } = await supabase.auth.getSession()
    if (session && inserted) {
      fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/notify-comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ comment_id: inserted.id }),
      })
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
    const note = detail.note_globale != null ? ` — ${formatNote(detail.note_globale)}/20` : ''
    const text = `${title}${note} ${t("sur Dateo ✨")}\n📍 ${detail.lieu} · ${formaterDate(detail.date_du_date)}`
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

  const formatCommentTime = formaterIlYa

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader
        fallback="/(tabs)/feed"
        bordered={false}
        right={detail ? (
          <TouchableOpacity onPress={handleShare} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel={t("Partager")}>
            <Ionicons name="share-outline" size={22} color={C.primary} />
          </TouchableOpacity>
        ) : null}
      />

      {loading ? (
        <ActivityIndicator color={C.primary} style={{ marginTop: 60 }} size="large" />
      ) : !detail ? (
        <View style={styles.notFound}>
          <Text style={styles.notFoundIcon}>🔍</Text>
          <Text style={styles.notFoundTitle}>{t("Date introuvable")}</Text>
          <Text style={styles.notFoundSub}>{t("Il a peut-être été supprimé, ou il n'est plus visible pour toi.")}</Text>
          <TouchableOpacity style={styles.notFoundBtn} onPress={() => router.replace('/(tabs)/feed')}>
            <Text style={styles.notFoundBtnText}>{t("Retour au feed")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
          <ScrollView ref={scrollRef} contentContainerStyle={[styles.content, webContentStyle]}>
            {detail.conseil_vivement && (
              <View style={styles.conseilBanner}>
                <Ionicons name="heart" size={13} color={C.primaryText} />
                <Text style={styles.conseilBannerText}>{t("Conseillé vivement")}</Text>
              </View>
            )}

            {detail.intitule ? (
              <>
                <View style={styles.lieuRow}>
                  <Text style={styles.lieu}>{detail.intitule}</Text>
                  {detail.visibilite === 'private' && <Ionicons name="lock-closed" size={16} color={C.faint} style={{ marginTop: 4 }} />}
                </View>
                <View style={styles.iconLine}>
                  <Ionicons name="location-outline" size={14} color={C.muted} />
                  <Text style={styles.lieuAddress}>{detail.lieu}</Text>
                </View>
              </>
            ) : (
              <View style={styles.lieuRow}>
                <Text style={styles.lieu}>{detail.lieu}</Text>
                {detail.visibilite === 'private' && <Ionicons name="lock-closed" size={16} color={C.faint} style={{ marginTop: 4 }} />}
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
                <Ionicons name="map-outline" size={14} color={C.primary} />
                <Text style={styles.mapBtnText}>{t("Carte")}</Text>
              </TouchableOpacity>
            </View>

            {detail.participants.length > 0 && (
              <View style={styles.participantsRow}>
                <Ionicons name="people-outline" size={14} color={C.text} />
                <Text style={styles.participantsLabel}>{t("Avec")}</Text>
                {detail.participants.map((p, idx) => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => p.id === myId ? router.push('/(tabs)/profile') : router.push(`/user/${p.id}`)}
                  >
                    <Text style={styles.participantLink}>
                      @{p.username}{idx < detail.participants.length - 1 ? ',' : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {detail.statut === 'planifie' || detail.note_globale == null ? (
              <View style={styles.planifieBox}>
                <Ionicons name="calendar" size={22} color={C.primaryText} />
                <Text style={styles.planifieTitle}>{t("Date à venir")}</Text>
                <Text style={styles.planifieSub}>
                  {detail.user_id === myId ? t("Tu pourras le noter une fois passé.") : t("Pas encore noté.")}
                </Text>
                {detail.user_id === myId && (
                  <TouchableOpacity
                    style={styles.planifieBtn}
                    onPress={() => router.push({ pathname: '/(tabs)/rate', params: { planifieId: detail.id } } as any)}
                  >
                    <Text style={styles.planifieBtnText}>{t("Noter ce date")}</Text>
                  </TouchableOpacity>
                )}
                {detail.user_id === myId && (
                  <TouchableOpacity
                    style={styles.planifieLink}
                    onPress={() => router.push({
                      pathname: '/conversation',
                      params: {
                        contexte: [detail.intitule, detail.lieu].filter(Boolean).join(' — '),
                        ...(partnerId && detail.participants.some((p) => p.id === partnerId) ? { stage: 'couple' } : {}),
                      },
                    } as any)}
                  >
                    <Ionicons name="chatbubbles-outline" size={15} color={C.primary} />
                    <Text style={styles.planifieLinkText}>{t("Préparer des sujets de conversation")}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.noteGlobaleBox}>
                <Text style={styles.noteGlobaleLabel}>{t("Note globale")}</Text>
                <Text style={styles.noteGlobaleValue}>{formatNote(detail.note_globale)}<Text style={styles.noteGlobaleSuffix}>/20</Text></Text>
                {renderBar(detail.note_globale, 20)}
              </View>
            )}

            {/* Note du partenaire (uniquement si j'ai participé à ce date précis) */}
            {detail.user_id !== myId && partnerId && detail.user_id === partnerId && detail.participants.some((p) => p.id === myId) && (
              <View style={styles.partnerRatingBox}>
                <Text style={styles.partnerRatingTitle}>{t("Mon avis sur ce date")}</Text>
                {myPartnerNote && !editingPartnerNote ? (
                  <>
                    <Text style={styles.partnerNoteValue}>{formatNote(myPartnerNote.note_globale)}/20</Text>
                    {myPartnerNote.commentaire ? <Text style={styles.partnerNoteComment}>{myPartnerNote.commentaire}</Text> : null}
                    <TouchableOpacity onPress={() => setEditingPartnerNote(true)} style={styles.partnerEditBtn}>
                      <Text style={styles.partnerEditBtnText}>{t("Modifier")}</Text>
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
                      placeholder={t("Mon commentaire (optionnel)...")}
                      placeholderTextColor={C.faint}
                      multiline
                    />
                    <View style={styles.partnerBtnRow}>
                      {editingPartnerNote && (
                        <TouchableOpacity onPress={() => setEditingPartnerNote(false)} style={styles.partnerCancelBtn}>
                          <Text style={styles.partnerCancelBtnText}>{t("Annuler")}</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={savePartnerNote} disabled={savingPartnerNote} style={styles.partnerSaveBtn}>
                        <Text style={styles.partnerSaveBtnText}>{savingPartnerNote ? '...' : myPartnerNote ? t("Modifier") : t("Enregistrer")}</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* Note de mon partenaire sur mon propre date */}
            {detail.user_id === myId && partnerRating && (
              <View style={styles.partnerRatingBox}>
                <Text style={styles.partnerRatingTitle}>{t("Note de @{username}", { username: partnerRating.username })}</Text>
                <Text style={styles.partnerNoteValue}>{formatNote(partnerRating.note_globale)}/20</Text>
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
                <Text style={styles.commentLabel}>{t("Commentaire")}</Text>
                <Text style={styles.comment}>{detail.commentaire}</Text>
              </View>
            ) : null}

            {detail.ratings && detail.statut !== 'planifie' && CRITERES.some((c) => detail.ratings![c.key] != null) && (
              <View style={styles.ratingsSection}>
                <Text style={styles.ratingsTitle}>{t("Détails")}</Text>
                {CRITERES.filter((c) => detail.ratings![c.key] != null).map((c) => {
                  const val = detail.ratings![c.key] as number
                  return (
                    <View key={c.key} style={styles.critereRow}>
                      <View style={styles.critereLeft}>
                        <Text style={styles.critereLabel}>{t(c.label)}</Text>
                        {renderBar(val, 5)}
                      </View>
                      <Text style={styles.critereValue}>{formatNote(val)}/5</Text>
                    </View>
                  )
                })}
              </View>
            )}

            {/* Likes */}
            <View style={styles.likesRow}>
              <LikeButton
                liked={myReaction}
                count={reactionCount}
                onPress={toggleReaction}
                size={26}
                label={reactionCount > 0 ? t("{n} j'aime", { n: reactionCount }) : t("J'aime")}
              />
            </View>

            {/* Commentaires */}
            <View style={styles.commentsSection}>
              <Text style={styles.commentsTitle}>
                {t("Commentaires")} {comments.length > 0 ? `(${comments.length})` : ''}
              </Text>

              {comments.length === 0 && (
                <Text style={styles.commentsEmpty}>{t("Aucun commentaire pour l'instant. Lance la conversation !")}</Text>
              )}

              {comments.filter((c) => !c.parent_id).map((c) => (
                <View key={c.id}>
                  {renderCommentCard(c)}
                  {comments.filter((r) => r.parent_id === c.id).map((r) => (
                    <View key={r.id} style={styles.replyIndent}>
                      {renderCommentCard(r, true)}
                    </View>
                  ))}
                </View>
              ))}

              {commentError ? <Text style={styles.commentErrText}>{commentError}</Text> : null}

              <View style={styles.commentInputWrap}>
                {mentionSuggestions.length > 0 && (
                  <View style={styles.mentionDropdown}>
                    {mentionSuggestions.map((s) => (
                      <TouchableOpacity key={s.id} style={styles.mentionItem} onPress={() => selectMention(s.username)}>
                        <Text style={styles.mentionItemText}>@{s.username}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <View style={styles.commentInputRow}>
                  <TextInput
                    style={styles.commentInput}
                    value={commentText}
                    onChangeText={handleCommentTextChange}
                    placeholder={t("Ajoute un commentaire... (@ pour mentionner)")}
                    placeholderTextColor={C.faint}
                    multiline
                    maxLength={500}
                  />
                  <TouchableOpacity
                    style={[styles.commentSendBtn, !commentText.trim() && styles.commentSendBtnDisabled]}
                    onPress={() => sendComment()}
                    disabled={sendingComment || !commentText.trim()}
                  >
                    {sendingComment ? <ActivityIndicator size="small" color={C.onPrimary} /> : <Ionicons name="arrow-up" size={18} color={C.onPrimary} />}
                  </TouchableOpacity>
                </View>
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

const styles = themedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: C.bg },
  notFound: { alignItems: 'center', marginTop: 80, paddingHorizontal: 32 },
  notFoundIcon: { fontSize: 40, marginBottom: 12 },
  notFoundTitle: { fontSize: 17, fontWeight: '700', color: C.text },
  notFoundSub: { fontSize: 14, color: C.muted, textAlign: 'center', marginTop: 6, marginBottom: 20, lineHeight: 20 },
  notFoundBtn: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  notFoundBtnText: { color: C.onPrimary, fontWeight: '700', fontSize: 15 },
  planifieBox: { backgroundColor: C.primarySoft, borderRadius: 16, padding: 16, marginBottom: 20, alignItems: 'center' },
  planifieTitle: { fontSize: 16, fontWeight: '700', color: C.primaryText },
  planifieSub: { fontSize: 13, color: C.text, marginTop: 4 },
  planifieBtn: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20, marginTop: 12 },
  planifieBtnText: { color: C.onPrimary, fontWeight: '700', fontSize: 14 },
  planifieLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, padding: 4 },
  planifieLinkText: { color: C.primaryText, fontWeight: '600', fontSize: 13 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  back: { color: C.primaryText, fontSize: 16, fontWeight: '500' },
  shareBtn: { padding: 4 },
  shareText: { color: C.primaryText, fontSize: 14, fontWeight: '600' },
  content: { padding: 20, paddingBottom: 60 },
  error: { color: C.muted, textAlign: 'center', marginTop: 60 },
  iconLine: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  conseilBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primarySoft, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, alignSelf: 'flex-start', marginBottom: 16 },
  conseilBannerText: { fontSize: 13, fontWeight: '700', color: C.primaryText },
  lieuRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lieu: { fontSize: 26, fontWeight: '700', color: C.text, marginBottom: 4 },
  lieuAddress: { fontSize: 14, color: C.muted, marginBottom: 6 },
  metaUsername: { fontSize: 14, fontWeight: '600', color: C.primaryText, marginBottom: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  meta: { fontSize: 13, color: C.muted },
  catBadge: { backgroundColor: C.primarySoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  catBadgeText: { fontSize: 12, color: C.primaryText, fontWeight: '600' },
  participantsRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: -12, marginBottom: 20 },
  participantsLabel: { fontSize: 13, color: C.text },
  participantLink: { fontSize: 13, color: C.primaryText, fontWeight: '600' },
  noteGlobaleBox: { backgroundColor: C.card, borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  noteGlobaleLabel: { fontSize: 13, color: C.muted, marginBottom: 4 },
  noteGlobaleValue: { fontSize: 52, fontWeight: '800', color: C.primaryText, lineHeight: 60 },
  noteGlobaleSuffix: { fontSize: 22, fontWeight: '500', color: C.faint },
  photoRow: { marginBottom: 20, minWidth: 0 },
  photo: { width: 240, height: 240, borderRadius: 14, marginRight: 12, backgroundColor: C.border },
  commentBox: { backgroundColor: C.card, borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: C.border },
  commentLabel: { fontSize: 12, color: C.muted, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  comment: { fontSize: 15, color: C.text, lineHeight: 22 },
  ratingsSection: { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 20 },
  ratingsTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  critereRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  critereLeft: { flex: 1, marginRight: 12 },
  critereLabel: { fontSize: 13, color: C.text, fontWeight: '500', marginBottom: 5 },
  barTrack: { flexDirection: 'row', height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
  barFill: { backgroundColor: C.primary, borderRadius: 3 },
  critereValue: { fontSize: 13, fontWeight: '700', color: C.primaryText, width: 32, textAlign: 'right' },
  likesRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  likesCount: { fontSize: 15, fontWeight: '600', color: C.faint },
  likesCountActive: { color: C.primaryText },
  commentsSection: { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border },
  commentsTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  commentsEmpty: { fontSize: 13, color: C.faint, marginBottom: 12 },
  commentCard: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  commentCardReply: { marginBottom: 8, paddingBottom: 0, borderBottomWidth: 0 },
  commentCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  commentAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.border },
  commentAvatarPlaceholder: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.primarySoft, justifyContent: 'center', alignItems: 'center' },
  commentAvatarInitial: { fontSize: 13, fontWeight: '700', color: C.primaryText },
  commentUsername: { fontSize: 13, fontWeight: '600', color: C.primaryText },
  commentTime: { fontSize: 11, color: C.faint },
  commentDelete: { fontSize: 18, color: C.faint, paddingHorizontal: 4 },
  commentContent: { fontSize: 14, color: C.text, lineHeight: 20, marginLeft: 38 },
  commentMention: { color: C.primaryText, fontWeight: '600' },
  commentReplyBtn: { fontSize: 12, color: C.faint, fontWeight: '600', marginLeft: 38, marginTop: 4 },
  replyIndent: { marginLeft: 30, marginTop: 8, marginBottom: 4, borderLeftWidth: 2, borderLeftColor: C.border, paddingLeft: 8 },
  replyInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 8, marginLeft: 38 },
  replyInput: { flex: 1, backgroundColor: C.bg, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: C.text, maxHeight: 80 },
  replySendBtn: { backgroundColor: C.primary, width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  commentInputWrap: { position: 'relative' },
  mentionDropdown: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    marginBottom: 6,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 10,
  },
  mentionItem: { paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  mentionItemText: { fontSize: 14, color: C.text, fontWeight: '600' },
  commentConfirmRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 38, marginTop: 6 },
  commentConfirmText: { fontSize: 12, color: C.muted, flex: 1 },
  commentConfirmYes: { fontSize: 13, fontWeight: '700', color: C.danger },
  commentConfirmNo: { fontSize: 13, fontWeight: '600', color: C.text },
  commentInputRow: { flexDirection: 'row', gap: 8, marginTop: 4, alignItems: 'flex-end' },
  commentCharCount: { fontSize: 11, color: C.faint, textAlign: 'right', marginTop: 2 },
  commentInput: { flex: 1, backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: C.border, fontSize: 14, maxHeight: 100 },
  commentSendBtn: { backgroundColor: C.primary, width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  commentSendBtnDisabled: { backgroundColor: C.border },
  commentSendText: { color: C.onPrimary, fontWeight: '700', fontSize: 16 },
  commentErrText: { fontSize: 13, color: C.danger, marginBottom: 8 },
  mapBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: C.primarySoft, borderRadius: 8 },
  mapBtnText: { fontSize: 12, color: C.primaryText, fontWeight: '600' },
  partnerRatingBox: { backgroundColor: C.bgAlt, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: C.primaryBorder },
  partnerRatingTitle: { fontSize: 13, fontWeight: '700', color: C.primaryText, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  partnerNoteValue: { fontSize: 32, fontWeight: '800', color: C.primaryText, marginBottom: 4 },
  partnerNoteComment: { fontSize: 14, color: C.text, lineHeight: 20, marginBottom: 8 },
  partnerEditBtn: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: C.primary },
  partnerEditBtnText: { fontSize: 13, color: C.primaryText, fontWeight: '600' },
  notePickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  notePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  notePillActive: { backgroundColor: C.primary, borderColor: C.primary },
  notePillText: { fontSize: 13, color: C.text, fontWeight: '600' },
  notePillTextActive: { color: C.onPrimary },
  partnerCommentInput: { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 10, fontSize: 14, marginBottom: 10, minHeight: 60, textAlignVertical: 'top' },
  partnerBtnRow: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  partnerCancelBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.borderStrong },
  partnerCancelBtnText: { color: C.muted, fontSize: 14 },
  partnerSaveBtn: { backgroundColor: C.primary, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10 },
  partnerSaveBtnText: { color: C.onPrimary, fontWeight: '700', fontSize: 14 },
}))
