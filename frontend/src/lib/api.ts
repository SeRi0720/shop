import axios, { type InternalAxiosRequestConfig } from "axios"

let accessToken: string | null = null
export const setAccessToken = (token: string | null) => {
  accessToken = token
}

let onSessionExpired: (() => void) | null = null
export const setSessionExpiredHandler = (fn: (() => void) | null) => {
  onSessionExpired = fn
}

export const api = axios.create({ baseURL: "/api", withCredentials: true })

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

let refreshPromise: Promise<string | null> | null = null
export function refreshSession(): Promise<string | null> {
  if (!refreshPromise) {
    // Dùng axios trần (không qua `api`) để không dính interceptor.
    refreshPromise = axios
      .post<{ accessToken: string }>("/api/auth/refresh", null, {
        withCredentials: true,
      })
      .then((res) => {
        setAccessToken(res.data.accessToken)
        return res.data.accessToken
      })
      .catch(() => {
        setAccessToken(null)
        return null
      })
      .finally(() => {
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
