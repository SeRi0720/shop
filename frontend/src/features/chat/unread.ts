import { useSyncExternalStore } from "react"

// Trạng thái của tab, nằm ngoài React. PHẢI reset khi đổi tài khoản (xem chat-provider).
let unread: ReadonlySet<number> = new Set()
let active: number | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
const getSnapshot = () => unread

export const useUnread = () => useSyncExternalStore(subscribe, getSnapshot)

/** Tin của khách đến khi admin chưa mở hội thoại đó. */
export function markUnread(customerId: number) {
  if (customerId === active || unread.has(customerId)) return
  unread = new Set(unread).add(customerId)
  emit()
}

/** Gọi khi mở một hội thoại (id) hoặc rời đi (null). */
export function setActiveConversation(customerId: number | null) {
  active = customerId
  if (customerId !== null && unread.has(customerId)) {
    unread = new Set([...unread].filter((id) => id !== customerId))
    emit()
  }
}

export function resetUnread() {
  active = null
  unread = new Set()
  emit()
}
