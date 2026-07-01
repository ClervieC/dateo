let pending: string | null = null

export const toastStore = {
  set: (msg: string) => { pending = msg },
  consume: (): string | null => { const m = pending; pending = null; return m },
}
