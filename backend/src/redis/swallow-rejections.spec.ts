import { swallowRejections } from './swallow-rejections';

describe('swallowRejections', () => {
  it('Promise bị reject: nuốt lỗi, báo onError, giữ nguyên this', async () => {
    const client = {
      tag: 'c1',
      publish(this: { tag: string }) {
        return Promise.reject(new Error(`down ${this.tag}`));
      },
    };
    const onError = jest.fn();
    swallowRejections(client, ['publish'], onError);
    await expect(client.publish()).resolves.toBeUndefined();
    expect((onError.mock.calls[0] as [Error])[0].message).toBe('down c1');
  });

  it('thành công: trả nguyên kết quả, không gọi onError', async () => {
    const client = { publish: jest.fn().mockResolvedValue(2) };
    const onError = jest.fn();
    swallowRejections(client, ['publish'], onError);
    await expect(client.publish()).resolves.toBe(2);
    expect(onError).not.toHaveBeenCalled();
  });

  it('chỉ bọc các phương thức được chỉ định', () => {
    const get = jest.fn();
    const client = { publish: jest.fn(), get };
    swallowRejections(client, ['publish']);
    expect(client.get).toBe(get);
  });
});
