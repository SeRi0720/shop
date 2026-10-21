export type UserRole = "USER" | "ADMIN"
export type UserStatusFilter = "active" | "locked"

export interface AdminUser {
  id: number
  email: string
  fullName: string
  phone: string | null
  role: UserRole
  isActive: boolean
  createdAt: string
}

export interface AdminUserListParams {
  page?: number
  limit?: number
  q?: string
  status?: UserStatusFilter
}

export interface AdminUserPage {
  items: AdminUser[]
  total: number
  page: number
  limit: number
  totalPages: number
}
