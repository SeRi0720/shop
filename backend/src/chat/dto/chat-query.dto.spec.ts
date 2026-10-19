import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { InboxQueryDto, MessageHistoryQueryDto } from './chat-query.dto';

const invalidFields = async <T extends object>(
  cls: new () => T,
  plain: Record<string, string>,
) => (await validate(plainToInstance(cls, plain))).map((e) => e.property);

describe('MessageHistoryQueryDto', () => {
  it('chuỗi hợp lệ từ query string được chấp nhận', async () => {
    expect(
      await invalidFields(MessageHistoryQueryDto, {
        before: '10',
        limit: '30',
      }),
    ).toEqual([]);
    expect(await invalidFields(MessageHistoryQueryDto, {})).toEqual([]);
  });

  it.each(['0', '101', '-1', 'abc', '1.5'])(
    'limit=%s bị từ chối',
    async (limit) => {
      expect(await invalidFields(MessageHistoryQueryDto, { limit })).toEqual([
        'limit',
      ]);
    },
  );

  it.each(['0', '-5', 'abc', '2147483648'])(
    'before=%s bị từ chối',
    async (before) => {
      expect(await invalidFields(MessageHistoryQueryDto, { before })).toEqual([
        'before',
      ]);
    },
  );
});

describe('InboxQueryDto', () => {
  it('limit tối đa 50, page tối thiểu 1', async () => {
    expect(
      await invalidFields(InboxQueryDto, { page: '1', limit: '50' }),
    ).toEqual([]);
    expect(await invalidFields(InboxQueryDto, { limit: '51' })).toEqual([
      'limit',
    ]);
    expect(await invalidFields(InboxQueryDto, { page: '0' })).toEqual(['page']);
  });
});
