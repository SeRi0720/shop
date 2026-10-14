import { createHmac } from 'node:crypto';
import { VnpayService, formatVnDate, normalizeIp } from './vnpay.service';

const SECRET = 'TESTSECRETKEY1234567890ABCDEFGHIJ';
const hmac = (data: string) =>
  createHmac('sha512', SECRET).update(data).digest('hex');

const BASE_ENV = {
  VNPAY_TMN_CODE: 'TESTTMN1',
  VNPAY_HASH_SECRET: SECRET,
  VNPAY_RETURN_URL: 'http://localhost:5173/api/payments/vnpay/return',
  VNPAY_URL_TTL_MINUTES: '15',
};
const KEYS = [...Object.keys(BASE_ENV), 'VNPAY_PAY_URL', 'VNPAY_API_URL'];

// 15:44:10 giờ VN = 08:44:10 UTC
const CREATED = new Date('2026-10-12T08:44:10Z');

describe('VnpayService', () => {
  let svc: VnpayService;
  const saved: Record<string, string | undefined> = {};

  beforeAll(() => KEYS.forEach((k) => (saved[k] = process.env[k])));
  afterAll(() =>
    KEYS.forEach((k) =>
      saved[k] === undefined
        ? delete process.env[k]
        : (process.env[k] = saved[k]),
    ),
  );
  beforeEach(() => {
    KEYS.forEach((k) => delete process.env[k]);
    Object.assign(process.env, BASE_ENV);
    svc = new VnpayService();
  });
  afterEach(() => jest.restoreAllMocks());

  describe('ngày giờ và IP', () => {
    it('formatVnDate: GMT+7, đúng định dạng, qua nửa đêm UTC', () => {
      expect(formatVnDate(CREATED)).toBe('20261012154410');
      expect(formatVnDate(new Date('2026-10-12T17:30:00Z'))).toBe(
        '20261013003000',
      );
    });
    it('normalizeIp', () => {
      expect(normalizeIp('::1')).toBe('127.0.0.1');
      expect(normalizeIp('::ffff:127.0.0.1')).toBe('127.0.0.1');
      expect(normalizeIp('13.160.92.202')).toBe('13.160.92.202');
      expect(normalizeIp(undefined)).toBe('127.0.0.1');
    });
  });

  describe('cấu hình', () => {
    it('thiếu cấu hình: isConfigured false, buildPaymentUrl báo lỗi rõ', () => {
      delete process.env.VNPAY_HASH_SECRET;
      expect(svc.isConfigured()).toBe(false);
      expect(() =>
        svc.buildPaymentUrl({
          txnRef: '1',
          amount: 1000,
          orderInfo: 'x',
          createdAt: CREATED,
        }),
      ).toThrow('VNPay chưa được cấu hình');
    });
    it('TTL sai thì dùng mặc định 15', () => {
      process.env.VNPAY_URL_TTL_MINUTES = 'abc';
      expect(svc.urlTtlMinutes).toBe(15);
    });
  });

  describe('buildPaymentUrl', () => {
    const build = () =>
      svc.buildPaymentUrl({
        txnRef: '123',
        amount: 1_500_000,
        orderInfo: 'Thanh toan don hang 12',
        ip: '::1',
        createdAt: CREATED,
      });

    // Viết tay, độc lập với code: các tham số sắp theo tên.
    const EXPECTED_DATA =
      'vnp_Amount=150000000&vnp_Command=pay&vnp_CreateDate=20261012154410&vnp_CurrCode=VND' +
      '&vnp_ExpireDate=20261012155910&vnp_IpAddr=127.0.0.1&vnp_Locale=vn' +
      '&vnp_OrderInfo=Thanh+toan+don+hang+12&vnp_OrderType=other' +
      '&vnp_ReturnUrl=http%3A%2F%2Flocalhost%3A5173%2Fapi%2Fpayments%2Fvnpay%2Freturn' +
      '&vnp_TmnCode=TESTTMN1&vnp_TxnRef=123&vnp_Version=2.1.0';

    it('chuỗi ký và chữ ký khớp giá trị tính độc lập', () => {
      const [base, query] = build().split('?');
      expect(base).toBe('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html');
      expect(query).toBe(
        `${EXPECTED_DATA}&vnp_SecureHash=${hmac(EXPECTED_DATA)}`,
      );
    });
    it('vnp_Amount = số tiền x 100; ExpireDate - CreateDate = TTL', () => {
      process.env.VNPAY_URL_TTL_MINUTES = '2';
      const q = new URL(build()).searchParams;
      expect(q.get('vnp_Amount')).toBe('150000000');
      expect(q.get('vnp_CreateDate')).toBe('20261012154410');
      expect(q.get('vnp_ExpireDate')).toBe('20261012154610');
    });
    it('số tiền không hợp lệ bị từ chối', () => {
      for (const amount of [0, -5, 1.5, NaN]) {
        expect(() =>
          svc.buildPaymentUrl({
            txnRef: '1',
            amount,
            orderInfo: 'x',
            createdAt: CREATED,
          }),
        ).toThrow();
      }
    });
  });

  describe('verifyCallback', () => {
    const signedQuery = () =>
      Object.fromEntries(
        new URL(
          svc.buildPaymentUrl({
            txnRef: '123',
            amount: 50_000,
            orderInfo: 'Thanh toan',
            createdAt: CREATED,
          }),
        ).searchParams,
      );

    it('hợp lệ: trả tham số, không còn vnp_SecureHash', () => {
      const p = svc.verifyCallback(signedQuery());
      expect(p?.vnp_TxnRef).toBe('123');
      expect(p).not.toHaveProperty('vnp_SecureHash');
    });
    it('sửa số tiền hoặc txnRef thì bị từ chối', () => {
      expect(
        svc.verifyCallback({ ...signedQuery(), vnp_Amount: '1' }),
      ).toBeNull();
      expect(
        svc.verifyCallback({ ...signedQuery(), vnp_TxnRef: '124' }),
      ).toBeNull();
    });
    it('thiếu vnp_SecureHash hoặc khóa sai thì bị từ chối', () => {
      const q = signedQuery();
      const noHash: Record<string, string> = { ...q };
      delete noHash.vnp_SecureHash;
      expect(svc.verifyCallback(noHash)).toBeNull();
      process.env.VNPAY_HASH_SECRET = 'KHOASAI';
      expect(svc.verifyCallback(q)).toBeNull();
    });
    it('tham số là mảng/object bị từ chối, không ném lỗi', () => {
      expect(
        svc.verifyCallback({ ...signedQuery(), vnp_Amount: ['1', '2'] }),
      ).toBeNull();
      expect(
        svc.verifyCallback({ ...signedQuery(), vnp_Amount: { a: '1' } }),
      ).toBeNull();
    });
    it('bỏ qua tham số không phải vnp_*', () => {
      expect(
        svc.verifyCallback({ ...signedQuery(), foo: 'bar' }),
      ).not.toBeNull();
    });
  });

  describe('queryTransaction', () => {
    // Thứ tự trường viết tay theo tài liệu chính thức, độc lập với code.
    const RESP_ORDER = [
      'vnp_ResponseId',
      'vnp_Command',
      'vnp_ResponseCode',
      'vnp_Message',
      'vnp_TmnCode',
      'vnp_TxnRef',
      'vnp_Amount',
      'vnp_BankCode',
      'vnp_PayDate',
      'vnp_TransactionNo',
      'vnp_TransactionType',
      'vnp_TransactionStatus',
      'vnp_OrderInfo',
      'vnp_PromotionCode',
      'vnp_PromotionAmount',
    ];
    const signedResponse = (o: Record<string, string> = {}) => {
      const b: Record<string, string> = {
        vnp_ResponseId: 'R1',
        vnp_Command: 'querydr',
        vnp_ResponseCode: '00',
        vnp_Message: 'QueryDr Success',
        vnp_TmnCode: 'TESTTMN1',
        vnp_TxnRef: '123',
        vnp_Amount: '150000000',
        vnp_BankCode: 'NCB',
        vnp_PayDate: '20261012155000',
        vnp_TransactionNo: '14226112',
        vnp_TransactionType: '01',
        vnp_TransactionStatus: '00',
        vnp_OrderInfo: 'x',
        ...o,
      };
      b.vnp_SecureHash = hmac(RESP_ORDER.map((k) => b[k] ?? '').join('|'));
      return b;
    };
    const mockFetch = (
      body: unknown,
      init: { ok?: boolean; status?: number } = {},
    ) =>
      jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: init.ok ?? true,
        status: init.status ?? 200,
        json: async () => body,
      } as Response);
    const query = () =>
      svc.queryTransaction({
        txnRef: '123',
        amount: 1_500_000,
        transactionDate: CREATED,
      });

    it('dựng đúng yêu cầu và chữ ký (POST JSON)', async () => {
      const f = mockFetch(signedResponse());
      await query();
      const [url, init] = f.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
      );
      expect(init.method).toBe('POST');
      const b = JSON.parse(init.body as string) as Record<string, string>;
      expect(b.vnp_Command).toBe('querydr');
      expect(b.vnp_TransactionDate).toBe('20261012154410');
      expect(b.vnp_RequestId).toMatch(/^[0-9a-f]{1,32}$/);
      const data = [
        b.vnp_RequestId,
        b.vnp_Version,
        b.vnp_Command,
        b.vnp_TmnCode,
        b.vnp_TxnRef,
        b.vnp_TransactionDate,
        b.vnp_CreateDate,
        b.vnp_IpAddr,
        b.vnp_OrderInfo,
      ].join('|');
      expect(b.vnp_SecureHash).toBe(hmac(data));
    });

    it('PAID', async () => {
      mockFetch(signedResponse());
      const r = await query();
      expect(r).toMatchObject({ kind: 'PAID', transactionNo: '14226112' });
      if (r.kind === 'PAID')
        expect(r.payload).not.toHaveProperty('vnp_SecureHash');
    });
    it('FAILED (TransactionStatus 11: hết hạn chờ thanh toán)', async () => {
      mockFetch(signedResponse({ vnp_TransactionStatus: '11' }));
      expect((await query()).kind).toBe('FAILED');
    });
    it('94 (trùng yêu cầu) không có chữ ký: ERROR nêu đúng mã, rateLimited, không báo sai chữ ký', async () => {
      mockFetch({
        vnp_ResponseCode: '94',
        vnp_Message: 'Request is duplicated',
      });
      const r = await query();
      expect(r).toMatchObject({ kind: 'ERROR', rateLimited: true });
      if (r.kind === 'ERROR') {
        expect(r.reason).toContain('94');
        expect(r.reason).not.toContain('Chữ ký');
      }
    });
    it('lỗi không ký khác (99): ERROR, không rateLimited', async () => {
      mockFetch({ vnp_ResponseCode: '99', vnp_Message: 'Unknown' });
      const r = await query();
      expect(r).toMatchObject({ kind: 'ERROR' });
      expect((r as { rateLimited?: boolean }).rateLimited).toBeFalsy();
    });
    it('FAILED (TransactionStatus 02)', async () => {
      mockFetch(signedResponse({ vnp_TransactionStatus: '02' }));
      expect((await query()).kind).toBe('FAILED');
    });
    it('chưa hoàn tất (status 01) và không tìm thấy (91) là NOT_FOUND_OR_PENDING', async () => {
      mockFetch(signedResponse({ vnp_TransactionStatus: '01' }));
      expect((await query()).kind).toBe('NOT_FOUND_OR_PENDING');
      mockFetch(
        signedResponse({ vnp_ResponseCode: '91', vnp_Message: 'Not found' }),
      );
      expect((await query()).kind).toBe('NOT_FOUND_OR_PENDING');
    });
    it.each([
      ['giao dịch đảo (04)', { vnp_TransactionStatus: '04' }],
      ['ResponseCode 94 (trùng yêu cầu)', { vnp_ResponseCode: '94' }],
      ['ResponseCode 99', { vnp_ResponseCode: '99' }],
      ['txnRef không khớp', { vnp_TxnRef: '999' }],
      ['số tiền không khớp', { vnp_Amount: '100' }],
      ['không phải giao dịch thanh toán', { vnp_TransactionType: '02' }],
    ])('ERROR: %s', async (_name, override) => {
      mockFetch(signedResponse(override));
      expect((await query()).kind).toBe('ERROR');
    });
    it('ERROR: chữ ký phản hồi sai (sửa sau khi ký)', async () => {
      mockFetch({
        ...signedResponse(),
        vnp_TransactionStatus: '00',
        vnp_Amount: '1',
      });
      expect((await query()).kind).toBe('ERROR');
    });
    it('ERROR: HTTP lỗi, JSON hỏng, mạng/timeout, phản hồi không phải object', async () => {
      mockFetch({}, { ok: false, status: 500 });
      expect((await query()).kind).toBe('ERROR');
      jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('x');
        },
      } as unknown as Response);
      expect((await query()).kind).toBe('ERROR');
      jest
        .spyOn(globalThis, 'fetch')
        .mockRejectedValue(
          Object.assign(new Error('t'), { name: 'TimeoutError' }),
        );
      expect((await query()).kind).toBe('ERROR');
      mockFetch('abc');
      expect((await query()).kind).toBe('ERROR');
    });
  });
});
