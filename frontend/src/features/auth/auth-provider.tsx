import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { useNavigate } from "react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  api,
  refreshSession,
  setAccessToken,
  setSessionExpiredHandler,
} from "@/lib/api"
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
  type LoginInput,
  type User,
} from "./auth-context"

const ME_KEY = ["me"] as const
const fetchMe = () => api.get<User>("/users/me").then((res) => res.data)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [bootstrapped, setBootstrapped] = useState(false) // đã thử refresh lúc khởi động xong chưa
  const [hasSession, setHasSession] = useState(false) // có access token hợp lệ trong bộ nhớ

  useEffect(() => {
    let active = true
    refreshSession().then((token) => {
      if (!active) return
      setHasSession(token !== null)
      setBootstrapped(true)
    })
    return () => {
      active = false
    }
  }, [])

  // Interceptor báo phiên hết hạn (refresh thất bại): xóa trạng thái và về /login.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setHasSession(false)
      queryClient.removeQueries({ queryKey: ME_KEY })
      const path = window.location.pathname
      if (path !== "/login" && path !== "/register")
        navigate("/login", { replace: true })
    })
    return () => setSessionExpiredHandler(null)
  }, [navigate, queryClient])

  // Thông tin người dùng lấy bằng TanStack Query, chỉ chạy khi đã có access token.
  const me = useQuery({
    queryKey: ME_KEY,
    queryFn: fetchMe,
    enabled: hasSession,
    retry: false,
    staleTime: Infinity,
  })

  let status: AuthStatus
  if (!bootstrapped || (hasSession && me.isPending)) status = "initializing"
  else if (hasSession && me.data) status = "authenticated"
  else status = "anonymous"

  const login = useCallback(
    async (input: LoginInput) => {
      const { data } = await api.post<{ accessToken: string }>(
        "/auth/login",
        input
      )
      setAccessToken(data.accessToken)
      try {
        // Nạp sẵn /users/me vào cache để chuyển trang xong là có user ngay.
        await queryClient.fetchQuery({ queryKey: ME_KEY, queryFn: fetchMe })
      } catch (error) {
        setAccessToken(null)
        throw error
      }
      setHasSession(true)
    },
    [queryClient]
  )

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout") // Public: không cần access token còn hạn
    } catch {
      // Lỗi mạng: vẫn xóa phiên phía client.
    }
    setAccessToken(null)
    setHasSession(false)
    queryClient.removeQueries({ queryKey: ME_KEY })
  }, [queryClient])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: hasSession ? (me.data ?? null) : null,
      login,
      logout,
    }),
    [status, hasSession, me.data, login, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
