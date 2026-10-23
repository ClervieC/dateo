import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { webContentStyle } from "../lib/webStyles";
import { ScreenHeader } from "../lib/ScreenHeader";
import { t } from '../lib/i18n'
import { C, themedStyles } from '../lib/theme'

// Page publique, accessible sans connexion (voir la liste PUBLIC_ROUTES dans
// app/_layout.tsx) : les stores (Apple notamment) exigent que les instructions de
// suppression de compte restent consultables même par quelqu'un qui ne peut plus se
// connecter (mot de passe perdu, compte suspendu...).
export default function DeleteAccountInfo() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScreenHeader title={t("Suppression de compte")} />

      <ScrollView contentContainerStyle={[styles.content, webContentStyle]}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("Si tu peux te connecter")}</Text>
          <Text style={styles.cardBody}>
            {t("Va dans Réglages → Zone de danger → « Supprimer mon compte ». La suppression est immédiate et définitive : ton profil, tes dates, tes photos, commentaires, réactions et relations (amis, couple) sont effacés, y compris ce que tu as laissé sur les dates d'autres utilisateurs.")}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("Si tu ne peux pas te connecter")}</Text>
          <Text style={styles.cardBody}>
            {t("Écris-nous à l'adresse ci-dessous depuis l'adresse email associée à ton compte, en précisant ton nom d'utilisateur Dateo. Nous traitons les demandes de suppression sous 30 jours maximum.")}
          </Text>
          <Text style={styles.contactEmail}>clervie@bluedays.com</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("Ce qui est supprimé")}</Text>
          <Text style={styles.cardBody}>
            {t("Profil, dates enregistrés, photos, commentaires, réactions, favoris, lieux à essayer, relation en couple, liste d'amis, et le compte d'authentification lui-même. La suppression est irréversible.")}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: { flexDirection: "row", alignItems: "center", width: 80 },
  back: { color: C.primaryText, fontSize: 16, fontWeight: "500" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: C.text },
  content: { padding: 20, paddingBottom: 60 },
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: C.primaryText,
    marginBottom: 8,
  },
  cardBody: { fontSize: 13, color: C.text, lineHeight: 19 },
  contactEmail: {
    fontSize: 14,
    color: C.primaryText,
    fontWeight: "700",
    marginTop: 10,
  },
}));
