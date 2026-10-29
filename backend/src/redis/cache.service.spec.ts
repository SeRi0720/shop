import { Logger } from '@nestjs/common';
import { CacheService } from './cache.service';
import { FakeCacheStore } from './testing/fake-cache-store';

describe('CacheService', () => {
  let store: FakeCacheStore;
  let cache: CacheService;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    store = new FakeCacheStore();
    cache = new CacheService(store);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('getOrSet', () => {
    it('trượt: gọi load một lần, ghi đúng TTL dưới khóa phiên bản v0', async () => {
      const load = jest.fn().mockResolvedValue({ a: 1 });
      await expect(cache.getOrSet('x', 60, load)).resolves.toEqual({ a: 1 });
      expect(load).toHaveBeenCalledTimes(1);
      expect(store.ttls.get('cache:catalog:v0:x')).toBe(60);
      expect(store.data.get('cache:catalog:v0:x')).toBe('{"a":1}');
    });

    it('trúng: không gọi load lần hai', async () => {
      const load = jest.fn().mockResolvedValue({ a: 1 });
      await cache.getOrSet('x', 60, load);
      await expect(cache.getOrSet('x', 60, load)).resolves.toEqual({ a: 1 });
      expect(load).toHaveBeenCalledTimes(1);
    });

    it('hai scope khác nhau không dùng chung giá trị', async () => {
      await cache.getOrSet('a', 60, () => Promise.resolve(1));
      await expect(
        cache.getOrSet('b', 60, () => Promise.resolve(2)),
      ).resolves.toBe(2);
    });

    it('đọc N TRƯỚC khi gọi load', async () => {
      let getsWhenLoading: string[] = [];
      await cache.getOrSet('x', 60, () => {
        getsWhenLoading = [...store.gets];
        return Promise.resolve(1);
      });
      expect(getsWhenLoading[0]).toBe('cache:catalog:ver');
    });

    it('load ném lỗi (404, 400): không ghi cache, lỗi ném lại nguyên', async () => {
      const err = new Error('404');
      await expect(
        cache.getOrSet('x', 60, () => Promise.reject(err)),
      ).rejects.toBe(err);
      expect(store.cacheKeys()).toEqual([]);
    });

    it('sau lỗi, lần gọi kế tiếp vẫn gọi load lại (lỗi không bị nhớ)', async () => {
      const load = jest
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce('ok');
      await expect(cache.getOrSet('x', 60, load)).rejects.toThrow('boom');
      await expect(cache.getOrSet('x', 60, load)).resolves.toBe('ok');
      expect(load).toHaveBeenCalledTimes(2);
    });

    it('giá trị trong cache bị hỏng (không phải JSON): coi như trượt, gọi load', async () => {
      store.data.set('cache:catalog:v0:x', '{hỏng');
      const load = jest.fn().mockResolvedValue({ ok: true });
      await expect(cache.getOrSet('x', 60, load)).resolves.toEqual({
        ok: true,
      });
      expect(load).toHaveBeenCalledTimes(1);
    });
  });

  describe('bump', () => {
    it('khóa mới khác khóa cũ: load chạy lại và ghi dưới v1', async () => {
      const load = jest.fn().mockResolvedValue(1);
      await cache.getOrSet('x', 60, load);
      await cache.bump();
      await cache.getOrSet('x', 60, load);
      expect(load).toHaveBeenCalledTimes(2);
      expect(store.ttls.has('cache:catalog:v1:x')).toBe(true);
    });

    it('bump liên tiếp tăng phiên bản từng bước', async () => {
      await cache.bump();
      await cache.bump();
      expect(store.data.get('cache:catalog:ver')).toBe('2');
    });

    it('ghi xen giữa lúc đang load: dữ liệu cũ chỉ nằm ở khóa phiên bản cũ', async () => {
      await cache.getOrSet('x', 60, async () => {
        await cache.bump(); // admin ghi DB và bump giữa lúc người đọc đang đọc DB
        return 'cũ';
      });
      const load = jest.fn().mockResolvedValue('mới');
      await expect(cache.getOrSet('x', 60, load)).resolves.toBe('mới');
      expect(load).toHaveBeenCalledTimes(1);
    });
  });

  describe('fail-open', () => {
    it('Redis chết: getOrSet vẫn trả kết quả của load, không ném', async () => {
      store.fail = true;
      const load = jest.fn().mockResolvedValue(7);
      await expect(cache.getOrSet('x', 60, load)).resolves.toBe(7);
      await expect(cache.getOrSet('x', 60, load)).resolves.toBe(7);
      expect(load).toHaveBeenCalledTimes(2); // không cache được nên đọc DB mỗi lần
    });

    it('Redis chết: bump không ném', async () => {
      store.fail = true;
      await expect(cache.bump()).resolves.toBeUndefined();
    });

    it('chỉ ghi cache lỗi (đọc vẫn được): vẫn trả kết quả', async () => {
      jest.spyOn(store, 'set').mockRejectedValue(new Error('write fail'));
      await expect(
        cache.getOrSet('x', 60, () => Promise.resolve(5)),
      ).resolves.toBe(5);
    });
  });

  describe('tắt cache', () => {
    it('enabled=false: không chạm store, getOrSet luôn gọi load', async () => {
      store.enabled = false;
      const load = jest.fn().mockResolvedValue(1);
      await cache.getOrSet('x', 60, load);
      await cache.getOrSet('x', 60, load);
      await cache.bump();
      expect(load).toHaveBeenCalledTimes(2);
      expect(store.gets).toHaveLength(0);
      expect(store.data.size).toBe(0);
    });

    it('CacheService.disabled(): như trên, không cần Redis', async () => {
      const off = CacheService.disabled();
      const load = jest.fn().mockResolvedValue('v');
      await expect(off.getOrSet('x', 60, load)).resolves.toBe('v');
      await expect(off.getOrSet('x', 60, load)).resolves.toBe('v');
      await expect(off.bump()).resolves.toBeUndefined();
      expect(load).toHaveBeenCalledTimes(2);
    });
  });
});
