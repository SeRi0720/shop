import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export interface VnpayConfig {
  tmnCode: string;
  hashSecret: string;
  payUrl: string;
  apiUrl: string;
  returnUrl: string;
  urlTtlMinutes: number;
}

export type VnpayQueryOutcome =
  | { kind: 'PAID'; transactionNo: string; payload: Record<string, string> }
  | { kind: 'FAILED'; payload: Record<string, string> }
  | { kind: 'NOT_FOUND_OR_PENDING' }
  | { kind: 'ERROR'; reason: string; rateLimited?: boolean };

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const QUERY_TIMEOUT_MS = 5000;
const VERSION = '2.1.0';

/** yyyyMMddHHmmss theo UTC+7 (GMT+7), không phụ thuộc múi giờ máy. */
export function formatVnDate(date: Date): string {
  const t = new Date(date.getTime() + VN_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${t.getUTCFullYear()}${p(t.getUTCMonth() + 1)}${p(t.getUTCDate())}` +
    `${p(t.getUTCHours())}${p(t.getUTCMinutes())}${p(t.getUTCSeconds())}`
  );
}

/** VNPay yêu cầu vnp_IpAddr dài 7-45 ký tự: "::1" không hợp lệ. */
export function normalizeIp(ip?: string): string {
  if (!ip) return '127.0.0.1';
  let v = ip.trim();
  if (v.startsWith('::ffff:')) v = v.slice(7);
  if (v === '::1') return '127.0.0.1';
  return v.length >= 7 && v.length <= 45 ? v : '127.0.0.1';
}

/** Tương đương urlencode của PHP (mẫu chính thức của VNPay): khoảng trắng -> '+'. */
const urlEncode = (value: string) =>
  encodeURIComponent(value)
    .replace(
      /[!'()*~]/g,
      (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
    )
    .replace(/%20/g, '+');

const hmacSha512 = (secret: string, data: string) =>
  createHmac('sha512', secret).update(data, 'utf8').digest('hex');

/** Chuỗi để ký: tham số sắp theo tên, key=value đã mã hóa, nối bằng '&'. */
const canonical = (params: Record<string, string>) =>
  Object.keys(params)
    .sort()
    .map((k) => `${urlEncode(k)}=${urlEncode(params[k])}`)
    .join('&');

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b.toLowerCase(), 'utf8');
  return x.length === y.length && timingSafeEqual(x, y);
};

// Thứ tự trường để ký phản hồi querydr (theo tài liệu chính thức, mục querydr).
const QUERY_RESPONSE_FIELDS = [
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
] as const;

@Injectable()
export class VnpayService implements OnModuleInit {
  private readonly logger = new Logger(VnpayService.name);

  /** Đọc env lúc dùng (không đọc ở top-level) để chắc chắn .env đã được nạp. */
  private readConfig(): VnpayConfig | null {
    const e = process.env;
    const tmnCode = e.VNPAY_TMN_CODE?.trim();
    const hashSecret = e.VNPAY_HASH_SECRET?.trim();
    const returnUrl = e.VNPAY_RETURN_URL?.trim();
    if (!tmnCode || !hashSecret || !returnUrl) return null;
    const ttl = Number(e.VNPAY_URL_TTL_MINUTES ?? 15);
    return {
      tmnCode,
      hashSecret,
      returnUrl,
      payUrl:
        e.VNPAY_PAY_URL?.trim() ||
        'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      apiUrl:
        e.VNPAY_API_URL?.trim() ||
        'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
      urlTtlMinutes:
        Number.isInteger(ttl) && ttl >= 1 && ttl <= 1440 ? ttl : 15,
    };
  }

  private requireConfig(): VnpayConfig {
    const cfg = this.readConfig();
    if (!cfg) throw new Error('VNPay chưa được cấu hình');
    return cfg;
  }

  isConfigured(): boolean {
    return this.readConfig() !== null;
  }

  get urlTtlMinutes(): number {
    return this.requireConfig().urlTtlMinutes;
  }

  /** Chỉ cảnh báo, không làm sập app: COD vẫn phải chạy khi chưa có khóa VNPay. */
  onModuleInit() {
    if (!this.isConfigured()) {
      this.logger.warn(
        'Thiếu VNPAY_TMN_CODE / VNPAY_HASH_SECRET / VNPAY_RETURN_URL: đặt hàng VNPay sẽ bị từ chối',
      );
    }
  }

  /** Mã tham chiếu giao dịch: toàn chữ số, duy nhất (mã đơn đệm 0 + thời điểm tạo). */
  makeTxnRef(orderId: number, now = new Date()): string {
    return `${String(orderId).padStart(8, '0')}${formatVnDate(now)}`;
  }

  buildPaymentUrl(input: {
    txnRef: string;
    amount: number; // VND, số nguyên
    orderInfo: string; // ASCII không dấu
    ip?: string;
    createdAt: Date; // createdAt của dòng payments, dùng lại khi truy vấn
  }): string {
    const cfg = this.requireConfig();
    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      throw new Error('Số tiền thanh toán không hợp lệ');
    }
    const params: Record<string, string> = {
      vnp_Version: VERSION,
      vnp_Command: 'pay',
      vnp_TmnCode: cfg.tmnCode,
      vnp_Amount: String(input.amount * 100),
      vnp_CurrCode: 'VND',
      vnp_TxnRef: input.txnRef,
      vnp_OrderInfo: input.orderInfo,
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_ReturnUrl: cfg.returnUrl,
      vnp_IpAddr: normalizeIp(input.ip),
      vnp_CreateDate: formatVnDate(input.createdAt),
      vnp_ExpireDate: formatVnDate(
        new Date(input.createdAt.getTime() + cfg.urlTtlMinutes * 60_000),
      ),
    };
    const data = canonical(params);
    return `${cfg.payUrl}?${data}&vnp_SecureHash=${hmacSha512(cfg.hashSecret, data)}`;
  }

  /**
   * Kiểm tra chữ ký của IPN / ReturnUrl (query của Express).
   * Trả về các tham số vnp_* (đã bỏ vnp_SecureHash) nếu hợp lệ, ngược lại null.
   */
  verifyCallback(
    query: Record<string, unknown>,
  ): Record<string, string> | null {
    const { hashSecret } = this.requireConfig();
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(query)) {
      if (!key.startsWith('vnp_')) continue;
      if (typeof value !== 'string') return null; // ?a=1&a=2 thành mảng
      params[key] = value;
    }
    const received = params['vnp_SecureHash'];
    delete params['vnp_SecureHash'];
    delete params['vnp_SecureHashType'];
    if (!received) return null;
    const expected = hmacSha512(hashSecret, canonical(params));
    return safeEqual(expected, received) ? params : null;
  }

  /**
   * Hỏi VNPay kết quả một giao dịch (querydr). KHÔNG gọi trong transaction DB.
   * Không tự thử lại; mọi lỗi mạng/định dạng/chữ ký/không khớp đều thành ERROR.
   */
  async queryTransaction(input: {
    txnRef: string;
    amount: number; // VND, số tiền đã lưu trong payments
    transactionDate: Date; // = createdAt của payments (vnp_CreateDate lúc tạo URL)
    ip?: string;
    now?: Date;
  }): Promise<VnpayQueryOutcome> {
    const cfg = this.readConfig();
    if (!cfg) return { kind: 'ERROR', reason: 'VNPay chưa được cấu hình' };

    const requestId = randomBytes(12).toString('hex'); // 24 ký tự, duy nhất
    const createDate = formatVnDate(input.now ?? new Date());
    const transactionDate = formatVnDate(input.transactionDate);
    const ipAddr = normalizeIp(input.ip);
    const orderInfo = `Truy van giao dich ${input.txnRef}`;
    const data = [
      requestId,
      VERSION,
      'querydr',
      cfg.tmnCode,
      input.txnRef,
      transactionDate,
      createDate,
      ipAddr,
      orderInfo,
    ].join('|');
    const body = {
      vnp_RequestId: requestId,
      vnp_Version: VERSION,
      vnp_Command: 'querydr',
      vnp_TmnCode: cfg.tmnCode,
      vnp_TxnRef: input.txnRef,
      vnp_OrderInfo: orderInfo,
      vnp_TransactionDate: transactionDate,
      vnp_CreateDate: createDate,
      vnp_IpAddr: ipAddr,
      vnp_SecureHash: hmacSha512(cfg.hashSecret, data),
    };

    let json: unknown;
    try {
      const res = await fetch(cfg.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
      });
      if (!res.ok) return { kind: 'ERROR', reason: `HTTP ${res.status}` };
      json = await res.json();
    } catch (error) {
      const name = error instanceof Error ? error.name : 'unknown';
      return { kind: 'ERROR', reason: `Không gọi được VNPay (${name})` };
    }
    return this.classifyQueryResponse(json, {
      txnRef: input.txnRef,
      amount: input.amount,
    });
  }

  /** Tách riêng để test không cần mạng. Không bao giờ ném lỗi. */
  classifyQueryResponse(
    raw: unknown,
    expect: { txnRef: string; amount: number },
  ): VnpayQueryOutcome {
    const cfg = this.readConfig();
    if (!cfg) return { kind: 'ERROR', reason: 'VNPay chưa được cấu hình' };
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      return { kind: 'ERROR', reason: 'Phản hồi không phải object' };
    }
    const r: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === 'string' || typeof v === 'number') r[k] = String(v);
    }
    const get = (k: string) => r[k] ?? '';

    // Lỗi mức hệ thống của VNPay (ví dụ 94 "Request is duplicated") KHÔNG kèm chữ ký.
    // Không tin để đổi dữ liệu, nhưng phải nêu đúng mã thay vì báo nhầm "sai chữ ký".
    if (!get('vnp_SecureHash')) {
      const code = get('vnp_ResponseCode') || '(trống)';
      const message = get('vnp_Message').slice(0, 100);
      return {
        kind: 'ERROR',
        reason: `VNPay trả lỗi không ký: ResponseCode ${code}${message ? ` (${message})` : ''}`,
        rateLimited: code === '94', // trùng yêu cầu trong thời gian giới hạn
      };
    }

    const signed = QUERY_RESPONSE_FIELDS.map(get).join('|');
    if (!safeEqual(hmacSha512(cfg.hashSecret, signed), get('vnp_SecureHash'))) {
      return { kind: 'ERROR', reason: 'Chữ ký phản hồi không hợp lệ' };
    }

    const code = get('vnp_ResponseCode');
    if (code === '91') return { kind: 'NOT_FOUND_OR_PENDING' };
    if (code !== '00') {
      return { kind: 'ERROR', reason: `ResponseCode ${code || '(trống)'}` };
    }
    if (get('vnp_TxnRef') !== expect.txnRef) {
      return { kind: 'ERROR', reason: 'txnRef không khớp' };
    }
    if (get('vnp_TransactionType') !== '01') {
      return { kind: 'ERROR', reason: 'Không phải giao dịch thanh toán' };
    }
    if (get('vnp_Amount') !== String(expect.amount * 100)) {
      return { kind: 'ERROR', reason: 'Số tiền không khớp' };
    }

    const payload = { ...r };
    delete payload['vnp_SecureHash'];
    switch (get('vnp_TransactionStatus')) {
      case '00':
        return {
          kind: 'PAID',
          transactionNo: get('vnp_TransactionNo'),
          payload,
        };
      case '01':
        return { kind: 'NOT_FOUND_OR_PENDING' }; // chưa hoàn tất
      case '02':
        return { kind: 'FAILED', payload };
      case '11':
        // Đã hết hạn chờ thanh toán. Bảng TransactionStatus không liệt kê mã này (quan sát
        // thực tế ở sandbox), nhưng ResponseCode 11 có nghĩa đó và tài liệu IPN ghi
        // "khác 00 = không thành công tại VNPAY". Hết hạn thì không thể trả tiền nữa.
        return { kind: 'FAILED', payload };
      default: // 04 (giao dịch đảo), 07 (nghi ngờ)...: không tự quyết định
        return {
          kind: 'ERROR',
          reason: `TransactionStatus ${get('vnp_TransactionStatus')}`,
        };
    }
  }
}
