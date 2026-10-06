import { useEffect, useState } from "react"
import { useSearchParams } from "react-router"
import { useDebouncedValue } from "@/lib/use-debounced-value"

/**
 * Ô nhập có state riêng, sau `delayMs` mới ghi lên URL (replace, về trang 1).
 * Khi URL đổi từ nơi khác thì ô nhập tự đồng bộ theo.
 */
export function useUrlTextParam(name: string, urlValue: string, delayMs = 300) {
  const [, setSearchParams] = useSearchParams()
  const [input, setInput] = useState(urlValue)
  const [prevUrlValue, setPrevUrlValue] = useState(urlValue)
  const debounced = useDebouncedValue(input.trim(), delayMs)

  // URL đổi: nếu không phải do chính ô này vừa ghi (khác `debounced`) thì lấy giá trị URL.
  if (urlValue !== prevUrlValue) {
    setPrevUrlValue(urlValue)
    if (urlValue !== debounced) setInput(urlValue)
  }

  useEffect(() => {
    // Chỉ ghi khi người dùng đã ngừng gõ (debounced theo kịp input) và giá trị thực sự khác URL.
    if (debounced !== input.trim() || debounced === urlValue) return
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (debounced) next.set(name, debounced)
        else next.delete(name)
        next.delete("page")
        return next
      },
      { replace: true }
    )
  }, [debounced, input, urlValue, name, setSearchParams])

  return [input, setInput] as const
}
