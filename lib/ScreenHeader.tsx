import { ReactNode } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, Href } from 'expo-router'
import { t } from './i18n'

// router.back() ne fait rien quand l'écran a été ouvert directement (notification,
// lien, page web rechargée) : on retombe alors sur un écran de repli.
export function useGoBack(fallback: Href = '/') {
  const router = useRouter()
  return () => {
    if (router.canGoBack()) router.back()
    else router.replace(fallback)
  }
}

type Props = {
  title?: string
  right?: ReactNode
  fallback?: Href
  bordered?: boolean
}

// En-tête commun des écrans secondaires : retour à gauche, titre centré (tronqué
// s'il est trop long), action optionnelle à droite.
export function ScreenHeader({ title, right, fallback = '/', bordered = true }: Props) {
  const goBack = useGoBack(fallback)
  return (
    <View style={[styles.header, bordered && styles.bordered]}>
      <TouchableOpacity
        onPress={goBack}
        style={styles.side}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={t("Retour")}
      >
        <Ionicons name="chevron-back" size={22} color="#D4517E" />
        <Text style={styles.back}>{t("Retour")}</Text>
      </TouchableOpacity>
      {title ? <Text style={styles.title} numberOfLines={1} accessibilityRole="header">{title}</Text> : <View style={{ flex: 1 }} />}
      <View style={[styles.side, styles.sideRight]}>{right}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, minHeight: 52, backgroundColor: '#FFF8F5' },
  bordered: { borderBottomWidth: 1, borderBottomColor: '#F0D9D9' },
  side: { width: 92, flexDirection: 'row', alignItems: 'center' },
  sideRight: { justifyContent: 'flex-end', gap: 4 },
  back: { color: '#D4517E', fontSize: 16, fontWeight: '500' },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#5C4A45' },
})
