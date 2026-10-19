import { createContext, useContext } from "react"

export interface ChatContextValue {
  connected: boolean
}

export const ChatContext = createContext<ChatContextValue | null>(null)

export function useChatConnection(): ChatContextValue {
  const ctx = useContext(ChatContext)
  if (!ctx) {
    throw new Error("useChatConnection phải được dùng bên trong <ChatProvider>")
  }
  return ctx
}
