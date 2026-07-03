import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { webContentStyle } from '../lib/webStyles'

const SECTIONS = [
  {
    title: 'Quelles données sont collectées',
    body:
      'Ton adresse email et un nom d\'utilisateur (compte). Les dates que tu enregistres : lieu, date, notes, commentaire, photos, catégorie. ' +
      'Optionnellement : ta ville (pour te proposer des idées de dates locales) et un objectif mensuel. ' +
      'Les interactions avec tes amis : commentaires, mentions, réactions ("j\'aime"), favoris, demandes d\'amis, relation en couple. ' +
      'Un jeton de notification push (Expo), utilisé uniquement pour t\'envoyer des alertes liées à ton activité.',
  },
  {
    title: 'Pourquoi ces données',
    body:
      'Elles servent uniquement au fonctionnement de l\'app : afficher ton journal de dates, ton feed d\'amis, tes statistiques et badges, ' +
      't\'envoyer une notification quand quelqu\'un interagit avec toi, et te proposer des recommandations basées sur tes préférences passées.',
  },
  {
    title: 'Qui peut voir quoi',
    body:
      'Un date est visible par tes amis seulement si tu le mets en visibilité "Amis" — sinon il reste privé, visible par toi seul. ' +
      'Ton email, ton jeton de notification et les détails de comptes tiers ne sont jamais partagés avec d\'autres utilisateurs. ' +
      'Ton nom d\'utilisateur et ta photo de profil sont visibles par les personnes avec qui tu es en relation (amis, couple) ou dans le contexte d\'un date partagé.',
  },
  {
    title: 'Où sont stockées les données',
    body:
      'Toutes les données sont hébergées chez Supabase (base de données Postgres et stockage de fichiers), avec un accès protégé par authentification et des règles de sécurité au niveau des lignes (Row Level Security).',
  },
  {
    title: 'Tes droits',
    body:
      'Tu peux à tout moment exporter l\'intégralité de tes données personnelles (Réglages → Export complet), ou supprimer définitivement ton compte et toutes les données associées (Réglages → Supprimer mon compte). ' +
      'La suppression est irréversible et efface aussi ce que tu as laissé sur les dates d\'autres utilisateurs (commentaires, réactions, favoris).',
  },
  {
    title: 'Notifications',
    body:
      'Les notifications push sont optionnelles et liées à l\'autorisation que tu donnes à ton appareil. Tu peux les désactiver à tout moment depuis les réglages de ton téléphone.',
  },
]

export default function Privacy() {
  const router = useRouter()

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color="#D4517E" />
          <Text style={styles.back}>Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confidentialité</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, webContentStyle]}>
        <Text style={styles.intro}>
          Dateo est un journal de dates personnel, pensé pour rester privé par défaut. Voici, en clair, ce qui est collecté et comment c'est utilisé.
        </Text>

        {SECTIONS.map((s) => (
          <View key={s.title} style={styles.card}>
            <Text style={styles.cardTitle}>{s.title}</Text>
            <Text style={styles.cardBody}>{s.body}</Text>
          </View>
        ))}
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
  intro: { fontSize: 14, color: '#5C4A45', lineHeight: 20, marginBottom: 16 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#F0D9D9' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#D4517E', marginBottom: 8 },
  cardBody: { fontSize: 13, color: '#5C4A45', lineHeight: 19 },
})
