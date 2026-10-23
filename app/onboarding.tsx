import { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { t, tKey } from '../lib/i18n'

const STEPS = [
  {
    emoji: "❤️",
    title: tKey("Note tes dates"),
    subtitle:
      tKey("Après chaque sortie, donne une note sur 20 et détaille ce qui t'a plu : ambiance, nourriture, conversation…"),
  },
  {
    emoji: "📸",
    title: tKey("Garde tes souvenirs"),
    subtitle:
      tKey("Ajoute jusqu'à 10 photos et un petit mot. Tout ton historique est rangé dans ton profil, en liste ou en calendrier."),
  },
  {
    emoji: "👫",
    title: tKey("Partage avec tes amis"),
    subtitle:
      tKey("Ajoute tes amis pour voir leurs meilleurs dates dans le feed. Chaque date peut aussi rester privé."),
  },
  {
    emoji: "💑",
    title: tKey("En couple ou entre amis"),
    subtitle:
      tKey("Lie ton compte à celui de ton/ta partenaire pour tout partager, ou indique simplement avec qui tu étais."),
  },
  {
    emoji: "💡",
    title: tKey("Trouve l'inspiration"),
    subtitle:
      tKey("Laisse l'IA te proposer des idées selon tes goûts, un thème ou ta ville, et garde une liste de lieux à essayer."),
  },
];

export default function Onboarding() {
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);
  const router = useRouter();
  const { width } = useWindowDimensions();

  function goNext() {
    if (index < STEPS.length - 1) {
      const next = index + 1;
      listRef.current?.scrollToIndex({ index: next, animated: true });
      setIndex(next);
    } else {
      router.replace("/(tabs)/rate");
    }
  }

  function goBack() {
    if (index === 0) return;
    const prev = index - 1;
    listRef.current?.scrollToIndex({ index: prev, animated: true });
    setIndex(prev);
  }

  function skip() {
    router.replace("/(tabs)/feed");
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        {index < STEPS.length - 1 ? (
          <TouchableOpacity
            onPress={skip}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.skipText}>{t("Passer")}</Text>
          </TouchableOpacity>
        ) : (
          <View />
        )}
      </View>
      <FlatList
        ref={listRef}
        data={STEPS}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        getItemLayout={(_, i) => ({
          length: width,
          offset: width * i,
          index: i,
        })}
        onMomentumScrollEnd={(e) => {
          const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
          setIndex(newIndex);
        }}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={styles.slideContent}>
              <Text style={styles.emoji}>{item.emoji}</Text>
              <Text style={styles.title}>{t(item.title)}</Text>
              <Text style={styles.subtitle}>{t(item.subtitle)}</Text>
            </View>
          </View>
        )}
      />

      <View style={styles.dots}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryBtn} onPress={goNext}>
          <Text style={styles.primaryBtnText}>
            {index === STEPS.length - 1 ? t("Noter mon premier date") : t("Suivant")}
          </Text>
        </TouchableOpacity>
        {index === STEPS.length - 1 && (
          <TouchableOpacity style={styles.skipBtn} onPress={skip}>
            <Text style={styles.secondaryCta}>{t("Plus tard, découvrir l'app")}</Text>
          </TouchableOpacity>
        )}
        <View style={styles.secondaryRow}>
          {index > 0 && (
            <TouchableOpacity style={styles.skipBtn} onPress={goBack}>
              <Text style={styles.skipText}>{t("← Précédent")}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF8F5" },
  topBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 24,
    paddingTop: 8,
    minHeight: 36,
  },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  slideContent: { maxWidth: 480, width: "100%", alignItems: "center" },
  emoji: { fontSize: 72, marginBottom: 24 },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#D4517E",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 16,
    color: "#888",
    textAlign: "center",
    lineHeight: 24,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 20,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#F0D9D9" },
  dotActive: { backgroundColor: "#D4517E", width: 24 },
  actions: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 6,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
  },
  primaryBtn: {
    backgroundColor: "#D4517E",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 17 },
  secondaryRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    minHeight: 44,
  },
  skipBtn: { alignItems: "center", padding: 10 },
  skipText: { color: "#B8A9A0", fontSize: 15 },
  secondaryCta: { color: "#D4517E", fontSize: 15, fontWeight: "600" },
});
