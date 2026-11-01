type Env = Record<string, string | undefined>;

/**
 * TRUST_PROXY = số hop proxy đứng trước ứng dụng. Chỉ nhận số nguyên không âm; mọi giá trị khác
 * (kể cả "true") về 0: `true` sẽ tin mọi X-Forwarded-For nên client tự giả được IP.
 */
export function readTrustProxy(env: Env): number {
  const raw = env.TRUST_PROXY?.trim();
  if (!raw || !/^\d+$/.test(raw)) return 0;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : 0;
}
