import { View, Text, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native'
import { LANGS, setLang, useLang } from './i18n'
import { C, themedStyles } from './theme'

// Sélecteur FR / EN compact (écrans de connexion, paramètres). Pas de drapeaux :
// Windows ne les affiche pas (« FR FR » / « GB EN »).
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
            <Text style={[styles.label, active && styles.labelActive]}>{l.key.toUpperCase()}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = themedStyles(() => ({
  wrap: { flexDirection: 'row', alignSelf: 'center', backgroundColor: C.card, borderRadius: 20, padding: 3, borderWidth: 1, borderColor: C.border },
  option: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 16 },
  optionActive: { backgroundColor: C.primarySoft },
  flag: { fontSize: 14 },
  label: { fontSize: 12, fontWeight: '600', color: C.faint },
  labelActive: { color: C.primaryText },
}))
