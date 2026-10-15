import { useEffect, useState } from "react"

/** Đếm ngược `seconds` giây sau mỗi lần gọi start(); dùng để giãn nút "Kiểm tra thanh toán". */
export function useCooldown(seconds: number) {
  const [remaining, setRemaining] = useState(0)
  useEffect(() => {
    if (remaining <= 0) return
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000)
    return () => clearTimeout(t)
  }, [remaining])
  return [remaining, () => setRemaining(seconds)] as const
}
