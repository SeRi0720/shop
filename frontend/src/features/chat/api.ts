import { api } from "@/lib/api"
import type {
  HistoryParams,
  InboxPage,
  InboxParams,
  MessagePage,
} from "./types"

export const fetchMyMessages = (params: HistoryParams) =>
  api.get<MessagePage>("/chat/messages", { params }).then((r) => r.data)

export const fetchAdminMessages = (customerId: number, params: HistoryParams) =>
  api
    .get<MessagePage>(`/admin/chat/conversations/${customerId}/messages`, {
      params,
    })
    .then((r) => r.data)

export const fetchInbox = (params: InboxParams) =>
  api
    .get<InboxPage>("/admin/chat/conversations", { params })
    .then((r) => r.data)
