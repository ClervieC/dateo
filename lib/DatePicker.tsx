import { useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Modal, SafeAreaView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { formaterDate } from './dateUtils'

const CAL_DOW = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const CAL_MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

type Props = {
  value: string | null
  onChange: (iso: string) => void
  placeholder?: string
}

function parseIso(iso: string | null) {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  return { year: y, month: m - 1, day: d }
}

function toIso(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function DatePicker({ value, onChange, placeholder = 'Choisir une date' }: Props) {
  const [visible, setVisible] = useState(false)
  const parsed = parseIso(value)
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date()
    return parsed ? { year: parsed.year, month: parsed.month } : { year: now.getFullYear(), month: now.getMonth() }
  })

  function openPicker() {
    const now = new Date()
    setViewMonth(parsed ? { year: parsed.year, month: parsed.month } : { year: now.getFullYear(), month: now.getMonth() })
    setVisible(true)
  }

  function changeMonth(delta: number) {
    setViewMonth((prev) => {
      let month = prev.month + delta
      let year = prev.year
      if (month < 0) { month = 11; year -= 1 }
      if (month > 11) { month = 0; year += 1 }
      return { year, month }
    })
  }

  function selectDay(day: number) {
    onChange(toIso(viewMonth.year, viewMonth.month, day))
    setVisible(false)
  }

  const cells = useMemo(() => {
    const firstDow = (new Date(viewMonth.year, viewMonth.month, 1).getDay() + 6) % 7
    const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate()
    const arr: (number | null)[] = Array(firstDow).fill(null)
    for (let i = 1; i <= daysInMonth; i++) arr.push(i)
    while (arr.length % 7 !== 0) arr.push(null)
    return arr
  }, [viewMonth])

  return (
    <>
      <TouchableOpacity style={styles.field} onPress={openPicker} activeOpacity={0.8}>
        <Ionicons name="calendar-outline" size={18} color="#B8A9A0" />
        <Text style={value ? styles.fieldValue : styles.fieldPlaceholder}>
          {value ? formaterDate(value) : placeholder}
        </Text>
      </TouchableOpacity>

      <Modal visible={visible} animationType="fade" transparent onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <SafeAreaView>
              <View style={styles.header}>
                <TouchableOpacity onPress={() => changeMonth(-1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="chevron-back" size={20} color="#D4517E" />
                </TouchableOpacity>
                <Text style={styles.headerLabel}>{CAL_MOIS[viewMonth.month]} {viewMonth.year}</Text>
                <TouchableOpacity onPress={() => changeMonth(1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="chevron-forward" size={20} color="#D4517E" />
                </TouchableOpacity>
              </View>

              <View style={styles.dowRow}>
                {CAL_DOW.map((d, i) => <Text key={i} style={styles.dow}>{d}</Text>)}
              </View>

              <View style={styles.grid}>
                {cells.map((day, idx) => {
                  if (day === null) return <View key={idx} style={styles.cell} />
                  const iso = toIso(viewMonth.year, viewMonth.month, day)
                  const isSelected = value === iso
                  const isToday = iso === toIso(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.cell, styles.dayCell, isSelected && styles.dayCellSelected, !isSelected && isToday && styles.dayCellToday]}
                      onPress={() => selectDay(day)}
                    >
                      <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>{day}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              <TouchableOpacity style={styles.todayBtn} onPress={() => {
                const now = new Date()
                onChange(toIso(now.getFullYear(), now.getMonth(), now.getDate()))
                setVisible(false)
              }}>
                <Text style={styles.todayBtnText}>Aujourd'hui</Text>
              </TouchableOpacity>
            </SafeAreaView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF8F5', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#F0D9D9' },
  fieldValue: { fontSize: 15, color: '#5C4A45', fontWeight: '500' },
  fieldPlaceholder: { fontSize: 15, color: '#B8A9A0' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet: { backgroundColor: '#fff', borderRadius: 20, padding: 16, width: '100%', maxWidth: 340 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 },
  headerLabel: { fontSize: 15, fontWeight: '700', color: '#5C4A45' },
  dowRow: { flexDirection: 'row', marginBottom: 4 },
  dow: { flex: 1, textAlign: 'center', fontSize: 12, color: '#B8A9A0', fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, justifyContent: 'center', alignItems: 'center' },
  dayCell: { borderRadius: 10 },
  dayCellSelected: { backgroundColor: '#D4517E' },
  dayCellToday: { borderWidth: 1, borderColor: '#D4517E' },
  dayText: { fontSize: 14, color: '#5C4A45', fontWeight: '500' },
  dayTextSelected: { color: '#fff', fontWeight: '700' },
  todayBtn: { marginTop: 12, alignItems: 'center', padding: 10 },
  todayBtnText: { color: '#D4517E', fontWeight: '600', fontSize: 13 },
})
