type AnyFn = (...args: unknown[]) => unknown;

/**
 * @socket.io/redis-adapter gọi publish/subscribe mà không bắt lỗi. Khi Redis chưa nối,
 * ioredis (enableOfflineQueue=false) trả Promise bị reject -> unhandledRejection -> Node
 * kết thúc tiến trình. Hàm này bọc phương thức để nuốt lỗi (và báo cho onError).
 */
export function swallowRejections(
  client: object,
  methods: readonly string[],
  onError?: (error: unknown) => void,
): void {
  const target = client as Record<string, unknown>;
  for (const name of methods) {
    const original = target[name] as AnyFn;
    target[name] = (...args: unknown[]): unknown => {
      const result = original.apply(client, args);
      const thenable = result as {
        catch?: (fn: (e: unknown) => unknown) => unknown;
      };
      if (thenable && typeof thenable.catch === 'function') {
        return thenable.catch((error: unknown) => {
          onError?.(error);
          return undefined;
        });
      }
      return result;
    };
  }
}
