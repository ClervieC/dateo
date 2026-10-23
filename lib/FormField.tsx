import { forwardRef, useState, ReactNode } from 'react'
import { View, Text, TextInput, TextInputProps, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { t } from './i18n'
import { C, themedStyles } from './theme'

type Props = TextInputProps & {
  label: string
  error?: string
  hint?: string
  // Affiche l'œil pour révéler/masquer le mot de passe
  password?: boolean
  right?: ReactNode
}

export const FormField = forwardRef<TextInput, Props>(function FormField(
  { label, error, hint, password, right, style, ...inputProps },
  ref,
) {
  const [hidden, setHidden] = useState(true)
  const [focused, setFocused] = useState(false)

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, focused && styles.inputRowFocused, !!error && styles.inputRowError]}>
        <TextInput
          ref={ref}
          style={[styles.input, style]}
          placeholderTextColor={C.faint}
          secureTextEntry={password ? hidden : undefined}
          accessibilityLabel={label}
          {...inputProps}
          onFocus={(e) => { setFocused(true); inputProps.onFocus?.(e) }}
          onBlur={(e) => { setFocused(false); inputProps.onBlur?.(e) }}
        />
        {password && (
          <TouchableOpacity
            onPress={() => setHidden((h) => !h)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={hidden ? t("Afficher le mot de passe") : t("Masquer le mot de passe")}
          >
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={C.faint} />
          </TouchableOpacity>
        )}
        {right}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  )
})

const styles = themedStyles(() => ({
  wrap: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: C.border },
  inputRowFocused: { borderColor: C.primary },
  inputRowError: { borderColor: C.danger },
  input: { flex: 1, paddingVertical: 14, fontSize: 16, color: C.text, minWidth: 0 },
  error: { color: C.danger, fontSize: 12, marginTop: 4 },
  hint: { color: C.muted, fontSize: 12, marginTop: 4 },
}))
