import { useState, useCallback } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { showAlert } from '../lib/alert'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { webContentStyle } from '../lib/webStyles'
import { CATEGORIES } from '../lib/categories'
import { ScreenHeader } from '../lib/ScreenHeader'
import { t } from '../lib/i18n'

type WishItem = {
  id: string
  nom: string
  adresse: string | null
  categorie: string | null
  note: string | null
}

export default function Wishlist() {
  const [items, setItems] = useState<WishItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [nom, setNom] = useState('')
  const [adresse, setAdresse] = useState('')
  const [categorie, setCategorie] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const router = useRouter()

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('wishlist_lieux')
      .select('id, nom, adresse, categorie, note')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setItems((data ?? []) as WishItem[])
    setLoading(false)
  }, [])

  useFocusEffect(useCallback(() => { load() }, [load]))

  function openAdd() {
    setEditingId(null)
    setNom(''); setAdresse(''); setCategorie(null); setNote('')
    setShowAdd(true)
  }

  function openEdit(item: WishItem) {
    setEditingId(item.id)
    setNom(item.nom)
    setAdresse(item.adresse ?? '')
    setCategorie(item.categorie)
    setNote(item.note ?? '')
    setShowAdd(true)
  }

  async function handleSave() {
    if (!nom.trim()) return
    setSaving(true)
    const payload = {
      nom: nom.trim(),
      adresse: adresse.trim() || null,
      categorie: categorie ?? null,
      note: note.trim() || null,
    }

    let error = null
    if (editingId) {
      ({ error } = await supabase.from('wishlist_lieux').update(payload).eq('id', editingId))
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSaving(false); return }
      ({ error } = await supabase.from('wishlist_lieux').insert({ user_id: user.id, ...payload }))
    }

    setSaving(false)
    if (error) { showAlert(t("Impossible d'enregistrer ce lieu"), error.message); return }
    setShowAdd(false)
    setEditingId(null)
    setNom(''); setAdresse(''); setCategorie(null); setNote('')
    load()
  }

  async function handleDelete(id: string) {
    await supabase.from('wishlist_lieux').delete().eq('id', id)
    setConfirmDeleteId(null)
    load()
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader fallback="/(tabs)/profile" title={t("Lieux à essayer")} right={<TouchableOpacity onPress={openAdd} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel={t("Ajouter un lieu")}><Ionicons name="add" size={26} color="#D4517E" /></TouchableOpacity>} />

      {loading ? (
        <ActivityIndicator color="#D4517E" style={{ marginTop: 60 }} size="large" />
      ) : (
        <FlatList
          contentContainerStyle={[styles.content, webContentStyle]}
          data={items}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            items.length > 0 ? (
              <Text style={styles.subtitle}>{t("Les lieux que tu veux tester. Une fois sur place, appuie sur « J'y suis allé » pour le noter.")}</Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📍</Text>
              <Text style={styles.emptyText}>{t("Aucun lieu à essayer pour l'instant")}</Text>
              <Text style={styles.emptySub}>{t("Garde ici les restos, bars ou activités qu'on t'a conseillés. Le jour où tu y vas, tu pourras le noter en un geste.")}</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={openAdd}>
                <Text style={styles.emptyBtnText}>{t("Ajouter un lieu")}</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardMain}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardNom}>{item.nom}</Text>
                  {item.adresse && <Text style={styles.cardAdresse}>📍 {item.adresse}</Text>}
                  {item.categorie && (
                    <View style={styles.catChip}>
                      <Text style={styles.catChipText}>
                        {CATEGORIES.find((c) => c.key === item.categorie)?.emoji ?? ''} {(() => { const c = CATEGORIES.find((c) => c.key === item.categorie); return c ? t(c.label) : item.categorie })()}
                      </Text>
                    </View>
                  )}
                  {item.note && <Text style={styles.cardNote}>{item.note}</Text>}
                  <TouchableOpacity
                    style={styles.wentBtn}
                    onPress={() => router.push({ pathname: '/(tabs)/rate', params: { wishlistId: item.id } } as any)}
                  >
                    <Ionicons name="checkmark-circle-outline" size={16} color="#D4517E" />
                    <Text style={styles.wentBtnText}>{t("J'y suis allé, le noter")}</Text>
                  </TouchableOpacity>
                </View>
                {confirmDeleteId === item.id ? (
                  <View style={styles.confirmRow}>
                    <Text style={styles.confirmQuestion}>{t("Supprimer ?")}</Text>
                    <TouchableOpacity
                      onPress={() => setConfirmDeleteId(null)}
                      style={styles.confirmNo}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Text style={styles.confirmNoText}>{t("Annuler")}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDelete(item.id)}
                      style={styles.confirmYes}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Text style={styles.confirmYesText}>{t("Supprimer")}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.cardActions}>
                    <TouchableOpacity onPress={() => openEdit(item)} style={styles.deleteBtn} accessibilityLabel={t("Modifier")}>
                      <Ionicons name="pencil-outline" size={18} color="#B8A9A0" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setConfirmDeleteId(item.id)} style={styles.deleteBtn} accessibilityLabel={t("Supprimer")}>
                      <Ionicons name="trash-outline" size={18} color="#B8A9A0" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAdd(false)}>
        <SafeAreaView style={styles.modalSafe} edges={['top']}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAdd(false)}>
              <Text style={styles.modalCancel}>{t("Annuler")}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingId ? t("Modifier le lieu") : t("Ajouter un lieu")}</Text>
            <TouchableOpacity onPress={handleSave} disabled={!nom.trim() || saving}>
              <Text style={[styles.modalSave, (!nom.trim() || saving) && styles.modalSaveDisabled]}>
                {saving ? '...' : editingId ? t("Enregistrer") : t("Ajouter")}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>{t("Nom du lieu *")}</Text>
            <TextInput
              style={styles.input}
              value={nom}
              onChangeText={setNom}
              placeholder={t("Restaurant, bar, musée...")}
              placeholderTextColor="#B8A9A0"
              autoFocus
            />
            <Text style={styles.fieldLabel}>{t("Adresse (optionnel)")}</Text>
            <TextInput
              style={styles.input}
              value={adresse}
              onChangeText={setAdresse}
              placeholder={t("Adresse ou quartier")}
              placeholderTextColor="#B8A9A0"
            />
            <Text style={styles.fieldLabel}>{t("Catégorie")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catRow} contentContainerStyle={{ gap: 8 }}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.catOption, categorie === c.key && styles.catOptionActive]}
                  onPress={() => setCategorie(categorie === c.key ? null : c.key)}
                >
                  <Text style={[styles.catOptionText, categorie === c.key && styles.catOptionTextActive]}>
                    {c.emoji} {t(c.label)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.fieldLabel}>{t("Note personnelle (optionnel)")}</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={note}
              onChangeText={setNote}
              placeholder={t("Pourquoi tu veux y aller, recommandé par...")}
              placeholderTextColor="#B8A9A0"
              multiline
            />
          </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF8F5' },
  wentBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 10, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#FDE8F0' },
  wentBtnText: { color: '#D4517E', fontWeight: '600', fontSize: 13 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0D9D9' },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 80 },
  back: { color: '#D4517E', fontSize: 16, fontWeight: '500' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#5C4A45' },
  addBtn: { width: 40, alignItems: 'flex-end' },
  content: { padding: 20, paddingBottom: 60 },
  subtitle: { fontSize: 12, color: '#888', marginBottom: 14, lineHeight: 17 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#F0D9D9' },
  cardMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardNom: { fontSize: 16, fontWeight: '600', color: '#5C4A45', marginBottom: 2 },
  cardAdresse: { fontSize: 13, color: '#888', marginBottom: 4 },
  cardNote: { fontSize: 13, color: '#5C4A45', marginTop: 4, fontStyle: 'italic', lineHeight: 18 },
  catChip: { alignSelf: 'flex-start', backgroundColor: '#FDE8F0', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4 },
  catChipText: { fontSize: 12, color: '#D4517E', fontWeight: '600' },
  deleteBtn: { padding: 4 },
  cardActions: { flexDirection: 'row', gap: 4 },
  confirmRow: { flexDirection: 'column', gap: 8, alignItems: 'flex-end' },
  confirmQuestion: { fontSize: 11, color: '#888', marginBottom: 2 },
  confirmYes: { backgroundColor: '#D85A30', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  confirmYesText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  confirmNo: { borderRadius: 8, borderWidth: 1, borderColor: '#D0C5C0', paddingHorizontal: 12, paddingVertical: 8 },
  confirmNoText: { color: '#888', fontSize: 12, fontWeight: '600' },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#5C4A45', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#888', textAlign: 'center', paddingHorizontal: 40, lineHeight: 18, marginBottom: 20 },
  emptyBtn: { backgroundColor: '#D4517E', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  emptyBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  modalSafe: { flex: 1, backgroundColor: '#FFF8F5' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0D9D9' },
  modalCancel: { fontSize: 16, color: '#888' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#5C4A45' },
  modalSave: { fontSize: 16, color: '#D4517E', fontWeight: '700' },
  modalSaveDisabled: { color: '#D0C5C0' },
  modalContent: { padding: 20, paddingBottom: 60 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#5C4A45', marginBottom: 6, marginTop: 16 },
  input: { borderRadius: 12, borderWidth: 1, borderColor: '#F0D9D9', padding: 12, fontSize: 15, backgroundColor: '#fff', color: '#5C4A45' },
  inputMulti: { height: 80, textAlignVertical: 'top' },
  catRow: { flexGrow: 0, marginBottom: 4, minWidth: 0 },
  catOption: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#F0D9D9' },
  catOptionActive: { backgroundColor: '#D4517E', borderColor: '#D4517E' },
  catOptionText: { fontSize: 13, color: '#5C4A45', fontWeight: '500' },
  catOptionTextActive: { color: '#fff', fontWeight: '700' },
})
