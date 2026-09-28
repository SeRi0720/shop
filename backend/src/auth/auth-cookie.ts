import type { CookieOptions, Response } from 'express';
export const REFRESH_COOKIE = 'refreshToken';
const baseOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === 'true',
  sameSite: 'lax',
  path: '/api/auth',
});
export function setRefreshCookie(
  res: Response,
  token: string,
  maxAgeMs: number,
) {
  res.cookie(REFRESH_COOKIE, token, { ...baseOptions(), maxAge: maxAgeMs });
}
export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, baseOptions());
}
