import { useState } from "react"
import { useSearchParams } from "react-router"
import { toast } from "sonner"
import { Notice } from "@/components/auth/notice"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { SimplePagination } from "@/components/simple-pagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AdminUserFilters } from "@/features/users/admin-user-filters"
import { useAdminUsers, useSetUserActive } from "@/features/users/hooks"
import { USER_ROLE_LABEL } from "@/features/users/labels"
import type { AdminUser } from "@/features/users/types"
import { parseAdminUserParams } from "@/features/users/user-params"
import { getErrorMessage } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

const COLUMN_COUNT = 6 // Người dùng, Điện thoại, Vai trò, Trạng thái, Ngày tạo, Thao tác
const FILTER_KEYS = ["q", "status"]

export function AdminUsersPage() {
  const [sp, setSearchParams] = useSearchParams()
  const params = parseAdminUserParams(sp)
  const list = useAdminUsers(params)
  const setActive = useSetUserActive()
  const [target, setTarget] = useState<AdminUser | null>(null)
  const hasFilters = FILTER_KEYS.some((key) => sp.has(key))

  function goToPage(next: number) {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      p.set("page", String(next))
      return p
    })
  }

  // Ném lỗi ra ngoài để ConfirmDialog hiện ngay trong hộp thoại (409, 404, mất mạng...).
  async function confirmToggle() {
    if (!target) return
    const nextActive = !target.isActive
    await setActive.mutateAsync({ id: target.id, isActive: nextActive })
    toast.success(
      nextActive ? `Đã mở khóa ${target.email}` : `Đã khóa ${target.email}`
    )
  }

  return (
    <div className="animate-fade-up space-y-6">
      <div className="space-y-1">
        <h1 className="text-4xl text-display">Người dùng</h1>
        <p className="text-sm text-muted-foreground">
          Tìm kiếm, khóa và mở khóa tài khoản. Chỉ khóa được khách hàng; vai trò
          không đổi được.
        </p>
      </div>

      <AdminUserFilters />

      {list.isError ? (
        <div className="space-y-3">
          <Notice tone="error">
            {getErrorMessage(
              list.error,
              "Không tải được danh sách người dùng."
            )}
          </Notice>
          <Button variant="outline" onClick={() => list.refetch()}>
            Thử lại
          </Button>
        </div>
      ) : (
        <>
          <div
            className={cn(
              "overflow-x-auto border border-foreground bg-card transition-opacity",
              list.isPlaceholderData && "opacity-60"
            )}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Người dùng</TableHead>
                  <TableHead>Điện thoại</TableHead>
                  <TableHead>Vai trò</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.isPending &&
                  Array.from({ length: 5 }, (_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: COLUMN_COUNT }, (_, c) => (
                        <TableCell key={c}>
                          <Skeleton className="h-4 w-full max-w-32" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}

                {list.data?.items.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={COLUMN_COUNT}
                      className="py-12 text-center text-muted-foreground"
                    >
                      {list.data.total > 0 ? (
                        <>
                          Trang này không có người dùng.{" "}
                          <Button
                            variant="link"
                            className="h-auto p-0"
                            onClick={() => goToPage(1)}
                          >
                            Về trang 1
                          </Button>
                        </>
                      ) : hasFilters ? (
                        "Không có người dùng nào khớp bộ lọc."
                      ) : (
                        "Chưa có người dùng nào."
                      )}
                    </TableCell>
                  </TableRow>
                )}

                {list.data?.items.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <p className="font-bold">{u.fullName}</p>
                      <p className="label-mono text-muted-foreground">
                        {u.email}
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {u.phone ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={u.role === "ADMIN" ? "default" : "outline"}
                      >
                        {USER_ROLE_LABEL[u.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.isActive ? "secondary" : "destructive"}>
                        {u.isActive ? "Đang hoạt động" : "Bị khóa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {formatDateTime(u.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {u.role === "ADMIN" ? (
                        <span className="label-mono text-muted-foreground">
                          Quản trị viên
                        </span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setTarget(u)}
                        >
                          {u.isActive ? "Khóa" : "Mở khóa"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {list.data && (
            <SimplePagination
              page={list.data.page}
              totalPages={list.data.totalPages}
              summary={`${list.data.total} người dùng`}
              onPageChange={goToPage}
            />
          )}
        </>
      )}

      {target && (
        <ConfirmDialog
          key={target.id}
          title={target.isActive ? "Khóa tài khoản?" : "Mở khóa tài khoản?"}
          description={
            target.isActive
              ? `${target.fullName} (${target.email}) sẽ bị đăng xuất ở thao tác tiếp theo và không đăng nhập lại được cho tới khi bạn mở khóa. Đơn hàng của họ không bị ảnh hưởng.`
              : `${target.fullName} (${target.email}) sẽ đăng nhập lại được.`
          }
          confirmLabel={target.isActive ? "Khóa" : "Mở khóa"}
          onClose={() => setTarget(null)}
          onConfirm={confirmToggle}
        />
      )}
    </div>
  )
}
