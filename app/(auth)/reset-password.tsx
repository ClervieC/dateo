import { useState } from 'react'
import { Text, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { FormField } from '../../lib/FormField'
import { AuthScreen, authStyles } from '../../lib/AuthScreen'
import { MIN_PASSWORD_LENGTH, traduireErreurAuth } from '../../lib/authErrors'
import { t } from '../../lib/i18n'
import { C } from '../../lib/theme'

// Atteint via le lien « Mot de passe oublié » (événement PASSWORD_RECOVERY) :
// l'utilisateur a une session temporaire et doit choisir un nouveau mot de passe.
export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  async function handleSave() {
    setError('')
    if (password.length < MIN_PASSWORD_LENGTH) { setError(t("Au moins {n} caractères", { n: MIN_PASSWORD_LENGTH })); return }
    if (password !== confirm) { setError(t("Les deux mots de passe ne correspondent pas")); return }

    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (updateError) {
      setError(updateError.message.toLowerCase().includes('session')
        ? t("Ce lien a expiré. Redemande un email depuis « Mot de passe oublié ».")
        : traduireErreurAuth(updateError.message))
      return
    }
    router.replace('/(tabs)/feed')
  }

  return (
    <AuthScreen title={t("Nouveau mot de passe")} subtitle={t("Choisis un nouveau mot de passe pour ton compte")} compactLogo>
      <FormField
        label={t("Nouveau mot de passe")}
        placeholder={t("{n} caractères minimum", { n: MIN_PASSWORD_LENGTH })}
        value={password}
        onChangeText={setPassword}
        password
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        autoFocus
      />
      <FormField
        label={t("Confirme le mot de passe")}
        placeholder={t("Retape-le")}
        value={confirm}
        onChangeText={setConfirm}
        password
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={handleSave}
      />
      {error ? <Text style={authStyles.formError}>{error}</Text> : null}
      <TouchableOpacity style={[authStyles.button, saving && authStyles.buttonDisabled]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color={C.onPrimary} /> : <Text style={authStyles.buttonText}>{t("Enregistrer")}</Text>}
      </TouchableOpacity>
    </AuthScreen>
  )
}
