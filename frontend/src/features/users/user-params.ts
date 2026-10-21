import type { AdminUserListParams, UserStatusFilter } from "./types"

export const ADMIN_USER_PAGE_SIZE = 10
const STATUSES: UserStatusFilter[] = ["active", "locked"]
const MAX_PAGE = 100000 // khớp AdminUserQueryDto

function toPage(raw: string | null): number {
  const s = raw?.trim()
  if (!s || !/^\d+$/.test(s)) return 1
  const n = Number(s)
  return n >= 1 && n <= MAX_PAGE ? n : 1
}

/** Tham số sai thì bỏ; `limit` cố định để URL không thể vượt giới hạn backend. */
export function parseAdminUserParams(sp: URLSearchParams): AdminUserListParams {
  const status = sp.get("status") as UserStatusFilter | null
  return {
    status: status && STATUSES.includes(status) ? status : undefined,
    q: sp.get("q")?.trim().slice(0, 100) || undefined,
    page: toPage(sp.get("page")),
    limit: ADMIN_USER_PAGE_SIZE,
  }
}
