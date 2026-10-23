import { useEffect, useRef, useState } from 'react'
import { Stack, useRouter, useSegments, usePathname } from 'expo-router'
import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'
import { Platform, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Notifications from 'expo-notifications'
import { NotificationBell } from '../lib/NotificationBell'
import { refreshUnreadNotifications, watchNotifications } from '../lib/notifications'
import { loadProfileState } from '../lib/profileSetup'
import { useBottomTabs } from '../lib/useBottomTabs'
import { t, tKey, initLanguage, useLang } from '../lib/i18n'
import { C, themedStyles, initTheme, useThemeName, setFontsReady } from '../lib/theme'
import { StatusBar } from 'expo-status-bar'
import { useFonts, Nunito_400Regular, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito'

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
  { name: 'feed', label: tKey("Feed"), icon: 'people' as const },
  { name: 'rate', label: tKey("Noter"), icon: 'add-circle' as const },
  { name: 'ideas', label: tKey("Idées"), icon: 'bulb' as const },
  { name: 'profile', label: tKey("Profil"), icon: 'person' as const },
]

// Barre de navigation du haut, utilisée seulement sur ordinateur. Sur téléphone
// (natif ou web), la navigation se fait par la barre d'onglets en bas.
function WebNavBar() {
  const router = useRouter()
  const pathname = usePathname()

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
                  {t(tab.label)}
                </Text>
                {active && <View style={webStyles.linkUnderline} />}
              </TouchableOpacity>
            )
          })}
        </View>
        <NotificationBell style={webStyles.bellBtn} />
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

// Routes accessibles sans être connecté, en plus de (auth)/* — ex: la page
// d'instructions de suppression de compte, exigée par les stores même pour un
// utilisateur qui ne peut pas/plus se connecter.
const PUBLIC_ROUTES = ['delete-account-info', 'privacy', 'terms']

// Écrans du groupe (auth) qui gèrent eux-mêmes leur navigation une fois connecté
const SELF_NAVIGATING_AUTH_SCREENS = ['signup', 'username', 'reset-password']

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const segments = useSegments()
  // Id de l'utilisateur dont le profil est complet (pseudo + CGU) : évite de
  // re-interroger la base à chaque changement d'écran.
  const profileReadyForRef = useRef<string | null>(null)
  const bottomTabs = useBottomTabs()
  // Changer de langue remonte la navigation (key) pour que tous les écrans se ré-affichent
  const lang = useLang()
  const themeName = useThemeName()
  const [fontsLoaded, fontError] = useFonts({ Nunito_400Regular, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold })
  // Si la police ne charge pas (hors ligne au premier lancement), on garde celle du système
  const fontsDone = fontsLoaded || !!fontError
  setFontsReady(fontsLoaded)

  useEffect(() => {
    Promise.all([supabase.auth.getSession(), initLanguage(), initTheme()]).then(([{ data: { session } }]) => {
      setSession(session)
      setLoading(false)
      if (session) registerPushToken()
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (!session) profileReadyForRef.current = null
      if (event === 'PASSWORD_RECOVERY') {
        router.replace('/(auth)/reset-password')
        return
      }
      if (event === 'SIGNED_IN' && session) registerPushToken()
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    refreshUnreadNotifications(session.user.id)
    return watchNotifications(session.user.id)
  }, [session?.user.id])

  // Mémorise la langue dans le profil pour que les notifications push (envoyées par
  // les edge functions) arrivent dans la bonne langue. Erreur ignorée si la colonne
  // n'existe pas encore (migration supabase/additions.sql pas encore passée).
  useEffect(() => {
    if (!session || loading) return
    supabase.from('profiles').update({ langue: lang }).eq('id', session.user.id).then(() => {})
  }, [session?.user.id, lang, loading])

  const segmentKey = segments.join('/')

  useEffect(() => {
    if (loading) return

    const segmentList = segments as string[]
    const inAuthGroup = segmentList[0] === '(auth)'
    const isPublicRoute = PUBLIC_ROUTES.includes(segmentList[0])
    const screen = segmentList[1]

    if (!session) {
      if (!inAuthGroup && !isPublicRoute) router.replace('/(auth)/login')
      return
    }

    if (isPublicRoute || segmentList[0] === 'consent') return
    if (inAuthGroup && SELF_NAVIGATING_AUTH_SCREENS.includes(screen)) return

    const userId = session.user.id
    if (profileReadyForRef.current === userId) {
      if (inAuthGroup) router.replace('/(tabs)/feed')
      return
    }

    // Pseudo manquant → écran pseudo ; CGU non acceptées (compte créé avant l'écran de
    // consentement) → consentement ; sinon on laisse passer (et on quitte l'écran de login).
    let cancelled = false
    loadProfileState(session.user).then((state) => {
      if (cancelled || !state) return
      if (!state.username) router.replace('/(auth)/username')
      else if (!state.termsAccepted) router.replace('/consent')
      else {
        profileReadyForRef.current = userId
        if (inAuthGroup) router.replace('/(tabs)/feed')
      }
    })
    return () => { cancelled = true }
  }, [session, loading, segmentKey])

  if (loading || !fontsDone) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    )
  }

  // Pas de barre de navigation pendant l'inscription / l'onboarding / le consentement
  const hideWebNav = ['(auth)', 'onboarding', 'consent'].includes(segments[0] as string)

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webRoot}>
        <StatusBar style={themeName === 'dark' ? 'light' : 'dark'} />
        {session && !hideWebNav && !bottomTabs && <WebNavBar />}
        <Stack key={`${lang}-${themeName}`} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }} />
      </View>
    )
  }

  return (
    <>
      <StatusBar style={themeName === 'dark' ? 'light' : 'dark'} />
      <Stack key={`${lang}-${themeName}`} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }} />
    </>
  )
}

const styles = themedStyles(() => ({
  loading: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },
  webRoot: { flex: 1, backgroundColor: C.bg },
}))

const webStyles = themedStyles(() => ({
  nav: {
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
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
  bellBtn: { padding: 4 },
  rightGroup: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  links: { flexDirection: 'row' },
  link: { height: 60, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  linkText: { fontSize: 14, fontWeight: '500', color: C.muted },
  linkTextActive: { color: C.primaryText, fontWeight: '600' },
  linkUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
    height: 2,
    backgroundColor: C.primary,
    borderRadius: 1,
  },
}))
