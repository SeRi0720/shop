import { io } from "socket.io-client"
import { getAccessToken } from "@/lib/api"

export const CHAT_PATH = "/api/socket.io" // phải khớp CHAT_PATH ở backend

// Một socket duy nhất cho cả app, nằm ngoài React.
// `auth` là hàm: mỗi lần (nối lại) đều lấy token mới nhất.
export const socket = io({
  path: CHAT_PATH,
  transports: ["websocket"],
  autoConnect: false,
  auth: (cb) => cb({ token: getAccessToken() }),
})

// Idempotent: StrictMode chạy effect hai lần vẫn chỉ có một kết nối.
export function connectSocket() {
  if (!socket.connected && !socket.active) socket.connect()
}
export function disconnectSocket() {
  socket.disconnect()
}

// Cho useSyncExternalStore.
export function subscribeConnection(onChange: () => void) {
  socket.on("connect", onChange)
  socket.on("disconnect", onChange)
  return () => {
    socket.off("connect", onChange)
    socket.off("disconnect", onChange)
  }
}
export const isConnected = () => socket.connected
