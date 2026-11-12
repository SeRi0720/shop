import { detectImageType } from './image-signature';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x24, 0, 0, 0]),
  Buffer.from('WEBPVP8 '),
]);
const WAV = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x24, 0, 0, 0]),
  Buffer.from('WAVEfmt '),
]);

describe('detectImageType', () => {
  it('nhận jpeg, png, webp thật', () => {
    expect(detectImageType(JPEG)).toBe('image/jpeg');
    expect(detectImageType(PNG)).toBe('image/png');
    expect(detectImageType(WEBP)).toBe('image/webp');
  });

  it('từ chối văn bản, HTML, buffer rỗng', () => {
    expect(detectImageType(Buffer.from('khong phai anh'))).toBeNull();
    expect(detectImageType(Buffer.from('<html></html>'))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });

  it('buffer ngắn hơn 12 byte không ném lỗi', () => {
    expect(detectImageType(Buffer.from('RIFF'))).toBeNull();
    expect(detectImageType(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(detectImageType(Buffer.from('RIFFxxxxWEB'))).toBeNull(); // 11 byte
  });

  it('RIFF không có WEBP (WAV) trả null', () => {
    expect(detectImageType(WAV)).toBeNull();
  });
});
