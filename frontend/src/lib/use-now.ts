import { useEffect, useState } from "react"

/** Đồng hồ cho giao diện: render lại mỗi `intervalMs`, tránh gọi Date.now() trực tiếp lúc render. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}
