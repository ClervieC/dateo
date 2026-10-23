import { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { webContentStyle } from '../lib/webStyles'
import { computeBadges } from '../lib/badges'
import { formaterDate } from '../lib/dateUtils'
import { ScreenHeader } from '../lib/ScreenHeader'
import { t } from '../lib/i18n'
import { C, themedStyles } from '../lib/theme'

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
      <ScreenHeader fallback="/(tabs)/profile" title="Badges" />

      {loading ? (
        <ActivityIndicator color={C.primary} style={{ marginTop: 60 }} size="large" />
      ) : (
        <ScrollView contentContainerStyle={[styles.content, webContentStyle]}>
          <Text style={styles.progress}>{t("{fait} / {total} débloqués", { fait: unlocked.length, total: badges.length })}</Text>

          {unlocked.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>{t("Débloqués ✓")}</Text>
              <View style={styles.grid}>
                {unlocked.map((b) => (
                  <View key={b.id} style={styles.badge}>
                    <Text style={styles.badgeEmoji}>{b.emoji}</Text>
                    <Text style={styles.badgeLabel}>{t(b.label)}</Text>
                    <Text style={styles.badgeDesc}>{t(b.desc)}</Text>
                    {b.unlockedAt && (
                      <Text style={styles.badgeUnlockedAt}>{t("Obtenu le {date}", { date: formaterDate(b.unlockedAt.slice(0, 10)) })}</Text>
                    )}
                  </View>
                ))}
              </View>
            </>
          )}

          {locked.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>{t("À débloquer")}</Text>
              <View style={styles.grid}>
                {locked.map((b) => (
                  <View key={b.id} style={[styles.badge, styles.badgeLocked]}>
                    <Text style={styles.badgeEmoji}>{b.emoji}</Text>
                    <Text style={[styles.badgeLabel, styles.badgeLabelLocked]}>{t(b.label)}</Text>
                    <Text style={styles.badgeDesc}>{t(b.desc)}</Text>
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

const styles = themedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 60 },
  back: { color: C.primaryText, fontSize: 16, fontWeight: '500' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  content: { padding: 20, paddingBottom: 60 },
  progress: { fontSize: 15, color: C.primaryText, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 10, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  badge: { width: '47%', backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  badgeLocked: { opacity: 0.4, backgroundColor: C.bgAlt },
  badgeEmoji: { fontSize: 32, marginBottom: 6 },
  badgeLabel: { fontSize: 13, fontWeight: '700', color: C.text, textAlign: 'center' },
  badgeLabelLocked: { color: C.faint },
  badgeDesc: { fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 4, lineHeight: 15 },
  badgeUnlockedAt: { fontSize: 10, color: C.primaryText, fontWeight: '600', marginTop: 6 },
  badgeProgressTrack: { width: '100%', height: 4, borderRadius: 2, backgroundColor: C.borderStrong, marginTop: 8, overflow: 'hidden' },
  badgeProgressFill: { height: 4, borderRadius: 2, backgroundColor: C.primary },
  badgeProgressText: { fontSize: 10, color: C.faint, marginTop: 3, fontWeight: '600' },
}))
