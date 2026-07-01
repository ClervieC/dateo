type Listener = (count: number) => void

class FeedBadgeStore {
  private _count = 0
  private listeners: Listener[] = []

  set(count: number) {
    this._count = count
    this.listeners.forEach((l) => l(count))
  }

  get() { return this._count }
  clear() { this.set(0) }

  subscribe(listener: Listener) {
    this.listeners.push(listener)
    return () => { this.listeners = this.listeners.filter((l) => l !== listener) }
  }
}

export const feedBadgeStore = new FeedBadgeStore()
