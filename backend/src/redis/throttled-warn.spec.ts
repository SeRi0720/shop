import type { Logger } from '@nestjs/common';
import { throttledWarn } from './throttled-warn';

describe('throttledWarn', () => {
  afterEach(() => jest.restoreAllMocks());

  it('chỉ ghi một dòng trong mỗi khoảng, hết khoảng thì ghi lại', () => {
    const logger = { warn: jest.fn() } as unknown as Logger;
    const now = jest.spyOn(Date, 'now');
    const warn = throttledWarn(logger, 30_000);

    now.mockReturnValue(100_000);
    warn('a');
    now.mockReturnValue(110_000);
    warn('b'); // trong 30 giây: bị bỏ
    now.mockReturnValue(129_999);
    warn('c'); // vẫn trong khoảng: bị bỏ
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith('a');

    now.mockReturnValue(130_000);
    warn('d');
    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenLastCalledWith('d');
  });
});
