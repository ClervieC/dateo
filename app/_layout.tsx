import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments, usePathname } from 'expo-router'
import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'
import { Platform, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native'
import * as Notifications from 'expo-notifications'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

const TABS = [
  { name: 'feed', label: 'Feed', icon: 'people' as const },
  { name: 'rate', label: 'Noter', icon: 'add-circle' as const },
  { name: 'ideas', label: 'Idées', icon: 'bulb' as const },
  { name: 'profile', label: 'Profil', icon: 'person' as const },
]

function WebNavBar() {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <View style={webStyles.nav}>
      <Image
        source={require('../assets/logoHorizontal.png')}
        style={{ height: 38, aspectRatio: 960 / 305 }}
        resizeMode="contain"
      />
      <View style={webStyles.links}>
        {TABS.map(tab => {
          const active = pathname.endsWith(`/${tab.name}`)
          return (
            <TouchableOpacity
              key={tab.name}
              onPress={() => router.replace(`/(tabs)/${tab.name}` as any)}
              style={webStyles.link}
            >
              <Text style={[webStyles.linkText, active && webStyles.linkTextActive]}>
                {tab.label}
              </Text>
              {active && <View style={webStyles.linkUnderline} />}
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

async function registerPushToken() {
  if (Platform.OS === 'web') return
  try {
    const { status: existing } = await Notifications.getPermissionsAsync()
    let finalStatus = existing
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }
    if (finalStatus !== 'granted') return

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      })
    }

    const token = await Notifications.getExpoPushTokenAsync()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').update({ expo_push_token: token.data }).eq('id', user.id)
    }
  } catch {
    // Notifications non disponibles (simulateur ou web)
  }
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
      if (session) registerPushToken()
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) registerPushToken()
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (loading) return

    const inAuthGroup = segments[0] === '(auth)'
    const screen = segments[1] as string | undefined

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login')
      return
    }

    // Only auto-redirect from the login screen — signup/username handle their own navigation
    if (session && screen === 'login') {
      supabase.from('profiles')
        .select('username')
        .eq('id', session.user.id)
        .single()
        .then(({ data }) => {
          if (data?.username) {
            router.replace('/(tabs)/feed')
          } else {
            router.replace('/(auth)/username')
          }
        })
    }
  }, [session, loading, segments])

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#D4517E" size="large" />
      </View>
    )
  }

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webRoot}>
        {session && <WebNavBar />}
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    )
  }

  return <Stack screenOptions={{ headerShown: false }} />
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#FFF8F5', justifyContent: 'center', alignItems: 'center' },
  webRoot: { flex: 1, backgroundColor: '#FFF8F5' },
})

const webStyles = StyleSheet.create({
  nav: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0D9D9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    height: 60,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  brand: { fontSize: 22, fontWeight: '700', color: '#D4517E', letterSpacing: -0.5 },
  links: { flexDirection: 'row' },
  link: { paddingHorizontal: 20, height: 60, justifyContent: 'center', alignItems: 'center' },
  linkText: { fontSize: 14, fontWeight: '500', color: '#888' },
  linkTextActive: { color: '#D4517E', fontWeight: '600' },
  linkUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
    height: 2,
    backgroundColor: '#D4517E',
    borderRadius: 1,
  },
})
