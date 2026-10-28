import axios, { type InternalAxiosRequestConfig } from "axios"

let accessToken: string | null = null
export const setAccessToken = (token: string | null) => {
  accessToken = token
}

export const getAccessToken = () => accessToken

let onSessionExpired: (() => void) | null = null
export const setSessionExpiredHandler = (fn: (() => void) | null) => {
  onSessionExpired = fn
}

export const notifySessionExpired = () => onSessionExpired?.()

export const api = axios.create({ baseURL: "/api", withCredentials: true })

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

const REFRESH_LOCK = "shop:refresh-session"

function runExclusive<T>(task: () => Promise<T>): Promise<T> {
  // Web Locks chỉ có ở secure context (HTTPS hoặc localhost); không có thì chạy không khóa.
  return typeof navigator !== "undefined" && "locks" in navigator
    ? navigator.locks.request(REFRESH_LOCK, task)
    : task()
}

async function requestRefresh(): Promise<string | null> {
  try {
    // Dùng axios trần (không qua `api`) để không dính interceptor.
    const res = await axios.post<{ accessToken: string }>(
      "/api/auth/refresh",
      null,
      { withCredentials: true }
    )
    setAccessToken(res.data.accessToken)
    return res.data.accessToken
  } catch {
    setAccessToken(null)
    return null
  }
}

// Singleton trong một tab (StrictMode, nhiều request 401 cùng lúc chỉ gọi một lần).
let refreshPromise: Promise<string | null> | null = null
export function refreshSession(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = runExclusive(requestRefresh).finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (
      !axios.isAxiosError(error) ||
      error.response?.status !== 401 ||
      !error.config
    ) {
      return Promise.reject(error)
    }
    const original = error.config as RetriableConfig

    if (original._retry || original.url?.startsWith("/auth/")) {
      return Promise.reject(error)
    }
    original._retry = true

    const token = await refreshSession()
    if (!token) {
      onSessionExpired?.()
      return Promise.reject(error)
    }
    original.headers.Authorization = `Bearer ${token}`
    return api(original)
  }
)

/** Lấy thông báo lỗi thân thiện từ response của NestJS (message là string hoặc mảng string). */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return "Không kết nối được máy chủ, vui lòng thử lại."
    const message: unknown = error.response.data?.message
    if (Array.isArray(message)) return message.join(". ")
    if (typeof message === "string") return message
  }
  return fallback
}

export function isNotFound(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404
}
