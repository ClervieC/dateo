import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments, usePathname } from 'expo-router'
import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'
import { Platform, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image, useWindowDimensions } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
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
  const { width } = useWindowDimensions()
  const compact = width < 600
  const [menuOpen, setMenuOpen] = useState(false)

  function goTo(name: string) {
    setMenuOpen(false)
    router.replace(`/(tabs)/${name}` as any)
  }

  if (compact) {
    return (
      <View style={webStyles.compactWrap}>
        <View style={[webStyles.nav, webStyles.navCompact]}>
          <Image
            source={require('../assets/logoHorizontal.png')}
            style={{ height: 26, width: 69, maxWidth: '100%' }}
            resizeMode="contain"
          />
          <View style={webStyles.compactActions}>
            <TouchableOpacity
              onPress={() => router.push('/notifications')}
              style={webStyles.bellBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="notifications-outline" size={22} color="#D4517E" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMenuOpen((o) => !o)}
              style={webStyles.burgerBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name={menuOpen ? 'close' : 'menu'} size={26} color="#D4517E" />
            </TouchableOpacity>
          </View>
        </View>
        {menuOpen && (
          <>
            <TouchableOpacity
              style={webStyles.menuBackdrop}
              activeOpacity={1}
              onPress={() => setMenuOpen(false)}
            />
            <View style={webStyles.mobileMenu}>
              {TABS.map(tab => {
                const active = pathname.endsWith(`/${tab.name}`)
                return (
                  <TouchableOpacity
                    key={tab.name}
                    onPress={() => goTo(tab.name)}
                    style={[webStyles.mobileMenuItem, active && webStyles.mobileMenuItemActive]}
                  >
                    <Ionicons name={tab.icon} size={18} color={active ? '#D4517E' : '#888'} />
                    <Text style={[webStyles.linkText, active && webStyles.linkTextActive]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </>
        )}
      </View>
    )
  }

  return (
    <View style={webStyles.nav}>
      <Image
        source={require('../assets/logoHorizontal.png')}
        style={{ height: 38, width: 101, maxWidth: '100%' }}
        resizeMode="contain"
      />
      <View style={webStyles.rightGroup}>
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
        <TouchableOpacity
          onPress={() => router.push('/notifications')}
          style={webStyles.bellBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="notifications-outline" size={22} color="#D4517E" />
        </TouchableOpacity>
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

    const segmentList = segments as string[]
    const inAuthGroup = segmentList[0] === '(auth)'
    const screen = segmentList[1]

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
  navCompact: {
    paddingHorizontal: 16,
  },
  compactWrap: { position: 'relative', zIndex: 100 },
  compactActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bellBtn: { padding: 4 },
  burgerBtn: { padding: 4 },
  menuBackdrop: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    bottom: -2000,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  mobileMenu: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0D9D9',
    paddingVertical: 8,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  mobileMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  mobileMenuItemActive: { backgroundColor: '#FDE8F0' },
  brand: { fontSize: 22, fontWeight: '700', color: '#D4517E', letterSpacing: -0.5 },
  rightGroup: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  links: { flexDirection: 'row' },
  link: { height: 60, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
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
