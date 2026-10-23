import { ReactNode } from 'react'
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Image, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { webFormStyle, webAuthCardStyle } from './webStyles'
import { LanguageSwitcher } from './LanguageSwitcher'

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
          <View style={[webFormStyle, webAuthCardStyle, Platform.OS === 'web' && width < 500 && styles.cardCompact]}>
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

export const authStyles = StyleSheet.create({
  button: { backgroundColor: '#D4517E', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondaryLinkRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginTop: 24 },
  secondaryText: { color: '#888', fontSize: 14 },
  secondaryLink: { color: '#D4517E', fontSize: 14, fontWeight: '700' },
  formError: { backgroundColor: '#FDE8DE', color: '#993C1D', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 13, textAlign: 'center', overflow: 'hidden' },
  formSuccess: { backgroundColor: '#E7F3DD', color: '#3B6D11', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 13, textAlign: 'center', overflow: 'hidden' },
})

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF8F5' },
  // Sur le web, la carte blanche ne colle pas aux bords de l'écran (mobile)
  scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: 24, paddingHorizontal: Platform.OS === 'web' ? 16 : 0 },
  // Sur petit écran web, 40px de padding interne laisse trop peu de place aux champs
  cardCompact: { padding: 24, borderRadius: 20 },
  langSwitcher: { alignSelf: 'flex-end', marginBottom: 4 },
  logo: { height: 110, width: 93, maxWidth: '100%', alignSelf: 'center', marginBottom: 12 },
  logoCompact: { height: 72, width: 61, maxWidth: '100%', alignSelf: 'center', marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', color: '#D4517E', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#888', textAlign: 'center', marginTop: 6, marginBottom: 24, lineHeight: 20 },
})
