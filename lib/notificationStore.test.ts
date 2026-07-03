import { notificationStore } from './notificationStore'

describe('notificationStore', () => {
  afterEach(() => {
    notificationStore.setUnread(false)
  })

  it('démarre à false par défaut', () => {
    expect(notificationStore.get()).toBe(false)
  })

  it('met à jour la valeur et notifie les abonnés au changement', () => {
    const listener = jest.fn()
    const unsubscribe = notificationStore.subscribe(listener)

    notificationStore.setUnread(true)

    expect(notificationStore.get()).toBe(true)
    expect(listener).toHaveBeenCalledWith(true)
    unsubscribe()
  })

  it('ne notifie pas les abonnés si la valeur ne change pas', () => {
    notificationStore.setUnread(true)
    const listener = jest.fn()
    const unsubscribe = notificationStore.subscribe(listener)

    notificationStore.setUnread(true)

    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('arrête de notifier après désabonnement', () => {
    const listener = jest.fn()
    const unsubscribe = notificationStore.subscribe(listener)
    unsubscribe()

    notificationStore.setUnread(true)

    expect(listener).not.toHaveBeenCalled()
  })

  it('déclenche les abonnés pulse() à chaque appel', () => {
    const pulseListener = jest.fn()
    const unsubscribe = notificationStore.subscribePulse(pulseListener)

    notificationStore.pulse()
    notificationStore.pulse()

    expect(pulseListener).toHaveBeenCalledTimes(2)
    unsubscribe()
  })
})
