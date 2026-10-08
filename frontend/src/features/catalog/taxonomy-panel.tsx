import { useState } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Notice } from "@/components/auth/notice"
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
import { getErrorMessage } from "@/lib/api"
import { useTaxonomy, useTaxonomyMutations } from "./hooks"
import { DeleteDialog, NameFormDialog } from "./taxonomy-dialogs"
import type { NamedItem, TaxonomyKind } from "./types"

type DialogState =
  | { mode: "create" }
  | { mode: "edit"; item: NamedItem }
  | { mode: "delete"; item: NamedItem }
  | null

export function TaxonomyPanel({
  kind,
  noun,
}: {
  kind: TaxonomyKind
  noun: string // "danh mục" | "thương hiệu"
}) {
  const list = useTaxonomy(kind)
  const { create, update, remove } = useTaxonomyMutations(kind)
  const [dialog, setDialog] = useState<DialogState>(null)
  const close = () => setDialog(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {list.data ? `${list.data.length} ${noun}` : "\u00a0"}
        </p>
        <Button onClick={() => setDialog({ mode: "create" })}>
          <Plus />
          Thêm {noun}
        </Button>
      </div>

      {list.isError ? (
        <div className="space-y-3">
          <Notice tone="error">
            {getErrorMessage(list.error, `Không tải được danh sách ${noun}.`)}
          </Notice>
          <Button variant="outline" onClick={() => list.refetch()}>
            Thử lại
          </Button>
        </div>
      ) : (
        <div className="border border-foreground bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">ID</TableHead>
                <TableHead>Tên</TableHead>
                <TableHead className="w-28 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.isPending &&
                Array.from({ length: 5 }, (_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-8" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-40" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-4 w-16" />
                    </TableCell>
                  </TableRow>
                ))}
              {list.data?.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="py-10 text-center text-muted-foreground"
                  >
                    Chưa có {noun} nào.
                  </TableCell>
                </TableRow>
              )}
              {list.data?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-muted-foreground">
                    {item.id}
                  </TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Sửa ${item.name}`}
                      onClick={() => setDialog({ mode: "edit", item })}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Xóa ${item.name}`}
                      onClick={() => setDialog({ mode: "delete", item })}
                    >
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {dialog?.mode === "create" && (
        <NameFormDialog
          title={`Thêm ${noun}`}
          submitLabel="Thêm"
          onClose={close}
          onSubmit={async (name) => {
            await create.mutateAsync(name)
            toast.success(`Đã thêm ${noun} “${name}”`)
            close()
          }}
        />
      )}
      {dialog?.mode === "edit" && (
        <NameFormDialog
          title={`Sửa ${noun}`}
          initialName={dialog.item.name}
          submitLabel="Lưu"
          onClose={close}
          onSubmit={async (name) => {
            await update.mutateAsync({ id: dialog.item.id, name })
            toast.success(`Đã lưu ${noun} “${name}”`)
            close()
          }}
        />
      )}
      {dialog?.mode === "delete" && (
        <DeleteDialog
          noun={noun}
          name={dialog.item.name}
          onClose={close}
          onConfirm={async () => {
            await remove.mutateAsync(dialog.item.id)
            toast.success(`Đã xóa ${noun} “${dialog.item.name}”`)
            close()
          }}
        />
      )}
    </div>
  )
}
