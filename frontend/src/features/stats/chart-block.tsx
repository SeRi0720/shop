import type { ReactNode } from "react"
import type { UseQueryResult } from "@tanstack/react-query"
import { BarChart3 } from "lucide-react"
import { Notice } from "@/components/auth/notice"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getErrorMessage } from "@/lib/api"
import { cn } from "@/lib/utils"

export function ChartBlock<T>({
  title,
  hint,
  query,
  isEmpty,
  children,
}: {
  title: string
  hint?: string
  query: UseQueryResult<T>
  isEmpty: (data: T) => boolean
  children: (data: T) => ReactNode
}) {
  const { data } = query
  let content: ReactNode
  if (query.isError) {
    content = (
      <div className="space-y-3">
        <Notice tone="error">
          {getErrorMessage(query.error, "Không tải được số liệu.")}
        </Notice>
        <Button variant="outline" onClick={() => query.refetch()}>
          Thử lại
        </Button>
      </div>
    )
  } else if (data === undefined) {
    content = <Skeleton className="h-72 w-full" />
  } else if (isEmpty(data)) {
    content = (
      <EmptyState
        icon={BarChart3}
        title="Chưa có dữ liệu"
        description="Không có đơn nào trong khoảng thời gian này."
      />
    )
  } else {
    content = (
      <div
        className={cn(
          "transition-opacity",
          query.isPlaceholderData && "opacity-60"
        )}
      >
        {children(data)}
      </div>
    )
  }

  return (
    <section className="min-w-0 space-y-3 border border-foreground bg-card p-4">
      <div>
        <h2 className="label-mono">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {content}
    </section>
  )
}
