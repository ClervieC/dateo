import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { webContentStyle } from '../lib/webStyles'

const SECTIONS = [
  {
    title: '1. Objet',
    body:
      'Dateo est une application de journal personnel de sorties/rendez-vous ("dates"), permettant de les noter, les partager avec des amis choisis, et suivre des statistiques. L\'utilisation de l\'application implique l\'acceptation pleine et entière des présentes conditions.',
  },
  {
    title: '2. Âge minimum',
    body:
      'L\'inscription est réservée aux personnes âgées d\'au moins 16 ans. En créant un compte, tu confirmes remplir cette condition.',
  },
  {
    title: '3. Compte utilisateur',
    body:
      'Tu es responsable de la confidentialité de tes identifiants et de toute activité effectuée depuis ton compte. Un seul compte par personne ; les comptes créés à des fins frauduleuses ou de harcèlement peuvent être suspendus sans préavis.',
  },
  {
    title: '4. Contenu publié',
    body:
      'Tu restes propriétaire des contenus (textes, photos, commentaires) que tu publies. Tu t\'engages à ne pas publier de contenu illégal, injurieux, diffamatoire, ou portant atteinte aux droits d\'un tiers (notamment le droit à l\'image des personnes mentionnées dans un date). Tu es seul responsable des contenus que tu publies.',
  },
  {
    title: '5. Comportement',
    body:
      'Le harcèlement, les menaces, le spam ou toute utilisation abusive des fonctionnalités sociales (commentaires, mentions, demandes d\'ami) peuvent entraîner un signalement, un blocage par d\'autres utilisateurs, ou la suspension du compte. Un outil de signalement et de blocage est disponible sur chaque profil.',
  },
  {
    title: '6. Données personnelles',
    body:
      'Le traitement de tes données personnelles est décrit dans notre politique de confidentialité, accessible séparément. Tu peux exporter ou supprimer tes données à tout moment depuis les réglages.',
  },
  {
    title: '7. Disponibilité du service',
    body:
      'L\'application est fournie "en l\'état". Nous nous efforçons d\'assurer sa disponibilité mais ne garantissons pas une absence totale d\'interruption ou d\'erreur.',
  },
  {
    title: '8. Résiliation',
    body:
      'Tu peux supprimer ton compte à tout moment depuis les réglages ; cette action est irréversible. Nous nous réservons le droit de suspendre ou supprimer un compte en cas de violation des présentes conditions.',
  },
  {
    title: '9. Modifications',
    body:
      'Ces conditions peuvent évoluer. Toute modification substantielle te sera signalée dans l\'application.',
  },
]

export default function Terms() {
  const router = useRouter()

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color="#D4517E" />
          <Text style={styles.back}>Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Conditions d'utilisation</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, webContentStyle]}>
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            ⚠️ Ce document est un résumé fonctionnel, pas un texte juridique validé par un professionnel du droit.
            Avant publication commerciale, fais relire/rédiger ces conditions par un juriste, en particulier pour la
            conformité RGPD, la modération de contenu et la juridiction applicable.
          </Text>
        </View>

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
  disclaimer: { backgroundColor: '#FFF3D6', borderRadius: 12, padding: 14, marginBottom: 16 },
  disclaimerText: { fontSize: 12, color: '#8A6A1D', lineHeight: 18 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#F0D9D9' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#D4517E', marginBottom: 8 },
  cardBody: { fontSize: 13, color: '#5C4A45', lineHeight: 19 },
})
