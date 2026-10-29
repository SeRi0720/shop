import type { Logger } from '@nestjs/common';

/** Không ghi một dòng mỗi request khi Redis chết. */
export function throttledWarn(logger: Logger, intervalMs = 30_000) {
  let last = 0;
  return (message: string): void => {
    const now = Date.now();
    if (now - last < intervalMs) return;
    last = now;
    logger.warn(message);
  };
}
