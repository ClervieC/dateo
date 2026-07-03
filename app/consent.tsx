import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { webContentStyle } from '../lib/webStyles'

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
    if (updateError) { setError(`Erreur : ${updateError.message}`); return }
    router.replace('/(tabs)/feed')
  }

  async function decline() {
    await supabase.auth.signOut()
    router.replace('/(auth)/login')
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.content, webContentStyle]}>
        <Text style={styles.title}>Avant de continuer</Text>
        <Text style={styles.subtitle}>
          Pour utiliser Dateo, tu dois accepter nos conditions d'utilisation et notre politique de confidentialité.
        </Text>

        <TouchableOpacity style={styles.linkCard} onPress={() => router.push('/terms')}>
          <Text style={styles.linkCardText}>📄 Lire les conditions d'utilisation (CGU)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkCard} onPress={() => router.push('/privacy')}>
          <Text style={styles.linkCardText}>🔒 Lire la politique de confidentialité</Text>
        </TouchableOpacity>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.acceptButton} onPress={accept} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.acceptButtonText}>J'accepte et je continue</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.declineButton} onPress={decline} disabled={saving}>
          <Text style={styles.declineButtonText}>Je refuse (déconnexion)</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF8F5' },
  content: { padding: 24, paddingTop: 60, paddingBottom: 60, flexGrow: 1, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: '#D4517E', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 14, color: '#5C4A45', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  linkCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#F0D9D9' },
  linkCardText: { fontSize: 14, color: '#5C4A45', fontWeight: '600', textAlign: 'center' },
  error: { color: '#D85A30', textAlign: 'center', marginTop: 8 },
  acceptButton: { backgroundColor: '#D4517E', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20 },
  acceptButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  declineButton: { padding: 14, alignItems: 'center', marginTop: 4 },
  declineButtonText: { color: '#888', fontWeight: '600', fontSize: 14 },
})
