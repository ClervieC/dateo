import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { usernameValide } from '../../lib/friendsUtils'
import { webFormStyle, webAuthCardStyle } from '../../lib/webStyles'

export default function UsernameSetup() {
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  async function handleSave() {
    setError('')

    const validation = usernameValide(username)
    if (!validation.valide) {
      setError(validation.message ?? 'Pseudo invalide')
      return
    }

    setSaving(true)

    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username.trim())
      .maybeSingle()

    if (existing) {
      setSaving(false)
      setError('Ce pseudo est déjà pris')
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ username: username.trim() })
      .eq('id', user.id)

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    router.replace('/onboarding')
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.outer}>
        <View style={[styles.form, webFormStyle, webAuthCardStyle]}>
          <Image source={require('../../assets/logoVertical.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>Choisis ton pseudo</Text>
          <Text style={styles.subtitle}>Visible par tes amis sur Dateo</Text>

          <TextInput
            style={styles.input}
            placeholder="ex : clervie.d"
            placeholderTextColor="#B8A9A0"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoFocus
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.button} onPress={handleSave} disabled={saving}>
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Continuer</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  outer: { flex: 1, justifyContent: 'center', backgroundColor: '#FFF8F5' },
  form: { padding: 24 },
  logo: { height: 120, aspectRatio: 555 / 700, alignSelf: 'center', marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '700', color: '#D4517E', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 32 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#F0D9D9', fontSize: 16 },
  button: { backgroundColor: '#D4517E', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  error: { color: '#D85A30', textAlign: 'center', marginBottom: 8 },
})
