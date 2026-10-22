import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { User } from "./auth-context"
import { ME_KEY } from "./me-key"

export interface UpdateProfileInput {
  fullName: string
  phone: string | null
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      api.patch<User>("/users/me", input).then((r) => r.data),
    // /users/me có staleTime: Infinity nên phải ghi thẳng vào cache,
    // nếu không các nơi dùng useAuth().user sẽ hiện tên cũ tới khi tải lại trang.
    onSuccess: (user) => qc.setQueryData(ME_KEY, user),
  })
}
