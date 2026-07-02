import { useState, useCallback } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput, Modal, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { webContentStyle } from '../lib/webStyles'
import { CATEGORIES } from '../lib/categories'

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

  async function handleAdd() {
    if (!nom.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    await supabase.from('wishlist_lieux').insert({
      user_id: user.id,
      nom: nom.trim(),
      adresse: adresse.trim() || null,
      categorie: categorie ?? null,
      note: note.trim() || null,
    })
    setSaving(false)
    setShowAdd(false)
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color="#D4517E" />
          <Text style={styles.back}>Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Wishlist</Text>
        <TouchableOpacity onPress={() => setShowAdd(true)} style={styles.addBtn}>
          <Ionicons name="add" size={24} color="#D4517E" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#D4517E" style={{ marginTop: 60 }} size="large" />
      ) : (
        <FlatList
          contentContainerStyle={[styles.content, webContentStyle]}
          data={items}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>Ta wishlist est vide</Text>
              <Text style={styles.emptySub}>Ajoute des lieux que tu veux tester lors d'un prochain date</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowAdd(true)}>
                <Text style={styles.emptyBtnText}>Ajouter un lieu</Text>
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
                        {CATEGORIES.find((c) => c.key === item.categorie)?.emoji ?? ''} {CATEGORIES.find((c) => c.key === item.categorie)?.label ?? item.categorie}
                      </Text>
                    </View>
                  )}
                  {item.note && <Text style={styles.cardNote}>{item.note}</Text>}
                </View>
                {confirmDeleteId === item.id ? (
                  <View style={styles.confirmRow}>
                    <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.confirmYes}>
                      <Text style={styles.confirmYesText}>Oui</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setConfirmDeleteId(null)} style={styles.confirmNo}>
                      <Text style={styles.confirmNoText}>Non</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => setConfirmDeleteId(item.id)} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={18} color="#B8A9A0" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAdd(false)}>
        <SafeAreaView style={styles.modalSafe} edges={['top']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAdd(false)}>
              <Text style={styles.modalCancel}>Annuler</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Ajouter un lieu</Text>
            <TouchableOpacity onPress={handleAdd} disabled={!nom.trim() || saving}>
              <Text style={[styles.modalSave, (!nom.trim() || saving) && styles.modalSaveDisabled]}>
                {saving ? '...' : 'Ajouter'}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.fieldLabel}>Nom du lieu *</Text>
            <TextInput
              style={styles.input}
              value={nom}
              onChangeText={setNom}
              placeholder="Restaurant, bar, musée..."
              placeholderTextColor="#B8A9A0"
              autoFocus
            />
            <Text style={styles.fieldLabel}>Adresse (optionnel)</Text>
            <TextInput
              style={styles.input}
              value={adresse}
              onChangeText={setAdresse}
              placeholder="Adresse ou quartier"
              placeholderTextColor="#B8A9A0"
            />
            <Text style={styles.fieldLabel}>Catégorie</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catRow} contentContainerStyle={{ gap: 8 }}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.catOption, categorie === c.key && styles.catOptionActive]}
                  onPress={() => setCategorie(categorie === c.key ? null : c.key)}
                >
                  <Text style={[styles.catOptionText, categorie === c.key && styles.catOptionTextActive]}>
                    {c.emoji} {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.fieldLabel}>Note personnelle (optionnel)</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={note}
              onChangeText={setNote}
              placeholder="Pourquoi tu veux y aller, recommandé par..."
              placeholderTextColor="#B8A9A0"
              multiline
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF8F5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0D9D9' },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 80 },
  back: { color: '#D4517E', fontSize: 16, fontWeight: '500' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#5C4A45' },
  addBtn: { width: 40, alignItems: 'flex-end' },
  content: { padding: 20, paddingBottom: 60 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#F0D9D9' },
  cardMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardNom: { fontSize: 16, fontWeight: '600', color: '#5C4A45', marginBottom: 2 },
  cardAdresse: { fontSize: 13, color: '#888', marginBottom: 4 },
  cardNote: { fontSize: 13, color: '#5C4A45', marginTop: 4, fontStyle: 'italic', lineHeight: 18 },
  catChip: { alignSelf: 'flex-start', backgroundColor: '#FDE8F0', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4 },
  catChipText: { fontSize: 12, color: '#D4517E', fontWeight: '600' },
  deleteBtn: { padding: 4 },
  confirmRow: { flexDirection: 'column', gap: 4 },
  confirmYes: { backgroundColor: '#D85A30', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  confirmYesText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  confirmNo: { borderRadius: 8, borderWidth: 1, borderColor: '#D0C5C0', paddingHorizontal: 10, paddingVertical: 6 },
  confirmNoText: { color: '#888', fontSize: 12 },
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
