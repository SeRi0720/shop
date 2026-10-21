import { Search, X } from "lucide-react"
import { useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useUrlTextParam } from "@/lib/use-url-text-param"
import { USER_STATUS_LABEL } from "./labels"
import type { UserStatusFilter } from "./types"
import { parseAdminUserParams } from "./user-params"

const FILTER_KEYS = ["q", "status"]
const STATUS_OPTIONS = Object.keys(USER_STATUS_LABEL) as UserStatusFilter[]

export function AdminUserFilters() {
  const [sp, setSearchParams] = useSearchParams()
  const params = parseAdminUserParams(sp)
  const [q, setQ] = useUrlTextParam("q", (sp.get("q") ?? "").trim())
  const hasFilters = FILTER_KEYS.some((key) => sp.has(key))

  function setStatus(value: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === "all") next.delete("status")
        else next.set("status", value)
        next.delete("page") // đổi bộ lọc thì về trang 1
        return next
      },
      { replace: true }
    )
  }

  return (
    <div className="space-y-3 border border-foreground bg-card p-4">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo email, họ tên hoặc số điện thoại..."
          aria-label="Tìm người dùng"
          className="h-11 pl-10"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Select value={params.status ?? "all"} onValueChange={setStatus}>
          <SelectTrigger
            aria-label="Lọc theo trạng thái"
            className="h-10 w-full"
          >
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Mọi trạng thái</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {USER_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="outline"
            className="h-10"
            onClick={() =>
              setSearchParams(new URLSearchParams(), { replace: true })
            }
          >
            <X />
            Xóa bộ lọc
          </Button>
        )}
      </div>
    </div>
  )
}
