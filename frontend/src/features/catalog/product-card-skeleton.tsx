import { Skeleton } from "@/components/ui/skeleton"

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 border-r border-b border-foreground bg-card p-4">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="aspect-[4/5] w-full" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-6 w-28" />
    </div>
  )
}
