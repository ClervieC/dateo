import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { webContentStyle } from '../lib/webStyles'
import { ScreenHeader } from '../lib/ScreenHeader'
import { t, getLang } from '../lib/i18n'
import { C, themedStyles } from '../lib/theme'

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

// Version anglaise des conditions (même structure que SECTIONS)
const SECTIONS_EN = [
  {
    title: '1. Purpose',
    body:
      'Dateo is a personal journal for outings and dates, letting you rate them, share them with friends you choose, and track statistics. Using the app means you fully accept these terms.',
  },
  {
    title: '2. Minimum age',
    body:
      'Sign-up is restricted to people aged 16 or over. By creating an account, you confirm that you meet this requirement.',
  },
  {
    title: '3. User account',
    body:
      'You are responsible for keeping your login details confidential and for any activity carried out from your account. One account per person; accounts created for fraud or harassment may be suspended without notice.',
  },
  {
    title: '4. Published content',
    body:
      'You remain the owner of the content (text, photos, comments) you publish. You agree not to publish content that is illegal, abusive, defamatory, or that infringes the rights of others (including the image rights of people mentioned in a date). You are solely responsible for the content you publish.',
  },
  {
    title: '5. Behavior',
    body:
      'Harassment, threats, spam or any misuse of the social features (comments, mentions, friend requests) may lead to a report, being blocked by other users, or account suspension. A report and block tool is available on every profile.',
  },
  {
    title: '6. Personal data',
    body:
      'How your personal data is processed is described in our privacy policy, available separately. You can export or delete your data at any time from the settings.',
  },
  {
    title: '7. Service availability',
    body:
      'The app is provided "as is". We do our best to keep it available but cannot guarantee it will be completely free of interruptions or errors.',
  },
  {
    title: '8. Termination',
    body:
      'You can delete your account at any time from the settings; this cannot be undone. We reserve the right to suspend or delete an account that breaches these terms.',
  },
  {
    title: '9. Changes',
    body:
      'These terms may change. You will be notified in the app of any substantial change.',
  },
]

export default function Terms() {
  const sections = getLang() === 'en' ? SECTIONS_EN : SECTIONS
  const router = useRouter()

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title={t("Conditions d'utilisation")} />

      <ScrollView contentContainerStyle={[styles.content, webContentStyle]}>
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            {t("⚠️ Ce document est un résumé fonctionnel, pas un texte juridique validé par un professionnel du droit. Avant publication commerciale, fais relire/rédiger ces conditions par un juriste, en particulier pour la conformité RGPD, la modération de contenu et la juridiction applicable.")}
          </Text>
        </View>

        {sections.map((s) => (
          <View key={s.title} style={styles.card}>
            <Text style={styles.cardTitle}>{s.title}</Text>
            <Text style={styles.cardBody}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = themedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 80 },
  back: { color: C.primaryText, fontSize: 16, fontWeight: '500' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  content: { padding: 20, paddingBottom: 60 },
  disclaimer: { backgroundColor: C.warningBg, borderRadius: 12, padding: 14, marginBottom: 16 },
  disclaimerText: { fontSize: 12, color: C.warningText, lineHeight: 18 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  cardTitle: { fontSize: 14, fontWeight: '700', color: C.primaryText, marginBottom: 8 },
  cardBody: { fontSize: 13, color: C.text, lineHeight: 19 },
}))
