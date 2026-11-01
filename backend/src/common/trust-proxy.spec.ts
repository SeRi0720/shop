import { readTrustProxy } from './trust-proxy';

describe('readTrustProxy', () => {
  it.each([
    [undefined, 0],
    ['', 0],
    ['0', 0],
    ['1', 1],
    [' 2 ', 2],
    ['true', 0],
    ['-1', 0],
    ['1.5', 0],
    ['abc', 0],
  ])('TRUST_PROXY=%p thì %p', (raw, expected) => {
    expect(readTrustProxy({ TRUST_PROXY: raw })).toBe(expected);
  });
});
