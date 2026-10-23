import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { webContentStyle } from '../lib/webStyles'
import { t } from '../lib/i18n'
import { C, themedStyles } from '../lib/theme'

export default function Consent() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function accept() {
    setSaving(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ terms_accepted_at: new Date().toISOString() })
      .eq('id', user.id)

    setSaving(false)
    if (updateError) { setError(t("Erreur : {message}", { message: updateError.message })); return }
    router.replace('/(tabs)/feed')
  }

  async function decline() {
    await supabase.auth.signOut()
    router.replace('/(auth)/login')
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.content, webContentStyle]}>
        <Text style={styles.title}>{t("Avant de continuer")}</Text>
        <Text style={styles.subtitle}>
          {t("Pour utiliser Dateo, tu dois accepter nos conditions d'utilisation et notre politique de confidentialité.")}
        </Text>

        <TouchableOpacity style={styles.linkCard} onPress={() => router.push('/terms')}>
          <Text style={styles.linkCardText}><Ionicons name="document-text-outline" size={15} color={C.primaryText} /> {t("Lire les conditions d'utilisation (CGU)")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkCard} onPress={() => router.push('/privacy')}>
          <Text style={styles.linkCardText}><Ionicons name="lock-closed-outline" size={15} color={C.primaryText} /> {t("Lire la politique de confidentialité")}</Text>
        </TouchableOpacity>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.acceptButton} onPress={accept} disabled={saving}>
          {saving ? <ActivityIndicator color={C.onPrimary} /> : <Text style={styles.acceptButtonText}>{t("J'accepte et je continue")}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.declineButton} onPress={decline} disabled={saving}>
          <Text style={styles.declineButtonText}>{t("Je refuse (déconnexion)")}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = themedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: C.bg },
  content: { padding: 24, paddingTop: 60, paddingBottom: 60, flexGrow: 1, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: C.primaryText, textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 14, color: C.text, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  linkCard: { backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  linkCardText: { fontSize: 14, color: C.text, fontWeight: '600', textAlign: 'center' },
  error: { color: C.danger, textAlign: 'center', marginTop: 8 },
  acceptButton: { backgroundColor: C.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20 },
  acceptButtonText: { color: C.onPrimary, fontWeight: '700', fontSize: 16 },
  declineButton: { padding: 14, alignItems: 'center', marginTop: 4 },
  declineButtonText: { color: C.muted, fontWeight: '600', fontSize: 14 },
}))
