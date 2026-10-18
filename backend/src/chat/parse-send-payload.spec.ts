import { ChatError } from './chat-error';
import { parseSendPayload } from './parse-send-payload';

const codeOf = (raw: unknown) => {
  try {
    parseSendPayload(raw);
  } catch (e) {
    return e instanceof ChatError ? e.code : 'KHÁC';
  }
  return null;
};

describe('parseSendPayload', () => {
  it.each([undefined, null, 'abc', 42, [], [{ content: 'x' }]])(
    'payload không phải object (%p): INVALID_PAYLOAD',
    (raw) => expect(codeOf(raw)).toBe('INVALID_PAYLOAD'),
  );

  it.each([undefined, 123, null, {}, ['a']])(
    'content không phải chuỗi (%p): INVALID_PAYLOAD',
    (content) => expect(codeOf({ content })).toBe('INVALID_PAYLOAD'),
  );

  it.each(['', '   ', '\n\t '])(
    'content rỗng hoặc chỉ khoảng trắng (%p): INVALID_CONTENT',
    (content) => expect(codeOf({ content })).toBe('INVALID_CONTENT'),
  );

  it('đúng 2000 ký tự qua, 2001 hỏng', () => {
    expect(codeOf({ content: 'a'.repeat(2000) })).toBeNull();
    expect(codeOf({ content: 'a'.repeat(2001) })).toBe('INVALID_CONTENT');
  });

  it('cắt khoảng trắng hai đầu trước khi đếm', () => {
    expect(
      parseSendPayload({ content: `  ${'a'.repeat(2000)}  ` }).content,
    ).toBe('a'.repeat(2000));
    expect(parseSendPayload({ content: '  xin chào \n' }).content).toBe(
      'xin chào',
    );
  });

  it('customerId hợp lệ được giữ, không hợp lệ thành undefined', () => {
    expect(parseSendPayload({ content: 'x', customerId: 7 }).customerId).toBe(
      7,
    );
    for (const bad of [0, -1, 1.5, '7', null, NaN, 2_147_483_648]) {
      expect(
        parseSendPayload({ content: 'x', customerId: bad }).customerId,
      ).toBeUndefined();
    }
  });
});
