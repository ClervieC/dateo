import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Image } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { usernameValide } from '../../lib/friendsUtils'
import { webFormStyle, webAuthCardStyle } from '../../lib/webStyles'

export default function Signup() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [checkingUsername, setCheckingUsername] = useState(false)
  const router = useRouter()

  async function handleSignup() {
    setError('')

    const validation = usernameValide(username)
    if (!validation.valide) {
      setError(validation.message ?? 'Pseudo invalide')
      return
    }

    setCheckingUsername(true)
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username.trim())
      .maybeSingle()
    setCheckingUsername(false)

    if (existing) {
      setError('Ce pseudo est déjà pris')
      return
    }

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })

    if (signUpError) {
      setError(signUpError.message)
      return
    }

    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ username: username.trim() })
        .eq('id', data.user.id)

      if (profileError) {
        setError('Compte créé mais erreur sur le pseudo : ' + profileError.message)
        return
      }
    }

    router.replace('/(tabs)/feed')
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.outer}>
        <View style={[styles.form, webFormStyle, webAuthCardStyle]}>
          <Image source={require('../../assets/logoVertical.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.subtitle}>Crée ton compte</Text>

          <TextInput
            style={styles.input}
            placeholder="Pseudo"
            placeholderTextColor="#B8A9A0"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
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

          <TouchableOpacity style={styles.button} onPress={handleSignup} disabled={checkingUsername}>
            <Text style={styles.buttonText}>{checkingUsername ? '...' : "S'inscrire"}</Text>
          </TouchableOpacity>

          <Link href="/(auth)/login" style={styles.link}>
            <Text>Déjà un compte ? Connecte-toi</Text>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  outer: { flex: 1, justifyContent: 'center', backgroundColor: '#FFF8F5' },
  form: { padding: 24 },
  logo: { height: 140, aspectRatio: 555 / 700, alignSelf: 'center', marginBottom: 8 },
  title: { fontSize: 32, fontWeight: '600', color: '#D4517E', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 32 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#F0D9D9' },
  button: { backgroundColor: '#D4517E', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  link: { marginTop: 20, alignSelf: 'center' },
  error: { color: '#D85A30', textAlign: 'center', marginBottom: 8 },
})
