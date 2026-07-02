import { useState, useCallback, useMemo, useEffect } from 'react'
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { NotificationBell } from '../../lib/NotificationBell'
import { supabase } from '../../lib/supabase'
import { extraireCategories, filtrerParCategorie } from '../../lib/feedUtils'
import { CATEGORIES, getCategoryLabel, getCategoryColor } from '../../lib/categories'
import { webContentStyle } from '../../lib/webStyles'

type Idea = { id: string; titre: string; description: string | null; categorie: string | null; ville: string | null }

const FILTER_FAVORIS = '❤️ Favoris'
const FILTER_IA = '✨ Pour toi'

export default function Ideas() {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [selectedCategorie, setSelectedCategorie] = useState<string | null>(null)
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [loadingRecs, setLoadingRecs] = useState(false)
  const [recsMessage, setRecsMessage] = useState('')
  const [thinkingDots, setThinkingDots] = useState('')
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [userId, setUserId] = useState('')
  const [recMode, setRecMode] = useState<'best' | 'theme' | 'free'>('best')
  const [recTheme, setRecTheme] = useState<string | null>(null)
  const [recFreeText, setRecFreeText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [ville, setVille] = useState<string | null>(null)
  const router = useRouter()

  const REC_MODES: { key: 'best' | 'theme' | 'free'; emoji: string; label: string; hint: string }[] = [
    { key: 'best', emoji: '⭐', label: 'Meilleurs dates', hint: 'Basé sur les dates que tu as le mieux notés' },
    { key: 'theme', emoji: '🎨', label: 'Thème', hint: 'Choisis une ambiance précise' },
    { key: 'free', emoji: '✍️', label: 'Envie libre', hint: 'Décris ce que tu as envie de faire' },
  ]
  const REC_THEMES = CATEGORIES
  const canGenerate = recMode === 'best' || (recMode === 'theme' && !!recTheme) || (recMode === 'free' && recFreeText.trim().length > 0)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      const { data } = await supabase.from('profiles').select('ville').eq('id', user.id).single()
      setVille((data as any)?.ville ?? null)
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
    setLoadError(false)
    const { data, error } = await supabase
      .from('date_ideas')
      .select('id, titre, description, categorie, ville')
      .order('categorie')
    if (!error && data) setIdeas(data)
    else if (error) setLoadError(true)
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
    if (selectedCategorie === FILTER_IA) return []
    const isFavView = selectedCategorie === FILTER_FAVORIS
    let result = isFavView
      ? ideas.filter((i) => favoriteIds.has(i.id))
      : filtrerParCategorie(ideas, selectedCategorie)

    // En dehors des favoris, on ne montre que les idées génériques (sans ville)
    // ou celles correspondant à la ville de l'utilisateur — pas tout le catalogue.
    if (!isFavView && ville) {
      result = result.filter((i) => !i.ville || i.ville === ville)
    }

    const q = searchQuery.trim().toLowerCase()
    if (q) {
      result = result.filter((i) =>
        i.titre.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q)
      )
    }
    return result
  }, [ideas, selectedCategorie, favoriteIds, searchQuery, ville])

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
        .insert({ titre: rec.titre, description: rec.raison ?? null, categorie: rec.categorie ?? null, ville })
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
        categorie: rec.categorie ?? null,
        ville,
      }
      setIdeas((prev) => [...prev, newIdea])
    }

    if (!existing) return
    await toggleFavorite(existing.id)
  }

  async function loadRecommendations() {
    if (!canGenerate) return

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
        body: JSON.stringify({ mode: recMode, theme: recTheme, freeText: recFreeText, ville }),
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
        categorie: rec.categorie ?? null,
        ville,
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
            <View style={styles.titleRow}>
              <Text style={styles.title}>Idées de dates</Text>
              {Platform.OS !== 'web' && <NotificationBell style={styles.bellBtn} />}
            </View>

            <View style={styles.searchBar}>
              <Ionicons name="search" size={15} color="#B8A9A0" />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Rechercher une idée..."
                placeholderTextColor="#B8A9A0"
                clearButtonMode="while-editing"
              />
            </View>

            {loadError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>Impossible de charger les idées. Vérifie ta connexion.</Text>
                <TouchableOpacity onPress={loadIdeas}>
                  <Text style={styles.errorBannerRetry}>Réessayer</Text>
                </TouchableOpacity>
              </View>
            )}

            {!ville && (
              <TouchableOpacity style={styles.wishlistTeaser} onPress={() => router.push('/settings')} activeOpacity={0.8}>
                <Ionicons name="location-outline" size={16} color="#D4517E" />
                <Text style={styles.iaTeaserText}>
                  Renseigne <Text style={styles.iaTeaserLink}>ta ville dans les paramètres →</Text> pour voir des idées près de chez toi
                </Text>
              </TouchableOpacity>
            )}

            {!selectedCategorie && !searchQuery.trim() && (
              <TouchableOpacity style={styles.iaTeaser} onPress={() => setSelectedCategorie(FILTER_IA)} activeOpacity={0.8}>
                <Ionicons name="sparkles" size={16} color="#D4517E" />
                <Text style={styles.iaTeaserText}>
                  Pas d'inspiration ? Laisse l'IA te proposer des idées dans <Text style={styles.iaTeaserLink}>Pour toi →</Text>
                </Text>
              </TouchableOpacity>
            )}

            {!selectedCategorie && !searchQuery.trim() && (
              <TouchableOpacity style={styles.wishlistTeaser} onPress={() => router.push('/wishlist')} activeOpacity={0.8}>
                <Ionicons name="location" size={16} color="#D4517E" />
                <Text style={styles.iaTeaserText}>
                  Retrouve les lieux que tu veux essayer dans <Text style={styles.iaTeaserLink}>Lieux à essayer →</Text>
                </Text>
              </TouchableOpacity>
            )}

            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={['Tout', FILTER_FAVORIS, FILTER_IA, ...categories]}
              keyExtractor={(item) => item}
              style={styles.filterRow}
              renderItem={({ item }) => {
                const isSelected = item === 'Tout' ? !selectedCategorie : selectedCategorie === item
                const isFavFilter = item === FILTER_FAVORIS || item === FILTER_IA
                const label = item === 'Tout' || isFavFilter ? item : getCategoryLabel(item)
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
                      {label}
                    </Text>
                  </TouchableOpacity>
                )
              }}
            />

            {selectedCategorie === FILTER_IA && (
            <View style={styles.recsSection}>
              <View style={styles.recsHeader}>
                <Ionicons name="sparkles" size={18} color="#D4517E" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.recsTitle}>Idées générées pour toi</Text>
                  <Text style={styles.recsSubtitle}>Choisis une approche, l'IA s'occupe du reste</Text>
                </View>
              </View>

              <View style={styles.recSegmented}>
                {REC_MODES.map((m) => (
                  <TouchableOpacity
                    key={m.key}
                    style={[styles.recSegment, recMode === m.key && styles.recSegmentActive]}
                    onPress={() => { setRecMode(m.key); setRecsMessage('') }}
                  >
                    <Text style={styles.recSegmentEmoji}>{m.emoji}</Text>
                    <Text style={[styles.recSegmentText, recMode === m.key && styles.recSegmentTextActive]}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.recModeHint}>{REC_MODES.find((m) => m.key === recMode)?.hint}</Text>

              {recMode === 'theme' && (
                <View style={styles.recThemeRow}>
                  {REC_THEMES.map((cat) => (
                    <TouchableOpacity
                      key={cat.key}
                      style={[styles.recThemeChip, recTheme === cat.key && styles.recThemeChipActive]}
                      onPress={() => setRecTheme(recTheme === cat.key ? null : cat.key)}
                    >
                      <Text style={[styles.recThemeChipText, recTheme === cat.key && styles.recThemeChipTextActive]}>
                        {cat.emoji} {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {recMode === 'free' && (
                <TextInput
                  style={styles.recFreeInput}
                  placeholder="Ex : quelque chose de calme en extérieur, pas cher..."
                  placeholderTextColor="#B8A9A0"
                  value={recFreeText}
                  onChangeText={setRecFreeText}
                />
              )}

              <TouchableOpacity
                style={[styles.recsButton, (!canGenerate || loadingRecs) && styles.recsButtonDisabled]}
                onPress={loadRecommendations}
                disabled={!canGenerate || loadingRecs}
              >
                <Ionicons name="sparkles" size={15} color="#fff" />
                <Text style={styles.recsButtonText}>
                  {loadingRecs ? 'Génération...' : recommendations.length > 0 ? 'Régénérer' : 'Générer des idées'}
                </Text>
              </TouchableOpacity>

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

              {!loadingRecs && recommendations.length > 0 && (
                <View style={styles.recResults}>
                  {recommendations.map((rec, idx) => {
                    const ideaId = getRecIdeaId(rec)
                    const isFav = ideaId ? favoriteIds.has(ideaId) : false
                    const colors = getCategoryColor(rec.categorie)
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={styles.recCard}
                        onPress={() => navigateToRate(rec.titre)}
                        activeOpacity={0.85}
                      >
                        <View style={styles.recHeader}>
                          <View style={{ flex: 1, gap: 4 }}>
                            {rec.categorie && (
                              <View style={[styles.badge, { backgroundColor: colors.bg, alignSelf: 'flex-start' }]}>
                                <Text style={[styles.badgeText, { color: colors.text }]}>{getCategoryLabel(rec.categorie)}</Text>
                              </View>
                            )}
                            <Text style={styles.recTitle}>{rec.titre}</Text>
                          </View>
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
              )}
            </View>
            )}

            {loading && <ActivityIndicator color="#D4517E" style={{ marginTop: 20 }} />}
          </View>
        }
        renderItem={({ item }) => {
          const colors = getCategoryColor(item.categorie)
          const isFav = favoriteIds.has(item.id)
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigateToRate(item.titre)}
              activeOpacity={0.85}
            >
              <View style={styles.cardTop}>
                {item.categorie && (
                  <View style={[styles.badge, { backgroundColor: colors.bg }]}>
                    <Text style={[styles.badgeText, { color: colors.text }]}>{getCategoryLabel(item.categorie)}</Text>
                  </View>
                )}
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
          !loading && selectedCategorie !== FILTER_IA ? (
            <View style={styles.emptyContainer}>
              {searchQuery.trim() ? (
                <>
                  <Text style={styles.emptyIcon}>🔍</Text>
                  <Text style={styles.empty}>Aucune idée ne correspond à "{searchQuery.trim()}"</Text>
                </>
              ) : selectedCategorie === FILTER_FAVORIS ? (
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
  title: { fontSize: 24, fontWeight: '600', color: '#D4517E' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  bellBtn: { padding: 4 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#F0D9D9', gap: 8, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14, color: '#5C4A45', padding: 0 },
  iaTeaser: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF4F7', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#F4C0D1' },
  wishlistTeaser: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#F0D9D9' },
  iaTeaserText: { flex: 1, fontSize: 12, color: '#72243E', lineHeight: 17 },
  iaTeaserLink: { color: '#D4517E', fontWeight: '700' },
  filterRow: { marginBottom: 16, minWidth: 0 },
  errorBanner: { backgroundColor: '#FDE8DE', borderRadius: 10, padding: 12, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  errorBannerText: { color: '#993C1D', fontSize: 13, flex: 1 },
  errorBannerRetry: { color: '#D4517E', fontWeight: '700', fontSize: 13 },
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
  recsSection: {
    marginBottom: 24,
    backgroundColor: '#FFF4F7',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F4C0D1',
  },
  recsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  recsTitle: { fontSize: 15, fontWeight: '700', color: '#5C4A45' },
  recsSubtitle: { fontSize: 12, color: '#888', marginTop: 1 },
  recSegmented: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 4, borderWidth: 1, borderColor: '#F0D9D9', gap: 4 },
  recSegment: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center', gap: 2 },
  recSegmentActive: { backgroundColor: '#D4517E' },
  recSegmentEmoji: { fontSize: 15 },
  recSegmentText: { fontSize: 11, color: '#5C4A45', fontWeight: '600', textAlign: 'center' },
  recSegmentTextActive: { color: '#fff' },
  recModeHint: { fontSize: 12, color: '#888', textAlign: 'center', marginTop: 8, marginBottom: 4 },
  recsButton: { backgroundColor: '#D4517E', borderRadius: 20, paddingVertical: 12, alignItems: 'center', marginTop: 10, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  recsButtonDisabled: { backgroundColor: '#E3C3CE' },
  recsButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  recThemeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  recThemeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#F0D9D9' },
  recThemeChipActive: { backgroundColor: '#FBEAF0', borderColor: '#D4517E' },
  recThemeChipText: { fontSize: 12, color: '#888', fontWeight: '500' },
  recThemeChipTextActive: { color: '#D4517E', fontWeight: '700' },
  recFreeInput: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#F0D9D9', padding: 10, fontSize: 13, color: '#5C4A45', marginTop: 4 },
  recsMessage: { color: '#993556', fontSize: 13, marginTop: 10, textAlign: 'center' },
  thinkingCard: { backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', gap: 12, marginTop: 12, borderWidth: 1, borderColor: '#F4C0D1' },
  thinkingTitle: { fontSize: 16, fontWeight: '700', color: '#D4517E' },
  thinkingSubtext: { fontSize: 13, color: '#72243E', textAlign: 'center', lineHeight: 18 },
  recResults: { marginTop: 14, gap: 8 },
  recCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#F4C0D1' },
  recHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  recTitle: { fontSize: 15, fontWeight: '600', color: '#5C4A45' },
  recReason: { fontSize: 13, color: '#72243E', marginBottom: 6 },
  recCta: { fontSize: 12, color: '#D4517E', fontWeight: '500' },
  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  empty: { color: '#888', textAlign: 'center', fontSize: 15 },
  emptySub: { color: '#B8A9A0', textAlign: 'center', fontSize: 13, marginTop: 4 },
})
