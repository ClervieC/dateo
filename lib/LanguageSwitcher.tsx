import { View, Text, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native'
import { LANGS, setLang, useLang } from './i18n'

// Sélecteur FR / EN compact (écrans de connexion, paramètres)
export function LanguageSwitcher({ style }: { style?: StyleProp<ViewStyle> }) {
  const lang = useLang()
  return (
    <View style={[styles.wrap, style]} accessibilityRole="radiogroup">
      {LANGS.map((l) => {
        const active = l.key === lang
        return (
          <TouchableOpacity
            key={l.key}
            style={[styles.option, active && styles.optionActive]}
            onPress={() => setLang(l.key)}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={l.label}
          >
            <Text style={styles.flag}>{l.flag}</Text>
            <Text style={[styles.label, active && styles.labelActive]}>{l.key.toUpperCase()}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignSelf: 'center', backgroundColor: '#fff', borderRadius: 20, padding: 3, borderWidth: 1, borderColor: '#F0D9D9' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 16 },
  optionActive: { backgroundColor: '#FDE8F0' },
  flag: { fontSize: 14 },
  label: { fontSize: 12, fontWeight: '600', color: '#B8A9A0' },
  labelActive: { color: '#D4517E' },
})
