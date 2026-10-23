import { useState } from 'react'
import { Text, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { usernameValide } from '../../lib/friendsUtils'
import { FormField } from '../../lib/FormField'
import { AuthScreen, authStyles } from '../../lib/AuthScreen'
import { useUsernameCheck } from '../../lib/useUsernameCheck'
import { t } from '../../lib/i18n'
import { C } from '../../lib/theme'

export default function UsernameSetup() {
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const check = useUsernameCheck(username)

  async function handleSave() {
    setError('')
    const validation = usernameValide(username)
    if (!validation.valide) { setError(validation.message ?? t("Pseudo invalide")); return }
    if (check.status === 'taken') { setError(check.message); return }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); router.replace('/(auth)/login'); return }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ username: username.trim() })
      .eq('id', user.id)

    setSaving(false)
    if (updateError) {
      setError(updateError.code === '23505' ? t("Ce pseudo est déjà pris") : t("Impossible d'enregistrer ton pseudo, réessaie."))
      return
    }
    router.replace('/onboarding')
  }

  const hint =
    check.status === 'checking' ? t("Vérification…")
    : check.status === 'available' ? t("✓ Pseudo disponible")
    : t("Lettres, chiffres, points et _ — 3 caractères minimum")

  return (
    <AuthScreen title={t("Choisis ton pseudo")} subtitle={t("C'est grâce à lui que tes amis te retrouveront sur Dateo")} compactLogo>
      <FormField
        label={t("Pseudo")}
        placeholder={t("ex : clervie.d")}
        value={username}
        onChangeText={(v) => { setUsername(v); setError('') }}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={handleSave}
        error={error || (check.status === 'taken' || (check.status === 'invalid' && username.trim().length >= 3) ? check.message : undefined)}
        hint={hint}
        right={check.status === 'checking'
          ? <ActivityIndicator size="small" color={C.primary} />
          : check.status === 'available' ? <Ionicons name="checkmark-circle" size={20} color={C.success} /> : null}
      />

      <TouchableOpacity
        style={[authStyles.button, (saving || check.status === 'taken') && authStyles.buttonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? <ActivityIndicator color={C.onPrimary} /> : <Text style={authStyles.buttonText}>{t("Continuer")}</Text>}
      </TouchableOpacity>
    </AuthScreen>
  )
}
