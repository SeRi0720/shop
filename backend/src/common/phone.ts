/** Số di động VN: 0xxxxxxxxx hoặc +84xxxxxxxxx. Phải khớp frontend/src/features/auth/schemas.ts. */
export const PHONE_REGEX = /^(0|\+84)\d{9}$/;
export const PHONE_MESSAGE = 'Số điện thoại không hợp lệ';
