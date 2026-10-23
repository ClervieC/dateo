import { useRef, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { usernameValide } from '../../lib/friendsUtils'
import { BirthdateField } from '../../lib/BirthdateField'
import { FormField } from '../../lib/FormField'
import { AuthScreen, authStyles } from '../../lib/AuthScreen'
import { useUsernameCheck } from '../../lib/useUsernameCheck'
import { MIN_AGE, MIN_PASSWORD_LENGTH, computeAge, emailValide, traduireErreurAuth } from '../../lib/authErrors'
import { t } from '../../lib/i18n'
import { C, themedStyles } from '../../lib/theme'

type Errors = Partial<Record<'email' | 'password' | 'username' | 'birthdate' | 'terms', string>>

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [dateNaissance, setDateNaissance] = useState<string | null>(null)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState('')
  const router = useRouter()
  const passwordRef = useRef<TextInput>(null)
  const usernameRef = useRef<TextInput>(null)
  const usernameCheck = useUsernameCheck(username)

  function validate(): Errors {
    const errors: Errors = {}
    if (!email.trim()) errors.email = t("Indique ton email")
    else if (!emailValide(email)) errors.email = t("Cette adresse email n'est pas valide")
    if (password.length < MIN_PASSWORD_LENGTH) errors.password = t("Au moins {n} caractères", { n: MIN_PASSWORD_LENGTH })
    const u = usernameValide(username)
    if (!u.valide) errors.username = u.message
    else if (usernameCheck.status === 'taken') errors.username = usernameCheck.message
    if (!dateNaissance) errors.birthdate = t("Indique ta date de naissance complète")
    else if (computeAge(dateNaissance) < MIN_AGE) errors.birthdate = t("Tu dois avoir au moins {n} ans pour utiliser Dateo", { n: MIN_AGE })
    if (!termsAccepted) errors.terms = t("Tu dois accepter les conditions pour continuer")
    return errors
  }

  // Les erreurs ne s'affichent qu'après une première tentative, puis se mettent à jour en direct
  const errors = submitted ? validate() : {}

  async function handleSignup() {
    setSubmitted(true)
    setFormError('')
    if (Object.keys(validate()).length > 0 || saving) return

    setSaving(true)
    const trimmedUsername = username.trim()
    const termsAcceptedAt = new Date().toISOString()

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        // Conservés côté auth pour pouvoir compléter le profil après confirmation de l'email
        data: { username: trimmedUsername, date_naissance: dateNaissance, terms_accepted_at: termsAcceptedAt },
        emailRedirectTo: Platform.OS === 'web' ? window.location.origin : undefined,
      },
    })

    if (signUpError) {
      setSaving(false)
      setFormError(traduireErreurAuth(signUpError.message))
      return
    }

    // Email déjà utilisé avec confirmation activée : Supabase ne renvoie pas d'erreur
    // mais un utilisateur sans identité.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setSaving(false)
      setFormError(t("Un compte existe déjà avec cet email. Connecte-toi plutôt."))
      return
    }

    if (!data.session) {
      setSaving(false)
      setConfirmationSentTo(email.trim())
      return
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ username: trimmedUsername, date_naissance: dateNaissance, terms_accepted_at: termsAcceptedAt })
      .eq('id', data.session.user.id)

    setSaving(false)

    if (profileError) {
      // Compte créé mais pseudo refusé (pris entre-temps) : on enregistre le reste et on
      // laisse l'utilisateur en choisir un autre plutôt que de le bloquer.
      await supabase.from('profiles')
        .update({ date_naissance: dateNaissance, terms_accepted_at: termsAcceptedAt })
        .eq('id', data.session.user.id)
      router.replace('/(auth)/username')
      return
    }

    router.replace('/onboarding')
  }

  async function resendConfirmation() {
    if (!confirmationSentTo) return
    setResending(true)
    setResendMsg('')
    const { error } = await supabase.auth.resend({ type: 'signup', email: confirmationSentTo })
    setResending(false)
    setResendMsg(error ? traduireErreurAuth(error.message) : t("Email renvoyé !"))
  }

  if (confirmationSentTo) {
    return (
      <AuthScreen title={t("Vérifie ta boîte mail")} subtitle={t("On a envoyé un lien de confirmation à {email}. Clique dessus puis reviens te connecter.", { email: confirmationSentTo })}>
        <View style={styles.mailIconWrap}>
          <Ionicons name="mail-unread-outline" size={56} color={C.primary} />
        </View>
        {resendMsg ? (
          <Text style={resendMsg === t("Email renvoyé !") ? authStyles.formSuccess : authStyles.formError}>{resendMsg}</Text>
        ) : null}
        <TouchableOpacity style={authStyles.button} onPress={() => router.replace('/(auth)/login')}>
          <Text style={authStyles.buttonText}>{t("J'ai confirmé, me connecter")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.textBtn} onPress={resendConfirmation} disabled={resending}>
          <Text style={styles.textBtnLabel}>{resending ? t("Envoi…") : t("Je n'ai rien reçu, renvoyer l'email")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.textBtn} onPress={() => { setConfirmationSentTo(null); setResendMsg('') }}>
          <Text style={styles.textBtnMuted}>{t("Modifier mon adresse email")}</Text>
        </TouchableOpacity>
      </AuthScreen>
    )
  }

  const usernameHint =
    usernameCheck.status === 'checking' ? t("Vérification…")
    : usernameCheck.status === 'available' ? t("✓ Pseudo disponible")
    : t("Lettres, chiffres, points et _ — visible par tes amis")
  const usernameInlineError = errors.username ?? (usernameCheck.status === 'taken' || (usernameCheck.status === 'invalid' && username.trim().length >= 3) ? usernameCheck.message : undefined)

  return (
    <AuthScreen title={t("Crée ton compte")} subtitle={t("Garde une trace de tous tes dates et partage-les avec tes amis")}>
      <FormField
        label={t("Email")}
        placeholder={t("toi@exemple.com")}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        error={errors.email}
      />
      <FormField
        ref={passwordRef}
        label={t("Mot de passe")}
        placeholder={t("{n} caractères minimum", { n: MIN_PASSWORD_LENGTH })}
        value={password}
        onChangeText={setPassword}
        password
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => usernameRef.current?.focus()}
        error={errors.password}
        hint={password.length > 0 && password.length < MIN_PASSWORD_LENGTH ? t("Encore {n} caractère(s)", { n: MIN_PASSWORD_LENGTH - password.length }) : undefined}
      />
      <FormField
        ref={usernameRef}
        label={t("Pseudo")}
        placeholder={t("ex : clervie.d")}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        returnKeyType="done"
        error={usernameInlineError}
        hint={usernameHint}
        right={usernameCheck.status === 'checking'
          ? <ActivityIndicator size="small" color={C.primary} />
          : usernameCheck.status === 'available'
            ? <Ionicons name="checkmark-circle" size={20} color={C.success} />
            : null}
      />

      <View style={styles.birthWrap}>
        <Text style={styles.label}>{t("Date de naissance")}</Text>
        <BirthdateField value={dateNaissance} onChange={setDateNaissance} minAge={MIN_AGE} maxAge={100} hasError={!!errors.birthdate} />
        {errors.birthdate
          ? <Text style={styles.fieldError}>{errors.birthdate}</Text>
          : <Text style={styles.hint}>{t("Dateo est réservé aux {n} ans et plus. Elle n'est pas affichée sur ton profil.", { n: MIN_AGE })}</Text>}
      </View>

      <TouchableOpacity
        style={styles.termsRow}
        onPress={() => setTermsAccepted((v) => !v)}
        activeOpacity={0.8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: termsAccepted }}
      >
        <Ionicons
          name={termsAccepted ? 'checkbox' : 'square-outline'}
          size={22}
          color={errors.terms ? C.danger : termsAccepted ? C.primary : C.faint}
        />
        <Text style={styles.termsText}>
          {t("J'accepte les")}{' '}
          <Text style={styles.termsLink} onPress={() => router.push('/terms')}>{t("conditions d'utilisation")}</Text>
          {' '}{t("et la")}{' '}
          <Text style={styles.termsLink} onPress={() => router.push('/privacy')}>{t("politique de confidentialité")}</Text>
        </Text>
      </TouchableOpacity>
      {errors.terms ? <Text style={[styles.fieldError, { marginTop: -6, marginBottom: 10 }]}>{errors.terms}</Text> : null}

      {formError ? <Text style={authStyles.formError}>{formError}</Text> : null}

      <TouchableOpacity style={[authStyles.button, saving && authStyles.buttonDisabled]} onPress={handleSignup} disabled={saving}>
        {saving ? <ActivityIndicator color={C.onPrimary} /> : <Text style={authStyles.buttonText}>{t("Créer mon compte")}</Text>}
      </TouchableOpacity>

      <View style={authStyles.secondaryLinkRow}>
        <Text style={authStyles.secondaryText}>{t("Déjà un compte ?")} </Text>
        <Link href="/(auth)/login" replace>
          <Text style={authStyles.secondaryLink}>{t("Connecte-toi")}</Text>
        </Link>
      </View>
    </AuthScreen>
  )
}

const styles = themedStyles(() => ({
  birthWrap: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 6 },
  hint: { color: C.muted, fontSize: 12, marginTop: 4 },
  fieldError: { color: C.danger, fontSize: 12, marginTop: 4 },
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  termsText: { flex: 1, fontSize: 13, color: C.text, lineHeight: 20 },
  termsLink: { color: C.primaryText, fontWeight: '600', textDecorationLine: 'underline' },
  mailIconWrap: { alignItems: 'center', marginBottom: 20 },
  textBtn: { alignItems: 'center', padding: 12, marginTop: 4 },
  textBtnLabel: { color: C.primaryText, fontWeight: '600', fontSize: 14 },
  textBtnMuted: { color: C.muted, fontSize: 13 },
}))
