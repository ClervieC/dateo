import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Image, ActivityIndicator } from 'react-native'
import { Link } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { webFormStyle, webAuthCardStyle } from '../../lib/webStyles'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [sendingReset, setSendingReset] = useState(false)

  async function handleLogin() {
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
    // Navigation handled by _layout.tsx after session change
  }

  async function handleForgotPassword() {
    setError('')
    if (!email.trim()) {
      setError('Renseigne ton email ci-dessus puis appuie sur "Mot de passe oublié"')
      return
    }
    setSendingReset(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim())
    setSendingReset(false)
    if (error) setError(error.message)
    else setResetSent(true)
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.outer}>
        <View style={[styles.form, webFormStyle, webAuthCardStyle]}>
          <Image source={require('../../assets/logoVertical.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.subtitle}>Connecte-toi pour continuer</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#B8A9A0"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Mot de passe"
            placeholderTextColor="#B8A9A0"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {resetSent ? <Text style={styles.success}>Email envoyé ! Vérifie ta boîte mail.</Text> : null}

          <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Se connecter</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={handleForgotPassword} disabled={sendingReset} style={styles.forgotLink}>
            <Text style={styles.forgotText}>{sendingReset ? 'Envoi...' : 'Mot de passe oublié ?'}</Text>
          </TouchableOpacity>

          <Link href="/(auth)/signup" style={styles.link}>
            <Text>Pas encore de compte ? Inscris-toi</Text>
          </Link>

          <Link href="/delete-account-info" style={styles.deleteLink}>
            <Text>Supprimer mon compte</Text>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  outer: { flex: 1, justifyContent: 'center', backgroundColor: '#FFF8F5' },
  form: { padding: 24 },
  logo: { height: 140, width: 118, maxWidth: '100%', alignSelf: 'center', marginBottom: 8 },
  title: { fontSize: 32, fontWeight: '600', color: '#D4517E', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 32 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#F0D9D9' },
  button: { backgroundColor: '#D4517E', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  link: { marginTop: 20, alignSelf: 'center' },
  error: { color: '#D85A30', textAlign: 'center', marginBottom: 8 },
  success: { color: '#3B6D11', textAlign: 'center', marginBottom: 8 },
  forgotLink: { alignSelf: 'center', marginTop: 14 },
  forgotText: { color: '#D4517E', fontSize: 13, fontWeight: '500' },
  deleteLink: { alignSelf: 'center', marginTop: 18, color: '#B8A9A0', fontSize: 12 },
})
