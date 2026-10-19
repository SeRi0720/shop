import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useAuth } from "@/features/auth/auth-context"
import { isNotFound } from "@/lib/api"
import { fetchAdminMessages, fetchInbox, fetchMyMessages } from "./api"
import {
  applyIncomingMessage,
  chatInboxKey,
  chatMessagesKey,
  resyncChat,
} from "./cache"
import { SendFailure, sendChatMessage } from "./send-message"
import type { InboxParams, SendInput } from "./types"

/** USER truyền id của chính mình; ADMIN truyền id khách đang mở. */
export function useChatMessages(customerId: number | null) {
  const { user } = useAuth()
  const isAdmin = user?.role === "ADMIN"
  return useInfiniteQuery({
    queryKey: chatMessagesKey(user?.id, customerId),
    queryFn: ({ pageParam }) =>
      isAdmin
        ? fetchAdminMessages(customerId!, { before: pageParam })
        : fetchMyMessages({ before: pageParam }),
    initialPageParam: undefined as number | undefined,
    // items xếp từ cũ đến mới nên items[0] là tin cũ nhất của trang
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.items[0]?.id : undefined,
    enabled: !!user && customerId !== null,
    retry: (failureCount, error) => !isNotFound(error) && failureCount < 2,
  })
}

export function useInbox(params: InboxParams) {
  const { user } = useAuth()
  return useQuery({
    queryKey: chatInboxKey(user?.id, params),
    queryFn: () => fetchInbox(params),
    enabled: user?.role === "ADMIN",
    placeholderData: keepPreviousData,
  })
}

export function useSendMessage() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: (input: SendInput) => sendChatMessage(input),
    // Ghi theo id nên khớp với bản echo `message:new` đến sau (không tạo bản trùng).
    onSuccess: (message) => {
      if (user) applyIncomingMessage(qc, user.id, message)
    },
    onError: (error) => {
      // Hết thời gian chờ ack: đọc lại lịch sử để biết tin đã vào DB chưa.
      if (user && error instanceof SendFailure && error.code === "TIMEOUT") {
        resyncChat(qc, user.id)
      }
    },
  })
}
