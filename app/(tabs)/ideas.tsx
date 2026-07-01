import { useState, useCallback, useMemo, useEffect } from 'react'
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { extraireCategories, filtrerParCategorie, getCouleurCategorie } from '../../lib/feedUtils'
import { webContentStyle } from '../../lib/webStyles'

type Idea = { id: string; titre: string; description: string | null; categorie: string }

const CATEGORIE_COLORS: Record<string, { bg: string; text: string }> = {
  Nature: { bg: '#EAF3DE', text: '#3B6D11' },
  Gastronomie: { bg: '#FAEEDA', text: '#854F0B' },
  Culture: { bg: '#EEEDFE', text: '#3C3489' },
  Aventure: { bg: '#FAECE7', text: '#993C1D' },
  Cocooning: { bg: '#FBEAF0', text: '#993556' },
  IA: { bg: '#E8F3FF', text: '#1A4F8A' },
}

const FILTER_FAVORIS = '❤️ Favoris'

export default function Ideas() {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategorie, setSelectedCategorie] = useState<string | null>(null)
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [loadingRecs, setLoadingRecs] = useState(false)
  const [recsMessage, setRecsMessage] = useState('')
  const [thinkingDots, setThinkingDots] = useState('')
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [userId, setUserId] = useState('')
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

  useEffect(() => {
    if (!loadingRecs) { setThinkingDots(''); return }
    const interval = setInterval(() => {
      setThinkingDots((d) => (d.length >= 3 ? '' : d + '.'))
    }, 500)
    return () => clearInterval(interval)
  }, [loadingRecs])

  const loadIdeas = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('date_ideas')
      .select('id, titre, description, categorie')
      .order('categorie')
    if (!error && data) setIdeas(data)
    setLoading(false)
  }, [])

  const loadFavorites = useCallback(async () => {
    const { data } = await supabase.from('user_favorites').select('idea_id')
    if (data) setFavoriteIds(new Set(data.map((f: any) => f.idea_id)))
  }, [])

  useFocusEffect(useCallback(() => {
    loadIdeas()
    loadFavorites()
  }, [loadIdeas, loadFavorites]))

  const categories = useMemo(() => extraireCategories(ideas), [ideas])

  const filteredIdeas = useMemo(() => {
    if (selectedCategorie === FILTER_FAVORIS) {
      return ideas.filter((i) => favoriteIds.has(i.id))
    }
    return filtrerParCategorie(ideas, selectedCategorie)
  }, [ideas, selectedCategorie, favoriteIds])

  async function toggleFavorite(ideaId: string) {
    if (!userId) return
    if (favoriteIds.has(ideaId)) {
      await supabase.from('user_favorites').delete()
        .eq('user_id', userId).eq('idea_id', ideaId)
      setFavoriteIds((prev) => { const s = new Set(prev); s.delete(ideaId); return s })
    } else {
      const { error } = await supabase.from('user_favorites')
        .insert({ user_id: userId, idea_id: ideaId })
      if (!error) setFavoriteIds((prev) => new Set([...prev, ideaId]))
    }
  }

  async function favoriteRecommendation(rec: any) {
    if (!userId || !rec.titre) return

    // Cherche si l'idée est déjà en base (peut avoir été sauvée par saveRecommendationsToSharedList)
    let { data: existing } = await supabase
      .from('date_ideas').select('id').eq('titre', rec.titre).maybeSingle()

    if (!existing) {
      const { data: inserted, error: insertError } = await supabase
        .from('date_ideas')
        .insert({ titre: rec.titre, description: rec.raison ?? null, categorie: rec.categorie ?? 'IA' })
        .select('id')
        .single()

      if (insertError) {
        Alert.alert('Erreur', `Impossible d'ajouter l'idée : ${insertError.message}\n\nExécute dans Supabase :\nCREATE POLICY "insert_ideas" ON date_ideas FOR INSERT WITH CHECK (auth.role() = 'authenticated');`)
        return
      }

      existing = inserted
      // Met à jour les ideas localement sans refetch complet
      const newIdea: Idea = {
        id: inserted.id,
        titre: rec.titre,
        description: rec.raison ?? null,
        categorie: rec.categorie ?? 'IA',
      }
      setIdeas((prev) => [...prev, newIdea])
    }

    if (!existing) return
    await toggleFavorite(existing.id)
  }

  async function loadRecommendations() {
    setLoadingRecs(true)
    setRecsMessage('')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoadingRecs(false); return }

    try {
      const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/recommandations`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok || data.error) {
        const msg = data.error ?? `Erreur ${response.status}`
        const debug = data.debug ? `\n\n[Debug] ${data.debug}` : ''
        setRecsMessage(msg + debug)
        return
      }

      if (data.recommendations && data.recommendations.length > 0) {
        setRecommendations(data.recommendations)
        await saveRecommendationsToSharedList(data.recommendations)
      } else if (data.message) {
        setRecsMessage(data.message)
      } else {
        setRecsMessage("L'IA n'a pas généré de recommandations cette fois-ci")
      }
    } catch (err) {
      setRecsMessage(`Erreur réseau : ${err instanceof Error ? err.message : 'inconnue'}`)
    } finally {
      setLoadingRecs(false)
    }
  }

  async function saveRecommendationsToSharedList(recs: any[]) {
    let saved = 0
    for (const rec of recs) {
      if (!rec.titre) continue
      const { error } = await supabase.from('date_ideas').insert({
        titre: rec.titre,
        description: rec.raison ?? null,
        categorie: rec.categorie ?? 'IA',
      })
      if (!error) saved++
    }
    if (saved > 0) loadIdeas()
  }

  function navigateToRate(titre: string) {
    router.push({ pathname: '/(tabs)/rate', params: { intitule: titre } } as any)
  }

  function getRecIdeaId(rec: any): string | null {
    return ideas.find((i) => i.titre === rec.titre)?.id ?? null
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FlatList
        style={styles.container}
        contentContainerStyle={[styles.content, webContentStyle]}
        data={filteredIdeas}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>Idées de dates</Text>

            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={['Tout', FILTER_FAVORIS, ...categories]}
              keyExtractor={(item) => item}
              style={styles.filterRow}
              renderItem={({ item }) => {
                const isSelected = item === 'Tout' ? !selectedCategorie : selectedCategorie === item
                const isFavFilter = item === FILTER_FAVORIS
                return (
                  <TouchableOpacity
                    style={[
                      styles.filterChip,
                      isSelected && styles.filterChipActive,
                      isFavFilter && !isSelected && styles.filterChipFav,
                    ]}
                    onPress={() => setSelectedCategorie(item === 'Tout' ? null : item)}
                  >
                    <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                )
              }}
            />

            <View style={styles.recsSection}>
              <View style={styles.recsHeader}>
                <Text style={styles.recsTitle}>✨ Pour toi</Text>
                {!loadingRecs && (
                  <TouchableOpacity style={styles.recsButton} onPress={loadRecommendations}>
                    <Text style={styles.recsButtonText}>Générer</Text>
                  </TouchableOpacity>
                )}
              </View>

              {loadingRecs && (
                <View style={styles.thinkingCard}>
                  <ActivityIndicator color="#D4517E" size="large" />
                  <Text style={styles.thinkingTitle}>L'IA réfléchit{thinkingDots}</Text>
                  <Text style={styles.thinkingSubtext}>
                    Analyse de tes dates passés pour trouver les meilleures idées pour toi
                  </Text>
                </View>
              )}

              {!loadingRecs && recsMessage ? (
                <Text style={styles.recsMessage}>{recsMessage}</Text>
              ) : null}

              {!loadingRecs && recommendations.map((rec, idx) => {
                const ideaId = getRecIdeaId(rec)
                const isFav = ideaId ? favoriteIds.has(ideaId) : false
                return (
                  <TouchableOpacity
                    key={idx}
                    style={styles.recCard}
                    onPress={() => navigateToRate(rec.titre)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.recHeader}>
                      <Text style={styles.recTitle}>{rec.titre}</Text>
                      <TouchableOpacity
                        onPress={() => ideaId ? toggleFavorite(ideaId) : favoriteRecommendation(rec)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name={isFav ? 'heart' : 'heart-outline'}
                          size={22}
                          color="#D4517E"
                        />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.recReason}>{rec.raison}</Text>
                    <Text style={styles.recCta}>Appuyer pour noter →</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {loading && <ActivityIndicator color="#D4517E" style={{ marginTop: 20 }} />}
          </View>
        }
        renderItem={({ item }) => {
          const colors = getCouleurCategorie(item.categorie, CATEGORIE_COLORS)
          const isFav = favoriteIds.has(item.id)
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigateToRate(item.titre)}
              activeOpacity={0.85}
            >
              <View style={styles.cardTop}>
                <View style={[styles.badge, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.badgeText, { color: colors.text }]}>{item.categorie}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => toggleFavorite(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={isFav ? 'heart' : 'heart-outline'}
                    size={22}
                    color="#D4517E"
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.ideaTitle}>{item.titre}</Text>
              {item.description ? (
                <Text style={styles.ideaDescription}>{item.description}</Text>
              ) : null}
              <Text style={styles.ideaCta}>Appuyer pour noter →</Text>
            </TouchableOpacity>
          )
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              {selectedCategorie === FILTER_FAVORIS ? (
                <>
                  <Text style={styles.emptyIcon}>🤍</Text>
                  <Text style={styles.empty}>Aucun favori pour l'instant</Text>
                  <Text style={styles.emptySub}>Appuie sur ❤️ sur une idée pour la sauvegarder</Text>
                </>
              ) : (
                <Text style={styles.empty}>Aucune idée pour cette catégorie</Text>
              )}
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF8F5' },
  container: { flex: 1, backgroundColor: '#FFF8F5' },
  content: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 24, fontWeight: '600', color: '#D4517E', marginBottom: 16 },
  filterRow: { marginBottom: 16 },
  filterChip: { backgroundColor: '#fff', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, marginRight: 8, borderWidth: 1, borderColor: '#F0D9D9' },
  filterChipActive: { backgroundColor: '#D4517E', borderColor: '#D4517E' },
  filterChipFav: { borderColor: '#D4517E' },
  filterChipText: { fontSize: 13, color: '#5C4A45', fontWeight: '500' },
  filterChipTextActive: { color: '#fff' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F0D9D9' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  badge: { alignSelf: 'flex-start', borderRadius: 6, paddingVertical: 3, paddingHorizontal: 10 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  ideaTitle: { fontSize: 16, fontWeight: '600', color: '#5C4A45', marginBottom: 4 },
  ideaDescription: { fontSize: 13, color: '#888', lineHeight: 18, marginBottom: 6 },
  ideaCta: { fontSize: 12, color: '#D4517E', fontWeight: '500' },
  recsSection: { marginBottom: 24 },
  recsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  recsTitle: { fontSize: 16, fontWeight: '600', color: '#5C4A45' },
  recsButton: { backgroundColor: '#D4517E', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 16 },
  recsButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  recsMessage: { color: '#888', fontSize: 13, marginBottom: 8 },
  thinkingCard: { backgroundColor: '#FBEAF0', borderRadius: 16, padding: 24, alignItems: 'center', gap: 12, marginBottom: 8, borderWidth: 1, borderColor: '#F4C0D1' },
  thinkingTitle: { fontSize: 16, fontWeight: '700', color: '#D4517E' },
  thinkingSubtext: { fontSize: 13, color: '#72243E', textAlign: 'center', lineHeight: 18 },
  recCard: { backgroundColor: '#FBEAF0', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#F4C0D1' },
  recHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  recTitle: { fontSize: 15, fontWeight: '600', color: '#993556', flex: 1, marginRight: 8 },
  recReason: { fontSize: 13, color: '#72243E', marginBottom: 6 },
  recCta: { fontSize: 12, color: '#D4517E', fontWeight: '500' },
  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  empty: { color: '#888', textAlign: 'center', fontSize: 15 },
  emptySub: { color: '#B8A9A0', textAlign: 'center', fontSize: 13, marginTop: 4 },
})
