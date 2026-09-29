import { createContext, useContext } from "react"

// Đối chiếu các trường này với UserResponseDto của backend.
export interface User {
  id: number
  email: string
  fullName: string
  phone: string | null
  role: "USER" | "ADMIN"
}

/** initializing: chưa biết đã đăng nhập hay chưa (đang refresh lúc khởi động). */
export type AuthStatus = "initializing" | "authenticated" | "anonymous"

export interface LoginInput {
  email: string
  password: string
}

export interface AuthContextValue {
  status: AuthStatus
  user: User | null
  login: (input: LoginInput) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth phải được dùng bên trong <AuthProvider>")
  return ctx
}
