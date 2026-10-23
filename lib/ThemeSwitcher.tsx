import { useState } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { C, themedStyles, getThemePref, setThemePref, ThemePref } from './theme'
import { t, tKey } from './i18n'

const OPTIONS: { key: ThemePref; label: string; icon: 'phone-portrait-outline' | 'sunny-outline' | 'moon-outline' }[] = [
  { key: 'system', label: tKey('Système'), icon: 'phone-portrait-outline' },
  { key: 'light', label: tKey('Clair'), icon: 'sunny-outline' },
  { key: 'dark', label: tKey('Sombre'), icon: 'moon-outline' },
]

// Choix du thème : suit le téléphone, ou force clair / sombre
export function ThemeSwitcher() {
  const [pref, setPref] = useState(getThemePref())
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup">
      {OPTIONS.map((o) => {
        const active = o.key === pref
        return (
          <TouchableOpacity
            key={o.key}
            style={[styles.option, active && styles.optionActive]}
            onPress={() => { setPref(o.key); setThemePref(o.key) }}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
          >
            <Ionicons name={o.icon} size={16} color={active ? C.primaryText : C.faint} />
            <Text style={[styles.label, active && styles.labelActive]}>{t(o.label)}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = themedStyles(() => ({
  wrap: { flexDirection: 'row', backgroundColor: C.bg, borderRadius: 12, padding: 3, borderWidth: 1, borderColor: C.border },
  option: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 9 },
  optionActive: { backgroundColor: C.card, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  label: { fontSize: 13, fontWeight: '600', color: C.faint },
  labelActive: { color: C.primaryText },
}))
