import { Transform } from 'class-transformer';

export interface SanitizeOptions {
  /** true: giữ \n và \t (ghi chú, mô tả, chat). false: đổi thành một khoảng trắng (tên, địa chỉ). */
  multiline?: boolean;
}

const INVISIBLE = /[\u200B\u2060\uFEFF\u202A-\u202E\u2066-\u2069]/g;
const CONTROL_KEEP_WS =
  // oxlint-disable-next-line no-control-regex
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

export function sanitizeText(
  value: string,
  opts: SanitizeOptions = {},
): string {
  let s = value.normalize('NFC').replace(INVISIBLE, '');
  s = opts.multiline ? s.replace(/\r\n?/g, '\n') : s.replace(/[\r\n\t]+/g, ' ');
  return s.replace(CONTROL_KEEP_WS, '').trim();
}

export const Sanitize = (opts?: SanitizeOptions) =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? sanitizeText(value, opts) : value,
  );
