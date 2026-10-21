import { api } from "@/lib/api"
import type { AdminUser, AdminUserListParams, AdminUserPage } from "./types"

export const fetchAdminUsers = (params: AdminUserListParams) =>
  api.get<AdminUserPage>("/admin/users", { params }).then((r) => r.data)

export const setUserActive = (id: number, isActive: boolean) =>
  api
    .patch<AdminUser>(`/admin/users/${id}/status`, { isActive })
    .then((r) => r.data)
