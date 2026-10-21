import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { fetchAdminUsers, setUserActive } from "./api"
import type { AdminUserListParams } from "./types"

export function useAdminUsers(params: AdminUserListParams) {
  return useQuery({
    queryKey: ["admin-users", params],
    queryFn: () => fetchAdminUsers(params),
    placeholderData: keepPreviousData,
  })
}

export function useSetUserActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      setUserActive(id, isActive),
    onSettled: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  })
}
