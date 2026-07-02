import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from './supabase'
import { notificationStore } from './notificationStore'

export const NOTIF_LAST_SEEN_KEY = 'notifLastSeen'
const EPOCH = '1970-01-01T00:00:00.000Z'

async function getLastSeen(): Promise<string> {
  return (await AsyncStorage.getItem(NOTIF_LAST_SEEN_KEY)) ?? EPOCH
}

// Recalcule s'il existe des likes/commentaires plus récents que la dernière visite
// de l'écran Notifications, et met à jour le store (fait gonfler/dégonfler la cloche).
export async function refreshUnreadNotifications(userId: string) {
  const lastSeen = await getLastSeen()

  const { data: myDates } = await supabase.from('dates').select('id').eq('user_id', userId)
  const dateIds = (myDates ?? []).map((d: any) => d.id)
  if (dateIds.length === 0) { notificationStore.setUnread(false); return }

  const [{ count: reactionCount }, { count: commentCount }] = await Promise.all([
    supabase.from('date_reactions').select('*', { count: 'exact', head: true })
      .in('date_id', dateIds).neq('user_id', userId).gt('created_at', lastSeen),
    supabase.from('date_comments').select('*', { count: 'exact', head: true })
      .in('date_id', dateIds).neq('user_id', userId).gt('created_at', lastSeen),
  ])

  notificationStore.setUnread(((reactionCount ?? 0) + (commentCount ?? 0)) > 0)
}

// Abonnement Realtime : dès qu'un like/commentaire arrive sur un de mes dates, la cloche
// se remplit et s'anime immédiatement, sans attendre un rechargement de page.
// Nécessite que Realtime soit activé sur les tables date_reactions et date_comments
// (Database > Replication dans le dashboard Supabase).
export function watchNotifications(userId: string) {
  let myDateIds = new Set<string>()

  supabase.from('dates').select('id').eq('user_id', userId).then(({ data }) => {
    myDateIds = new Set((data ?? []).map((d: any) => d.id))
  })

  function handleInsert(row: any) {
    if (row.user_id === userId) return
    if (!myDateIds.has(row.date_id)) return
    notificationStore.setUnread(true)
    notificationStore.pulse()
  }

  const channel = supabase
    .channel(`notif-watch-${userId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'date_reactions' }, (payload) => handleInsert(payload.new))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'date_comments' }, (payload) => handleInsert(payload.new))
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}

export async function markNotificationsSeen() {
  await AsyncStorage.setItem(NOTIF_LAST_SEEN_KEY, new Date().toISOString())
  notificationStore.setUnread(false)
}
