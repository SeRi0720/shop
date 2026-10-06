// Chỉ nhận số nguyên dương; "abc", "-1", "1e3" đều trả null (hiện trang không tìm thấy).
export function parseId(raw: string | undefined): number | null {
  return raw && /^\d{1,10}$/.test(raw) ? Number(raw) : null
}
