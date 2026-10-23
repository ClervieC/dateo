import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { nomsDesMois } from './dateUtils'
import { t } from './i18n'

const ROW_HEIGHT = 48

type Option = { value: number; label: string }
type Field = 'day' | 'month' | 'year'

type Props = {
  value: string | null
  onChange: (iso: string | null) => void
  minAge?: number
  maxAge?: number
  hasError?: boolean
}

function daysIn(year: number | null, month: number | null) {
  if (month === null) return 31
  // Année inconnue : on prend une année bissextile pour autoriser le 29 février
  return new Date(year ?? 2000, month + 1, 0).getDate()
}

// Saisie d'une date de naissance en trois sélecteurs indépendants (jour / mois / année) :
// un calendrier mois par mois oblige à remonter des centaines de mois pour atteindre
// une année de naissance.
export function BirthdateField({ value, onChange, minAge = 0, maxAge = 100, hasError }: Props) {
  const [day, setDay] = useState<number | null>(null)
  const [month, setMonth] = useState<number | null>(null)
  const [year, setYear] = useState<number | null>(null)
  const [openField, setOpenField] = useState<Field | null>(null)
  const MOIS = nomsDesMois('long')

  useEffect(() => {
    if (!value) return
    const [y, m, d] = value.split('-').map(Number)
    setYear(y); setMonth(m - 1); setDay(d)
  }, [value])

  function update(next: { day?: number | null; month?: number | null; year?: number | null }) {
    const y = next.year !== undefined ? next.year : year
    const m = next.month !== undefined ? next.month : month
    let d = next.day !== undefined ? next.day : day
    // Ex : 31 sélectionné puis passage à avril → on ramène au 30
    if (d !== null && d > daysIn(y, m)) d = daysIn(y, m)
    setYear(y); setMonth(m); setDay(d)
    if (y !== null && m !== null && d !== null) {
      onChange(`${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    } else {
      onChange(null)
    }
  }

  const currentYear = new Date().getFullYear()
  const options: Record<Field, Option[]> = useMemo(() => ({
    day: Array.from({ length: daysIn(year, month) }, (_, i) => ({ value: i + 1, label: String(i + 1) })),
    month: MOIS.map((label, i) => ({ value: i, label })),
    year: Array.from({ length: maxAge - minAge + 1 }, (_, i) => {
      const y = currentYear - minAge - i
      return { value: y, label: String(y) }
    }),
  }), [year, month, minAge, maxAge, currentYear, MOIS])

  const titles: Record<Field, string> = { day: t("Jour"), month: t("Mois"), year: t("Année") }
  const selected: Record<Field, number | null> = { day, month, year }

  function renderField(field: Field, flex: number) {
    const v = selected[field]
    const label = v === null ? titles[field] : field === 'month' ? MOIS[v] : String(v)
    return (
      <TouchableOpacity
        style={[styles.field, { flex }, hasError && v === null && styles.fieldError]}
        onPress={() => setOpenField(field)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${t("{champ} de naissance", { champ: titles[field].toLowerCase() })}${v !== null ? ` : ${label}` : ''}`}
      >
        <Text style={v === null ? styles.placeholder : styles.value} numberOfLines={1}>{label}</Text>
        <Ionicons name="chevron-down" size={14} color="#B8A9A0" />
      </TouchableOpacity>
    )
  }

  return (
    <>
      <View style={styles.row}>
        {renderField('day', 0.8)}
        {renderField('month', 1.5)}
        {renderField('year', 1)}
      </View>

      <OptionSheet
        visible={openField !== null}
        title={openField ? titles[openField] : ''}
        options={openField ? options[openField] : []}
        selected={openField ? selected[openField] : null}
        // Sans année choisie, on ouvre la liste autour de ~25 ans plutôt qu'en haut
        fallbackValue={openField === 'year' ? currentYear - 25 : null}
        onClose={() => setOpenField(null)}
        onSelect={(v) => {
          const field = openField
          setOpenField(null)
          if (field) update({ [field]: v })
        }}
      />
    </>
  )
}

function OptionSheet({ visible, title, options, selected, fallbackValue, onClose, onSelect }: {
  visible: boolean
  title: string
  options: Option[]
  selected: number | null
  fallbackValue: number | null
  onClose: () => void
  onSelect: (v: number) => void
}) {
  const listRef = useRef<FlatList<Option>>(null)
  const target = selected ?? fallbackValue
  const initialIndex = Math.max(0, options.findIndex((o) => o.value === target))

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel={t("Fermer")}>
              <Ionicons name="close" size={22} color="#5C4A45" />
            </TouchableOpacity>
          </View>
          <FlatList
            ref={listRef}
            data={options}
            keyExtractor={(o) => String(o.value)}
            style={styles.list}
            initialScrollIndex={initialIndex > 2 ? initialIndex - 2 : 0}
            getItemLayout={(_, i) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * i, index: i })}
            renderItem={({ item }) => {
              const isSel = item.value === selected
              return (
                <TouchableOpacity style={[styles.option, isSel && styles.optionSelected]} onPress={() => onSelect(item.value)}>
                  <Text style={[styles.optionText, isSel && styles.optionTextSelected]}>{item.label}</Text>
                  {isSel && <Ionicons name="checkmark" size={18} color="#D4517E" />}
                </TouchableOpacity>
              )
            }}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  field: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 14, borderWidth: 1, borderColor: '#F0D9D9' },
  fieldError: { borderColor: '#D85A30' },
  placeholder: { fontSize: 15, color: '#B8A9A0', flexShrink: 1 },
  value: { fontSize: 15, color: '#5C4A45', fontWeight: '500', flexShrink: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet: { backgroundColor: '#fff', borderRadius: 20, paddingVertical: 12, width: '100%', maxWidth: 340, maxHeight: '75%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#F0D9D9' },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: '#5C4A45' },
  list: { flexGrow: 0 },
  option: { height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  optionSelected: { backgroundColor: '#FDE8F0' },
  optionText: { fontSize: 16, color: '#5C4A45' },
  optionTextSelected: { color: '#D4517E', fontWeight: '700' },
})
