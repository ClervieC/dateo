import { ReactNode } from 'react'
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Image, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { webFormStyle } from './webStyles'
import { LanguageSwitcher } from './LanguageSwitcher'
import { C, themedStyles } from './theme'

// Squelette commun des écrans d'authentification : scrollable (le clavier ne masque
// plus le bouton sur petit écran), logo + titre + sous-titre.
export function AuthScreen({ title, subtitle, children, compactLogo }: {
  title: string
  subtitle?: string
  children: ReactNode
  compactLogo?: boolean
}) {
  const { width } = useWindowDimensions()
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[webFormStyle, styles.card, Platform.OS === 'web' && width < 500 && styles.cardCompact]}>
            <LanguageSwitcher style={styles.langSwitcher} />
            <Image
              source={require('../assets/logoVertical.png')}
              style={compactLogo ? styles.logoCompact : styles.logo}
              resizeMode="contain"
              accessibilityLabel="Dateo"
            />
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

export const authStyles = themedStyles(() => ({
  button: { backgroundColor: C.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: C.onPrimary, fontWeight: '700', fontSize: 16 },
  secondaryLinkRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginTop: 24 },
  secondaryText: { color: C.muted, fontSize: 14 },
  secondaryLink: { color: C.primaryText, fontSize: 14, fontWeight: '700' },
  formError: { backgroundColor: C.errorBg, color: C.errorText, borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 13, textAlign: 'center', overflow: 'hidden' },
  formSuccess: { backgroundColor: C.successBg, color: C.success, borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 13, textAlign: 'center', overflow: 'hidden' },
}))

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: C.bg },
  // Sur le web, la carte blanche ne colle pas aux bords de l'écran (mobile)
  scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: 24, paddingHorizontal: Platform.OS === 'web' ? 16 : 0 },
  // Sur petit écran web, 40px de padding interne laisse trop peu de place aux champs
  // Carte blanche sur le web (couleur du thème) ; simple marge en natif
  card: Platform.OS === 'web'
    ? { backgroundColor: C.card, borderRadius: 16, padding: 40, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 24, shadowOffset: { width: 0, height: 4 } }
    : { padding: 24 },
  cardCompact: { padding: 24, borderRadius: 20 },
  langSwitcher: { alignSelf: 'flex-end', marginBottom: 4 },
  logo: { height: 110, width: 93, maxWidth: '100%', alignSelf: 'center', marginBottom: 12 },
  logoCompact: { height: 72, width: 61, maxWidth: '100%', alignSelf: 'center', marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', color: C.primaryText, textAlign: 'center' },
  subtitle: { fontSize: 14, color: C.muted, textAlign: 'center', marginTop: 6, marginBottom: 24, lineHeight: 20 },
}))
