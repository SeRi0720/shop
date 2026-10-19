import {
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/features/auth/auth-context"
import { notifySessionExpired, refreshSession } from "@/lib/api"
import {
  connectSocket,
  disconnectSocket,
  isConnected,
  socket,
  subscribeConnection,
} from "@/lib/socket"
import { applyIncomingMessage, resyncChat } from "./cache"
import { ChatContext } from "./chat-context"
import type { ChatMessage } from "./types"
import { markUnread, resetUnread } from "./unread"

const RETRY_MS = 3000

export function ChatProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth()
  const qc = useQueryClient()
  const viewerId = user?.id
  const isAdmin = user?.role === "ADMIN"
  const connected = useSyncExternalStore(subscribeConnection, isConnected)
  // Đã thử làm mới token cho lần bị từ chối hiện tại chưa (tránh vòng lặp vô hạn).
  const triedRefresh = useRef(false)

  // Gắn listener TRƯỚC effect kết nối bên dưới.
  useEffect(() => {
    if (viewerId === undefined) return
    let retryTimer: number | undefined

    const onConnect = () => {
      triedRefresh.current = false
      resyncChat(qc, viewerId)
    }

    const onMessage = (message: ChatMessage) => {
      applyIncomingMessage(qc, viewerId, message)
      if (isAdmin && !message.fromAdmin) markUnread(message.customerId)
    }

    const onConnectError = (error: Error) => {
      // active = true: Socket.IO tự nối lại (mất mạng, server tắt) -> không làm gì.
      if (socket.active) return
      if (error.message === "UNAUTHORIZED") {
        if (triedRefresh.current) return
        triedRefresh.current = true
        void refreshSession().then((token) => {
          if (token) connectSocket()
          else notifySessionExpired()
        })
      } else {
        // Ví dụ SERVER_ERROR: middleware từ chối nên Socket.IO không tự nối lại.
        retryTimer = window.setTimeout(connectSocket, RETRY_MS)
      }
    }

    socket.on("connect", onConnect)
    socket.on("message:new", onMessage)
    socket.on("connect_error", onConnectError)
    return () => {
      socket.off("connect", onConnect)
      socket.off("message:new", onMessage)
      socket.off("connect_error", onConnectError)
      window.clearTimeout(retryTimer)
      resetUnread()
    }
  }, [qc, viewerId, isAdmin])

  // Kết nối theo trạng thái đăng nhập. Không làm gì khi đang "initializing".
  useEffect(() => {
    if (status === "authenticated") connectSocket()
    else if (status === "anonymous") disconnectSocket()
  }, [status])

  const value = useMemo(() => ({ connected }), [connected])
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
