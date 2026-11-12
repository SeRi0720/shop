import { plainToInstance } from 'class-transformer';
import { Sanitize, sanitizeText } from './sanitize';

describe('sanitizeText', () => {
  it('bỏ null byte và ký tự điều khiển', () => {
    expect(sanitizeText('a\u0000b\u0007c')).toBe('abc');
  });

  it('bỏ ký tự vô hình và bidi', () => {
    expect(sanitizeText('a\u200Bb\uFEFFc\u202Ed')).toBe('abcd');
  });

  it('NFD về NFC, length giảm đúng', () => {
    const nfd = 'Nguye\u0302\u0303n';
    const out = sanitizeText(nfd);
    expect(out).toBe('Nguyễn');
    expect(out.length).toBeLessThan(nfd.length);
  });

  it('multiline=false: xuống dòng và tab thành một khoảng trắng', () => {
    expect(sanitizeText('a\nb\tc')).toBe('a b c');
  });

  it('multiline=true: giữ \\n và \\t, \\r\\n thành \\n', () => {
    expect(sanitizeText('a\r\nb\tc\rd', { multiline: true })).toBe(
      'a\nb\tc\nd',
    );
  });

  it('không bóc thẻ HTML', () => {
    expect(sanitizeText('<script>alert(1)</script>')).toBe(
      '<script>alert(1)</script>',
    );
    expect(sanitizeText('i7 <16GB')).toBe('i7 <16GB');
  });

  it('giữ emoji ghép (U+200D)', () => {
    expect(sanitizeText('👨‍👩‍👧')).toBe('👨‍👩‍👧');
  });

  it('trim hai đầu, kể cả sau khi bỏ ký tự vô hình', () => {
    expect(sanitizeText('\u200B  a  \u200B')).toBe('a');
    expect(sanitizeText('\u200B\u200B')).toBe('');
  });
});

describe('@Sanitize()', () => {
  class Dto {
    @Sanitize() a?: unknown;
    @Sanitize({ multiline: true }) b?: unknown;
  }

  it('làm sạch chuỗi theo tùy chọn', () => {
    const d = plainToInstance(Dto, { a: ' x\ny\u200B ', b: ' x\ny\u200B ' });
    expect(d.a).toBe('x y');
    expect(d.b).toBe('x\ny');
  });

  it.each([null, 42, undefined, true, ['x'], { k: 1 }])(
    'giá trị không phải chuỗi (%p) trả nguyên, không ném lỗi',
    (v) => {
      const d = plainToInstance(Dto, { a: v });
      expect(d.a).toEqual(v);
    },
  );
});
