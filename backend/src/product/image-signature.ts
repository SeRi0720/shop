export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const has = (b: Buffer, sig: number[], off = 0) =>
  b.length >= off + sig.length && sig.every((v, i) => b[off + i] === v);

export function detectImageType(b: Buffer): ImageMime | null {
  if (has(b, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (has(b, PNG)) return 'image/png';
  // WEBP: "RIFF" ở byte 0-3 và "WEBP" ở byte 8-11
  if (has(b, [0x52, 0x49, 0x46, 0x46]) && has(b, [0x57, 0x45, 0x42, 0x50], 8))
    return 'image/webp';
  return null;
}
