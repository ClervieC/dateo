import { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../lib/supabase'
import { webContentStyle } from '../lib/webStyles'
import { ScreenHeader } from '../lib/ScreenHeader'
import { TOPIC_CATEGORIES, melangerQuestions } from '../lib/conversationTopics'
import { t, tKey, getLang } from '../lib/i18n'
import { C, themedStyles } from '../lib/theme'

const DRAFT_KEY = 'conversationDraft'
const MAX_DESCRIPTION = 600

// Doivent rester identiques à supabase/functions/sujets-conversation (STAGES / MOODS)
const STAGES = [
  { key: 'premier', label: tKey("Premier date") },
  { key: 'quelques', label: tKey("Quelques dates") },
  { key: 'couple', label: tKey("En couple") },
  { key: 'amis', label: tKey("Entre amis") },
] as const
const MOODS = [
  { key: 'leger', label: tKey("😊 Léger") },
  { key: 'fun', label: tKey("😂 Drôle") },
  { key: 'profond', label: tKey("💭 Profond") },
] as const

type Sujet = { theme: string; question: string; relance: string | null; pourquoi: string | null }
type Stage = typeof STAGES[number]['key']
type Mood = typeof MOODS[number]['key']

export default function Conversation() {
  const params = useLocalSearchParams<{ contexte?: string; stage?: string }>()
  const [tab, setTab] = useState<'perso' | 'pretes'>('perso')

  // --- Sujets personnalisés (IA) ---
  const [description, setDescription] = useState('')
  const [stage, setStage] = useState<Stage>(STAGES.some((s) => s.key === params.stage) ? (params.stage as Stage) : 'premier')
  const [mood, setMood] = useState<Mood>('leger')
  const [contexte, setContexte] = useState(typeof params.contexte === 'string' ? params.contexte : '')
  const [sujets, setSujets] = useState<Sujet[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // --- Questions prêtes ---
  const [categoryKey, setCategoryKey] = useState(TOPIC_CATEGORIES[0].key)
  const [seed, setSeed] = useState(() => Date.now())

  // Garde la description saisie d'une visite à l'autre (préparer un date, revenir plus tard)
  useEffect(() => {
    AsyncStorage.getItem(DRAFT_KEY).then((raw) => {
      if (!raw) return
      try {
        const d = JSON.parse(raw)
        setDescription(d.description ?? '')
        if (!params.stage && d.stage) setStage(d.stage)
        if (d.mood) setMood(d.mood)
      } catch {}
    }).catch(() => {})
  }, [])

  useEffect(() => {
    AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({ description, stage, mood })).catch(() => {})
  }, [description, stage, mood])

  async function generate() {
    if (loading) return
    if (description.trim().length < 3) {
      setError(t("Décris un peu la personne : ses passions, son métier, ce qu'elle aime…"))
      return
    }
    setError('')
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError(t("Tu dois être connecté·e")); return }
      const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/sujets-conversation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: description.trim(), stage, mood, contexte: contexte.trim(), lang: getLang() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        setError(data.error ?? t("Le service d'idées ne répond pas (erreur {code}). Réessaie dans un instant.", { code: res.status }))
        return
      }
      setSujets(data.sujets ?? [])
    } catch {
      setError(t("Connexion impossible. Vérifie ton réseau."))
    } finally {
      setLoading(false)
    }
  }

  const category = TOPIC_CATEGORIES.find((c) => c.key === categoryKey) ?? TOPIC_CATEGORIES[0]
  const questions = useMemo(() => melangerQuestions(category.questions, seed).slice(0, 5), [category, seed])

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title={t("Sujets de conversation")} fallback="/(tabs)/ideas" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.content, webContentStyle]} keyboardShouldPersistTaps="handled">
          <View style={styles.segmented}>
            {([
              { key: 'perso', label: t("✨ Pour cette personne") },
              { key: 'pretes', label: t("📚 Questions prêtes") },
            ] as const).map((tb) => (
              <TouchableOpacity
                key={tb.key}
                style={[styles.segment, tab === tb.key && styles.segmentActive]}
                onPress={() => setTab(tb.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: tab === tb.key }}
              >
                <Text style={[styles.segmentText, tab === tb.key && styles.segmentTextActive]}>{tb.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {tab === 'perso' ? (
            <>
              <View style={styles.card}>
                <Text style={styles.label}>{t("Avec qui tu sors ?")}</Text>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  value={description}
                  onChangeText={(v) => { setDescription(v.slice(0, MAX_DESCRIPTION)); setError('') }}
                  placeholder={t("Ex : Léa, 27 ans, infirmière. Fan d'escalade et de séries coréennes, elle a vécu un an au Japon et adore cuisiner.")}
                  placeholderTextColor={C.faint}
                  multiline
                  textAlignVertical="top"
                />
                <Text style={styles.counter}>{description.length}/{MAX_DESCRIPTION}</Text>

                <Text style={styles.label}>{t("Vous en êtes où ?")}</Text>
                <View style={styles.chipRow}>
                  {STAGES.map((s) => (
                    <TouchableOpacity key={s.key} style={[styles.chip, stage === s.key && styles.chipActive]} onPress={() => setStage(s.key)}>
                      <Text style={[styles.chipText, stage === s.key && styles.chipTextActive]}>{t(s.label)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>{t("Quelle ambiance ?")}</Text>
                <View style={styles.chipRow}>
                  {MOODS.map((m) => (
                    <TouchableOpacity key={m.key} style={[styles.chip, mood === m.key && styles.chipActive]} onPress={() => setMood(m.key)}>
                      <Text style={[styles.chipText, mood === m.key && styles.chipTextActive]}>{t(m.label)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>{t("Le date")} <Text style={styles.optional}>{t("(optionnel)")}</Text></Text>
                <TextInput
                  style={styles.input}
                  value={contexte}
                  onChangeText={setContexte}
                  placeholder={t("Ex : dîner dans un resto italien, balade au bord du lac…")}
                  placeholderTextColor={C.faint}
                  maxLength={200}
                />

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <TouchableOpacity style={[styles.button, loading && { opacity: 0.7 }]} onPress={generate} disabled={loading}>
                  {loading
                    ? <ActivityIndicator color={C.onPrimary} />
                    : <Text style={styles.buttonText}>{sujets.length > 0 ? t("🔄 Proposer d'autres sujets") : t("✨ Trouver des sujets")}</Text>}
                </TouchableOpacity>
                <Text style={styles.privacy}>
                  {t("🔒 Ta description est envoyée à l'IA uniquement pour générer les sujets, elle n'est pas publiée. Évite les infos sensibles (nom complet, adresse…).")}
                </Text>
              </View>

              {sujets.map((s, i) => (
                <View key={`${i}-${s.question}`} style={styles.sujetCard}>
                  {s.theme ? <Text style={styles.sujetTheme}>{s.theme}</Text> : null}
                  <Text style={styles.sujetQuestion}>{s.question}</Text>
                  {s.relance ? (
                    <View style={styles.relanceRow}>
                      <Ionicons name="return-down-forward" size={14} color={C.primary} />
                      <Text style={styles.relanceText}>{s.relance}</Text>
                    </View>
                  ) : null}
                  {s.pourquoi ? <Text style={styles.sujetWhy}>{s.pourquoi}</Text> : null}
                </View>
              ))}

              {sujets.length === 0 && !loading && (
                <TouchableOpacity style={styles.switchHint} onPress={() => setTab('pretes')}>
                  <Text style={styles.switchHintText}>{t("Pas envie de décrire la personne ?")} <Text style={styles.link}>{t("Voir les questions prêtes →")}</Text></Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
                {TOPIC_CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c.key}
                    style={[styles.chip, categoryKey === c.key && styles.chipActive]}
                    onPress={() => setCategoryKey(c.key)}
                  >
                    <Text style={[styles.chipText, categoryKey === c.key && styles.chipTextActive]}>{c.emoji} {t(c.label)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {questions.map((q, i) => (
                <View key={q} style={styles.sujetCard}>
                  <Text style={styles.sujetNumber}>{i + 1}</Text>
                  <Text style={styles.sujetQuestion}>{t(q)}</Text>
                </View>
              ))}

              <TouchableOpacity style={styles.shuffleBtn} onPress={() => setSeed((s) => s + 1)}>
                <Ionicons name="shuffle" size={18} color={C.primary} />
                <Text style={styles.shuffleText}>{t("Mélanger")}</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = themedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: C.bg },
  content: { padding: 20, paddingBottom: 60 },
  segmented: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: C.border, marginBottom: 16 },
  segment: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  segmentActive: { backgroundColor: C.primary },
  segmentText: { fontSize: 13, fontWeight: '600', color: C.text },
  segmentTextActive: { color: C.onPrimary },
  card: { backgroundColor: C.card, borderRadius: 18, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  label: { fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 8 },
  optional: { fontSize: 12, fontWeight: '400', color: C.faint },
  input: { backgroundColor: C.bg, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border, fontSize: 15, color: C.text, marginBottom: 16 },
  textarea: { minHeight: 110, marginBottom: 4 },
  counter: { fontSize: 11, color: C.faint, textAlign: 'right', marginBottom: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  catRow: { gap: 8, paddingBottom: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  chipActive: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { fontSize: 13, color: C.text, fontWeight: '500' },
  chipTextActive: { color: C.onPrimary, fontWeight: '700' },
  error: { color: C.errorText, backgroundColor: C.errorBg, borderRadius: 10, padding: 10, fontSize: 13, marginBottom: 12, overflow: 'hidden' },
  button: { backgroundColor: C.primary, borderRadius: 14, padding: 16, alignItems: 'center' },
  buttonText: { color: C.onPrimary, fontWeight: '700', fontSize: 16 },
  privacy: { fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 16 },
  sujetCard: { backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  sujetTheme: { alignSelf: 'flex-start', fontSize: 11, fontWeight: '700', color: C.primaryText, backgroundColor: C.primarySoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8, overflow: 'hidden', textTransform: 'uppercase', letterSpacing: 0.4 },
  sujetNumber: { fontSize: 12, fontWeight: '700', color: C.faint, marginBottom: 4 },
  sujetQuestion: { fontSize: 16, fontWeight: '600', color: C.text, lineHeight: 22 },
  relanceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 },
  relanceText: { flex: 1, fontSize: 14, color: C.text, lineHeight: 20 },
  sujetWhy: { fontSize: 12, color: C.muted, marginTop: 8, fontStyle: 'italic' },
  switchHint: { alignItems: 'center', paddingVertical: 8 },
  switchHintText: { fontSize: 13, color: C.muted, textAlign: 'center' },
  link: { color: C.primaryText, fontWeight: '600' },
  shuffleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 },
  shuffleText: { color: C.primaryText, fontWeight: '700', fontSize: 15 },
}))
