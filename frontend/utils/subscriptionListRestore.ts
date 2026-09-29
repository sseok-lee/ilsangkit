import type { SubscriptionListSnapshot } from '~/types/subscriptionList'

const MAX_RESTORE_ITEMS = 200
const MAX_RESTORE_AGE_MS = 300_000

function cloneSnapshot(snapshot: SubscriptionListSnapshot): SubscriptionListSnapshot {
  return {
    ...snapshot,
    items: [...snapshot.items],
  }
}

function kstDayFromTime(time: number): string {
  return new Date(time + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export function createSubscriptionListRestore() {
  let snapshot: SubscriptionListSnapshot | null = null

  function save(nextSnapshot: SubscriptionListSnapshot): void {
    if (nextSnapshot.items.length > MAX_RESTORE_ITEMS) {
      snapshot = null
      return
    }
    snapshot = cloneSnapshot(nextSnapshot)
  }

  function restore(key: string, historyId: string, now = Date.now()): SubscriptionListSnapshot | null {
    if (!snapshot) return null
    if (snapshot.key !== key) return null
    if (snapshot.historyId !== historyId) return null
    if (snapshot.items.length > MAX_RESTORE_ITEMS) return null
    if (now - snapshot.firstFetchedAt > MAX_RESTORE_AGE_MS) return null
    if (snapshot.kstDay !== kstDayFromTime(now)) return null
    return cloneSnapshot(snapshot)
  }

  function clear(): void {
    snapshot = null
  }

  return {
    save,
    restore,
    clear,
  }
}

export type SubscriptionListRestore = ReturnType<typeof createSubscriptionListRestore>

let clientRestore: SubscriptionListRestore | null = null

export function useSubscriptionListRestore(): SubscriptionListRestore | null {
  if (!import.meta.client) return null
  clientRestore ||= createSubscriptionListRestore()
  return clientRestore
}

export function getSubscriptionListKstDay(time = Date.now()): string {
  return kstDayFromTime(time)
}
