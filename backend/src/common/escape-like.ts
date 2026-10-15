/** Escape ký tự đại diện của LIKE để người dùng gõ % hoặc _ không khớp lung tung. */
export const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');
