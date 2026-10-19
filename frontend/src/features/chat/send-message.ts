import { notifySessionExpired, refreshSession } from "@/lib/api"
import { socket } from "@/lib/socket"
import type { ChatErrorCode, ChatMessage, SendAck, SendInput } from "./types"

const ACK_TIMEOUT_MS = 5000

export type SendFailureCode =
  ChatErrorCode | "OFFLINE" | "TIMEOUT" | "SESSION_EXPIRED"

export class SendFailure extends Error {
  readonly code: SendFailureCode

  constructor(code: SendFailureCode, message: string) {
    super(message)
    this.name = "SendFailure"
    this.code = code
  }
}

async function emitOnce(input: SendInput): Promise<SendAck> {
  // Mất kết nối thì emit sẽ bị đệm và gửi sau khi nối lại -> có thể thành tin trùng.
  if (!socket.connected) {
    throw new SendFailure("OFFLINE", "Mất kết nối, chưa gửi được tin")
  }
  try {
    return (await socket
      .timeout(ACK_TIMEOUT_MS)
      .emitWithAck("message:send", input)) as SendAck
  } catch {
    // Không tự gửi lại: tin có thể đã được lưu, gửi lại sẽ trùng.
    throw new SendFailure(
      "TIMEOUT",
      "Chưa nhận được xác nhận, tin có thể đã gửi, hãy kiểm tra trước khi gửi lại"
    )
  }
}

/** Ngắt rồi nối lại để handshake dùng token mới (server giữ `exp` của token cũ). */
function reconnectWithFreshToken(): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer)
      socket.off("connect", onConnect)
      socket.off("connect_error", onError)
      if (error) reject(error)
      else resolve()
    }
    const onConnect = () => finish()
    const onError = (error: Error) => finish(error)
    const timer = setTimeout(
      () => finish(new Error("Hết thời gian chờ nối lại")),
      ACK_TIMEOUT_MS
    )
    socket.on("connect", onConnect)
    socket.on("connect_error", onError)
    socket.disconnect()
    socket.connect()
  })
}

export async function sendChatMessage(input: SendInput): Promise<ChatMessage> {
  let ack = await emitOnce(input)

  if (!ack.ok && ack.code === "TOKEN_EXPIRED") {
    // Server từ chối trước khi lưu, nên gửi lại đúng một lần là an toàn.
    const token = await refreshSession()
    if (!token) {
      notifySessionExpired()
      throw new SendFailure("SESSION_EXPIRED", "Phiên đăng nhập đã hết hạn")
    }
    try {
      await reconnectWithFreshToken()
    } catch {
      throw new SendFailure("OFFLINE", "Mất kết nối, chưa gửi được tin")
    }
    ack = await emitOnce(input)
  }

  if (!ack.ok) throw new SendFailure(ack.code, ack.message)
  return ack.message
}
