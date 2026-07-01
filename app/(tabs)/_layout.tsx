import { useState, useEffect } from 'react'
import { Platform } from 'react-native'
import { Tabs, Slot } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { feedBadgeStore } from '../../lib/feedBadgeStore'

export default function TabsLayout() {
  const [pendingCount, setPendingCount] = useState(0)
  const [feedBadge, setFeedBadge] = useState(0)

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

  if (Platform.OS === 'web') {
    return <Slot />
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#D4517E',
        tabBarInactiveTintColor: '#B8A9A0',
        tabBarStyle: { backgroundColor: '#FFF8F5', borderTopColor: '#F0D9D9' },
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, size }) => <Ionicons name="people" color={color} size={size} />,
          tabBarBadge: feedBadge > 0 ? feedBadge : undefined,
          tabBarBadgeStyle: { backgroundColor: '#D4517E' },
        }}
      />
      <Tabs.Screen
        name="rate"
        options={{
          title: 'Noter',
          tabBarIcon: ({ color, size }) => <Ionicons name="add-circle" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="ideas"
        options={{
          title: 'Idées',
          tabBarIcon: ({ color, size }) => <Ionicons name="bulb" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} />,
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
          tabBarBadgeStyle: { backgroundColor: '#D4517E' },
        }}
      />
    </Tabs>
  )
}
