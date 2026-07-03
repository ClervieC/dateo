import { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { webContentStyle } from '../lib/webStyles'
import { computeBadges } from '../lib/badges'
import { formaterDate } from '../lib/dateUtils'

export default function Badges() {
  const [badges, setBadges] = useState<ReturnType<typeof computeBadges>>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const [
      { data: allDates },
      { data: commentRows },
      { data: planifieRows },
      { data: coupleRow },
    ] = await Promise.all([
      supabase.from('dates').select('date_du_date, lieu, note_globale, conseil_vivement').eq('user_id', user.id).eq('statut', 'vecu').order('date_du_date'),
      supabase.from('date_comments').select('created_at').eq('user_id', user.id).order('created_at'),
      supabase.from('dates').select('date_du_date').eq('user_id', user.id).eq('statut', 'planifie').order('date_du_date'),
      supabase.from('couples').select('id').or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`).eq('status', 'accepted').maybeSingle(),
    ])

    const vecuDates = (allDates ?? []) as any[]

    // compute consecutive month streak going back from now
    const monthSet = new Set(vecuDates.map((d) => d.date_du_date.slice(0, 7)))
    let monthStreak = 0
    const now = new Date()
    for (let i = 0; i < 36; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (monthSet.has(key)) monthStreak++
      else if (i > 0) break
    }

    setBadges(computeBadges({
      vecuDates,
      commentDates: (commentRows ?? []).map((c: any) => c.created_at),
      planifieDates: (planifieRows ?? []).map((p: any) => p.date_du_date),
      hasCouple: !!coupleRow,
      monthStreak,
    }))
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
                    {b.unlockedAt && (
                      <Text style={styles.badgeUnlockedAt}>Obtenu le {formaterDate(b.unlockedAt)}</Text>
                    )}
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
  badgeUnlockedAt: { fontSize: 10, color: '#D4517E', fontWeight: '600', marginTop: 6 },
  badgeProgressTrack: { width: '100%', height: 4, borderRadius: 2, backgroundColor: '#E8DCD8', marginTop: 8, overflow: 'hidden' },
  badgeProgressFill: { height: 4, borderRadius: 2, backgroundColor: '#D4517E' },
  badgeProgressText: { fontSize: 10, color: '#B8A9A0', marginTop: 3, fontWeight: '600' },
})
