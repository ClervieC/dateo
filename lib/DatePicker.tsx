import { useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Modal, SafeAreaView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { formaterDate, nomsDesMois, initialesJours } from './dateUtils'
import { t } from './i18n'

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

const YEARS_PER_PAGE = 12

export function DatePicker({ value, onChange, placeholder }: Props) {
  const CAL_DOW = initialesJours()
  const CAL_MOIS = nomsDesMois('long')
  const CAL_MOIS_COURT = nomsDesMois('court')
  const [visible, setVisible] = useState(false)
  // 'days' = grille du mois ; 'months'/'years' = sélection rapide en touchant l'en-tête
  const [mode, setMode] = useState<'days' | 'months' | 'years'>('days')
  const parsed = parseIso(value)
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date()
    return parsed ? { year: parsed.year, month: parsed.month } : { year: now.getFullYear(), month: now.getMonth() }
  })

  function openPicker() {
    const now = new Date()
    setViewMonth(parsed ? { year: parsed.year, month: parsed.month } : { year: now.getFullYear(), month: now.getMonth() })
    setMode('days')
    setVisible(true)
  }

  function changeMonth(delta: number) {
    if (mode === 'years') {
      setViewMonth((prev) => ({ ...prev, year: prev.year + delta * YEARS_PER_PAGE }))
      return
    }
    if (mode === 'months') {
      setViewMonth((prev) => ({ ...prev, year: prev.year + delta }))
      return
    }
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

  const yearPageStart = viewMonth.year - (((viewMonth.year % YEARS_PER_PAGE) + YEARS_PER_PAGE) % YEARS_PER_PAGE)
  const headerLabel = mode === 'years'
    ? `${yearPageStart} – ${yearPageStart + YEARS_PER_PAGE - 1}`
    : mode === 'months' ? String(viewMonth.year) : `${CAL_MOIS[viewMonth.month]} ${viewMonth.year}`

  return (
    <>
      <TouchableOpacity style={styles.field} onPress={openPicker} activeOpacity={0.8}>
        <Ionicons name="calendar-outline" size={18} color="#B8A9A0" />
        <Text style={value ? styles.fieldValue : styles.fieldPlaceholder}>
          {value ? formaterDate(value) : placeholder ?? t("Choisir une date")}
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
                <TouchableOpacity
                  style={styles.headerLabelBtn}
                  onPress={() => setMode(mode === 'days' ? 'months' : mode === 'months' ? 'years' : 'days')}
                  accessibilityLabel={t("Changer de mois ou d'année")}
                >
                  <Text style={styles.headerLabel}>{headerLabel}</Text>
                  <Ionicons name={mode === 'days' ? 'chevron-down' : 'chevron-up'} size={14} color="#D4517E" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => changeMonth(1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="chevron-forward" size={20} color="#D4517E" />
                </TouchableOpacity>
              </View>

              {mode === 'years' && (
                <View style={styles.pickGrid}>
                  {Array.from({ length: YEARS_PER_PAGE }, (_, i) => yearPageStart + i).map((y) => (
                    <TouchableOpacity
                      key={y}
                      style={[styles.pickCell, y === viewMonth.year && styles.dayCellSelected]}
                      onPress={() => { setViewMonth((p) => ({ ...p, year: y })); setMode('months') }}
                    >
                      <Text style={[styles.dayText, y === viewMonth.year && styles.dayTextSelected]}>{y}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {mode === 'months' && (
                <View style={styles.pickGrid}>
                  {CAL_MOIS_COURT.map((m, i) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.pickCell, i === viewMonth.month && styles.dayCellSelected]}
                      onPress={() => { setViewMonth((p) => ({ ...p, month: i })); setMode('days') }}
                    >
                      <Text style={[styles.dayText, i === viewMonth.month && styles.dayTextSelected]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {mode === 'days' && (
              <>
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
              </>
              )}

              <TouchableOpacity style={styles.todayBtn} onPress={() => {
                const now = new Date()
                onChange(toIso(now.getFullYear(), now.getMonth(), now.getDate()))
                setVisible(false)
              }}>
                <Text style={styles.todayBtnText}>{t("Aujourd'hui")}</Text>
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
  headerLabelBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#FDE8F0' },
  headerLabel: { fontSize: 15, fontWeight: '700', color: '#5C4A45' },
  pickGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 4 },
  pickCell: { width: '33.333%', paddingVertical: 14, alignItems: 'center', borderRadius: 10 },
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
