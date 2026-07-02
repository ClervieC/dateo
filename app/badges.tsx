import { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { webContentStyle } from '../lib/webStyles'

type Badge = {
  id: string
  emoji: string
  label: string
  desc: string
  unlocked: boolean
  current?: number
  target?: number
}

function computeBadges(
  count: number,
  maxNote: number,
  distinctLieux: number,
  conseilCount: number,
  commentCount: number,
  hasCouple: boolean,
  monthStreak: number,
  planifieCount: number,
): Badge[] {
  return [
    { id: 'first', emoji: '🌹', label: 'Premier Date', desc: 'Enregistre ton premier date', unlocked: count >= 1, current: count, target: 1 },
    { id: 'ten', emoji: '🔥', label: 'Enflammé', desc: '10 dates vécus', unlocked: count >= 10, current: count, target: 10 },
    { id: 'twenty', emoji: '💫', label: 'Romantique', desc: '20 dates vécus', unlocked: count >= 20, current: count, target: 20 },
    { id: 'fifty', emoji: '👑', label: 'Expert des dates', desc: '50 dates vécus', unlocked: count >= 50, current: count, target: 50 },
    { id: 'excellent', emoji: '✨', label: 'Excellent', desc: 'Avoir un 18/20 ou plus', unlocked: maxNote >= 18, current: maxNote, target: 18 },
    { id: 'perfect', emoji: '⭐', label: 'Note parfaite', desc: 'Avoir un 20/20', unlocked: maxNote >= 20, current: maxNote, target: 20 },
    { id: 'explorer', emoji: '🗺️', label: 'Explorateur', desc: 'Visiter 5 lieux différents', unlocked: distinctLieux >= 5, current: distinctLieux, target: 5 },
    { id: 'nomad', emoji: '🌍', label: 'Nomade', desc: 'Visiter 15 lieux différents', unlocked: distinctLieux >= 15, current: distinctLieux, target: 15 },
    { id: 'conseil', emoji: '💖', label: 'Recommandeur', desc: 'Conseiller vivement 3 dates', unlocked: conseilCount >= 3, current: conseilCount, target: 3 },
    { id: 'writer', emoji: '✍️', label: 'Commentateur', desc: 'Laisser 5 commentaires sur des dates', unlocked: commentCount >= 5, current: commentCount, target: 5 },
    { id: 'couple', emoji: '💑', label: 'Duo', desc: 'Lier son compte en mode couple', unlocked: hasCouple },
    { id: 'streak3', emoji: '📅', label: 'Assidu', desc: 'Dates 3 mois consécutifs', unlocked: monthStreak >= 3, current: monthStreak, target: 3 },
    { id: 'streak6', emoji: '🗓️', label: 'Régulier', desc: 'Dates 6 mois consécutifs', unlocked: monthStreak >= 6, current: monthStreak, target: 6 },
    { id: 'planner', emoji: '📌', label: 'Planificateur', desc: 'Avoir 3 dates planifiés', unlocked: planifieCount >= 3, current: planifieCount, target: 3 },
  ]
}

export default function Badges() {
  const [badges, setBadges] = useState<Badge[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const [
      { count: dateCount },
      { data: allDates },
      { count: conseilCount },
      { count: commentCount },
      { count: planifieCount },
      { data: coupleRow },
    ] = await Promise.all([
      supabase.from('dates').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('statut', 'vecu'),
      supabase.from('dates').select('date_du_date, lieu, note_globale').eq('user_id', user.id).eq('statut', 'vecu').order('date_du_date'),
      supabase.from('dates').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('conseil_vivement', true),
      supabase.from('date_comments').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('dates').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('statut', 'planifie'),
      supabase.from('couples').select('id').or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`).eq('status', 'accepted').maybeSingle(),
    ])

    const dates = (allDates ?? []) as any[]
    const maxNote = dates.reduce((m, d) => Math.max(m, d.note_globale), 0)
    const distinctLieux = new Set(dates.map((d) => d.lieu.toLowerCase())).size

    // compute consecutive month streak going back from now
    const monthSet = new Set(dates.map((d) => d.date_du_date.slice(0, 7)))
    let monthStreak = 0
    const now = new Date()
    for (let i = 0; i < 36; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (monthSet.has(key)) monthStreak++
      else if (i > 0) break
    }

    setBadges(computeBadges(
      dateCount ?? 0,
      maxNote,
      distinctLieux,
      conseilCount ?? 0,
      commentCount ?? 0,
      !!coupleRow,
      monthStreak,
      planifieCount ?? 0,
    ))
    setLoading(false)
  }, [])

  useFocusEffect(useCallback(() => { load() }, [load]))

  const unlocked = badges.filter((b) => b.unlocked)
  const locked = badges.filter((b) => !b.unlocked)

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color="#D4517E" />
          <Text style={styles.back}>Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Badges</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <ActivityIndicator color="#D4517E" style={{ marginTop: 60 }} size="large" />
      ) : (
        <ScrollView contentContainerStyle={[styles.content, webContentStyle]}>
          <Text style={styles.progress}>{unlocked.length} / {badges.length} débloqués</Text>

          {unlocked.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Débloqués ✓</Text>
              <View style={styles.grid}>
                {unlocked.map((b) => (
                  <View key={b.id} style={styles.badge}>
                    <Text style={styles.badgeEmoji}>{b.emoji}</Text>
                    <Text style={styles.badgeLabel}>{b.label}</Text>
                    <Text style={styles.badgeDesc}>{b.desc}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {locked.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>À débloquer</Text>
              <View style={styles.grid}>
                {locked.map((b) => (
                  <View key={b.id} style={[styles.badge, styles.badgeLocked]}>
                    <Text style={styles.badgeEmoji}>{b.emoji}</Text>
                    <Text style={[styles.badgeLabel, styles.badgeLabelLocked]}>{b.label}</Text>
                    <Text style={styles.badgeDesc}>{b.desc}</Text>
                    {b.target !== undefined && (
                      <>
                        <View style={styles.badgeProgressTrack}>
                          <View style={[styles.badgeProgressFill, { width: `${Math.min(100, ((b.current ?? 0) / b.target) * 100)}%` }]} />
                        </View>
                        <Text style={styles.badgeProgressText}>{Math.min(b.current ?? 0, b.target)}/{b.target}</Text>
                      </>
                    )}
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF8F5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0D9D9' },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 60 },
  back: { color: '#D4517E', fontSize: 16, fontWeight: '500' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#5C4A45' },
  content: { padding: 20, paddingBottom: 60 },
  progress: { fontSize: 15, color: '#D4517E', fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#5C4A45', marginBottom: 10, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  badge: { width: '47%', backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#F0D9D9', alignItems: 'center' },
  badgeLocked: { opacity: 0.4, backgroundColor: '#F7F2F0' },
  badgeEmoji: { fontSize: 32, marginBottom: 6 },
  badgeLabel: { fontSize: 13, fontWeight: '700', color: '#5C4A45', textAlign: 'center' },
  badgeLabelLocked: { color: '#aaa' },
  badgeDesc: { fontSize: 11, color: '#888', textAlign: 'center', marginTop: 4, lineHeight: 15 },
  badgeProgressTrack: { width: '100%', height: 4, borderRadius: 2, backgroundColor: '#E8DCD8', marginTop: 8, overflow: 'hidden' },
  badgeProgressFill: { height: 4, borderRadius: 2, backgroundColor: '#D4517E' },
  badgeProgressText: { fontSize: 10, color: '#B8A9A0', marginTop: 3, fontWeight: '600' },
})
