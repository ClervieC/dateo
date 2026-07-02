type StateListener = (hasUnread: boolean) => void
type PulseListener = () => void

// Pilote l'icône de notification partout dans l'app : hasUnread contrôle si la cloche
// est pleine (persiste jusqu'à ce que l'utilisateur ouvre l'écran Notifications), et
// pulse() déclenche une animation ponctuelle au moment précis où une notif arrive.
class NotificationStore {
  private hasUnread = false
  private stateListeners: StateListener[] = []
  private pulseListeners: PulseListener[] = []

  setUnread(value: boolean) {
    if (this.hasUnread === value) return
    this.hasUnread = value
    this.stateListeners.forEach((l) => l(value))
  }

  get() {
    return this.hasUnread
  }

  pulse() {
    this.pulseListeners.forEach((l) => l())
  }

  subscribe(listener: StateListener) {
    this.stateListeners.push(listener)
    return () => { this.stateListeners = this.stateListeners.filter((l) => l !== listener) }
  }

  subscribePulse(listener: PulseListener) {
    this.pulseListeners.push(listener)
    return () => { this.pulseListeners = this.pulseListeners.filter((l) => l !== listener) }
  }
}

export const notificationStore = new NotificationStore()
