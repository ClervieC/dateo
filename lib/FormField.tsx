import { forwardRef, useState, ReactNode } from 'react'
import { View, Text, TextInput, TextInputProps, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { t } from './i18n'

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
          placeholderTextColor="#B8A9A0"
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
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color="#B8A9A0" />
          </TouchableOpacity>
        )}
        {right}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  )
})

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#5C4A45', marginBottom: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#F0D9D9' },
  inputRowFocused: { borderColor: '#D4517E' },
  inputRowError: { borderColor: '#D85A30' },
  input: { flex: 1, paddingVertical: 14, fontSize: 16, color: '#5C4A45', minWidth: 0 },
  error: { color: '#D85A30', fontSize: 12, marginTop: 4 },
  hint: { color: '#888', fontSize: 12, marginTop: 4 },
})
