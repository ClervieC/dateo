import { useState, useEffect } from 'react'
import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Tabs, Slot } from 'expo-router'
import { useBottomTabs } from '../../lib/useBottomTabs'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { feedBadgeStore } from '../../lib/feedBadgeStore'
import { t } from '../../lib/i18n'
import { C } from '../../lib/theme'

export default function TabsLayout() {
  const [pendingCount, setPendingCount] = useState(0)
  const [feedBadge, setFeedBadge] = useState(0)
  const bottomTabs = useBottomTabs()
  const insets = useSafeAreaInsets()

  useEffect(() => feedBadgeStore.subscribe(setFeedBadge), [])

  useEffect(() => {
    async function fetchPending() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { count } = await supabase
        .from('friends')
        .select('*', { count: 'exact', head: true })
        .eq('friend_id', user.id)
        .eq('status', 'pending')
      setPendingCount(count ?? 0)
    }

    fetchPending()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchPending()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Sur ordinateur, la navigation se fait par la barre du haut (WebNavBar dans le
  // layout racine) ; sur téléphone (natif ou web), barre d'onglets en bas.
  if (!bottomTabs) {
    return <Slot />
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.faint,
        // Sur le web, la barre fait 49 px par défaut alors qu'un onglet en demande ~53
        // (5 px de marge interne + icône 28 px + libellé ~15 px + 5 px) : le bas des
        // libellés était coupé. On lui donne 62 px, plus la zone de la barre de geste de
        // l'iPhone. Ne pas ajouter de padding via tabBarItemStyle : il s'applique au
        // conteneur extérieur et s'additionne à la marge interne de l'onglet.
        tabBarStyle: Platform.OS === 'web'
          ? { backgroundColor: C.bg, borderTopColor: C.border, height: 62 + insets.bottom, paddingTop: 4, paddingBottom: insets.bottom }
          : { backgroundColor: C.bg, borderTopColor: C.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: t("Feed"),
          tabBarIcon: ({ color, size }) => <Ionicons name="people" color={color} size={size} />,
          tabBarBadge: feedBadge > 0 ? feedBadge : undefined,
          tabBarBadgeStyle: { backgroundColor: C.primary },
        }}
      />
      <Tabs.Screen
        name="rate"
        options={{
          title: t("Noter"),
          tabBarIcon: ({ color, size }) => <Ionicons name="add-circle" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="ideas"
        options={{
          title: t("Idées"),
          tabBarIcon: ({ color, size }) => <Ionicons name="bulb" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("Profil"),
          tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} />,
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
          tabBarBadgeStyle: { backgroundColor: C.primary },
        }}
      />
    </Tabs>
  )
}
