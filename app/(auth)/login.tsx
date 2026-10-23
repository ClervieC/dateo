import { useRef, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native'
import { Link } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { FormField } from '../../lib/FormField'
import { AuthScreen, authStyles } from '../../lib/AuthScreen'
import { emailValide, traduireErreurAuth } from '../../lib/authErrors'
import { t } from '../../lib/i18n'
import { C, themedStyles } from '../../lib/theme'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [loading, setLoading] = useState(false)
  const [info, setInfo] = useState('')
  const [sendingReset, setSendingReset] = useState(false)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const passwordRef = useRef<TextInput>(null)

  async function handleLogin() {
    setError('')
    setInfo('')
    setEmailError('')
    setNeedsConfirmation(false)
    if (!emailValide(email)) { setEmailError(t("Cette adresse email n'est pas valide")); return }
    if (!password) { setError(t("Indique ton mot de passe")); return }

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (error) {
      setError(traduireErreurAuth(error.message))
      setNeedsConfirmation(error.message.toLowerCase().includes('email not confirmed'))
    }
    // Navigation gérée par _layout.tsx après le changement de session
  }

  async function handleForgotPassword() {
    setError('')
    setInfo('')
    if (!emailValide(email)) {
      setEmailError(t("Renseigne ton email ici, puis appuie à nouveau sur « Mot de passe oublié »"))
      return
    }
    setEmailError('')
    setSendingReset(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: Platform.OS === 'web' ? `${window.location.origin}/reset-password` : undefined,
    })
    setSendingReset(false)
    if (error) setError(traduireErreurAuth(error.message))
    else setInfo(t("Si un compte existe pour {email}, tu vas recevoir un lien pour choisir un nouveau mot de passe.", { email: email.trim() }))
  }

  async function resendConfirmation() {
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() })
    if (error) setError(traduireErreurAuth(error.message))
    else { setError(''); setNeedsConfirmation(false); setInfo(t("Email de confirmation renvoyé ! Vérifie ta boîte mail.")) }
  }

  return (
    <AuthScreen title={t("Bon retour 👋")} subtitle={t("Connecte-toi pour retrouver tes dates")}>
      <FormField
        label={t("Email")}
        placeholder={t("toi@exemple.com")}
        value={email}
        onChangeText={(v) => { setEmail(v); setEmailError('') }}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        error={emailError}
      />
      <FormField
        ref={passwordRef}
        label={t("Mot de passe")}
        placeholder={t("Ton mot de passe")}
        value={password}
        onChangeText={setPassword}
        password
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={handleLogin}
      />

      <TouchableOpacity onPress={handleForgotPassword} disabled={sendingReset} style={styles.forgotLink}>
        <Text style={styles.forgotText}>{sendingReset ? t("Envoi…") : t("Mot de passe oublié ?")}</Text>
      </TouchableOpacity>

      {error ? <Text style={authStyles.formError}>{error}</Text> : null}
      {needsConfirmation ? (
        <TouchableOpacity onPress={resendConfirmation} style={styles.resendBtn}>
          <Text style={styles.forgotText}>{t("Renvoyer l'email de confirmation")}</Text>
        </TouchableOpacity>
      ) : null}
      {info ? <Text style={authStyles.formSuccess}>{info}</Text> : null}

      <TouchableOpacity style={[authStyles.button, loading && authStyles.buttonDisabled]} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color={C.onPrimary} /> : <Text style={authStyles.buttonText}>{t("Se connecter")}</Text>}
      </TouchableOpacity>

      <View style={authStyles.secondaryLinkRow}>
        <Text style={authStyles.secondaryText}>{t("Pas encore de compte ?")} </Text>
        <Link href="/(auth)/signup" replace>
          <Text style={authStyles.secondaryLink}>{t("Inscris-toi")}</Text>
        </Link>
      </View>

      <Link href="/delete-account-info" style={styles.deleteLink}>
        <Text>{t("Supprimer mon compte")}</Text>
      </Link>
    </AuthScreen>
  )
}

const styles = themedStyles(() => ({
  forgotLink: { alignSelf: 'flex-end', marginTop: -6, marginBottom: 14, paddingVertical: 4 },
  forgotText: { color: C.primaryText, fontSize: 13, fontWeight: '600' },
  resendBtn: { alignSelf: 'center', marginBottom: 12, padding: 4 },
  deleteLink: { alignSelf: 'center', marginTop: 28, color: C.faint, fontSize: 12 },
}))
