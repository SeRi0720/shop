import type { UserRole, UserStatusFilter } from "./types"

export const USER_ROLE_LABEL: Record<UserRole, string> = {
  USER: "Khách hàng",
  ADMIN: "Quản trị viên",
}

export const USER_STATUS_LABEL: Record<UserStatusFilter, string> = {
  active: "Đang hoạt động",
  locked: "Bị khóa",
}
