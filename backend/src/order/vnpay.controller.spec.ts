import { VnpayController } from './vnpay.controller';

function setup() {
  const vnpay = { verifyCallback: jest.fn() };
  const orders = { applyVnpayResult: jest.fn(), syncVnpayPayment: jest.fn() };
  const payments = { findByTxnRef: jest.fn() };
  const ctrl = new VnpayController(
    vnpay as never,
    orders as never,
    payments as never,
  );
  const res = { redirect: jest.fn() };
  return { ctrl, vnpay, orders, payments, res };
}

const OK = {
  vnp_TxnRef: 'T1',
  vnp_ResponseCode: '00',
  vnp_TransactionStatus: '00',
};

describe('VnpayController.ipn', () => {
  it('chữ ký sai: 97, không chạm DB', async () => {
    const t = setup();
    t.vnpay.verifyCallback.mockReturnValue(null);
    expect(await t.ctrl.ipn({})).toEqual({
      RspCode: '97',
      Message: 'Invalid signature',
    });
    expect(t.orders.applyVnpayResult).not.toHaveBeenCalled();
  });

  it('thiếu vnp_TxnRef: 01', async () => {
    const t = setup();
    t.vnpay.verifyCallback.mockReturnValue({});
    expect((await t.ctrl.ipn({})).RspCode).toBe('01');
  });

  it.each([
    ['APPLIED_PAID', '00'],
    ['APPLIED_FAILED', '00'],
    ['LATE_PAID', '00'],
    ['ALREADY_CONFIRMED', '02'],
    ['NOT_FOUND', '01'],
    ['AMOUNT_MISMATCH', '04'],
  ])('kết quả %s trả RspCode %s', async (outcome, code) => {
    const t = setup();
    t.vnpay.verifyCallback.mockReturnValue(OK);
    t.orders.applyVnpayResult.mockResolvedValue(outcome);
    expect((await t.ctrl.ipn({})).RspCode).toBe(code);
  });

  it('thành công chỉ khi CẢ ResponseCode và TransactionStatus đều 00', async () => {
    const t = setup();
    t.orders.applyVnpayResult.mockResolvedValue('APPLIED_PAID');
    for (const [rc, ts, expected] of [
      ['00', '00', true],
      ['00', '02', false],
      ['24', '00', false],
      ['24', '02', false],
    ] as const) {
      t.vnpay.verifyCallback.mockReturnValue({
        vnp_TxnRef: 'T1',
        vnp_ResponseCode: rc,
        vnp_TransactionStatus: ts,
      });
      await t.ctrl.ipn({});
      expect(t.orders.applyVnpayResult).toHaveBeenLastCalledWith(
        'T1',
        expected,
        expect.any(Object),
      );
    }
  });

  it('lỗi bất ngờ: 99 (vẫn là giá trị trả về, không ném lỗi)', async () => {
    const t = setup();
    t.vnpay.verifyCallback.mockReturnValue(OK);
    t.orders.applyVnpayResult.mockRejectedValue(new Error('db down'));
    expect((await t.ctrl.ipn({})).RspCode).toBe('99');
  });
});

describe('VnpayController.handleReturn', () => {
  it('chữ ký sai: 302 /orders?vnpay=invalid, không hỏi DB, không hỏi VNPay', async () => {
    const t = setup();
    t.vnpay.verifyCallback.mockReturnValue(null);
    await t.ctrl.handleReturn({}, t.res as never);
    expect(t.res.redirect).toHaveBeenCalledWith(302, '/orders?vnpay=invalid');
    expect(t.payments.findByTxnRef).not.toHaveBeenCalled();
    expect(t.orders.syncVnpayPayment).not.toHaveBeenCalled();
  });

  it('chữ ký đúng nhưng txnRef lạ: về /orders?vnpay=invalid', async () => {
    const t = setup();
    t.vnpay.verifyCallback.mockReturnValue(OK);
    t.payments.findByTxnRef.mockResolvedValue(null);
    await t.ctrl.handleReturn({}, t.res as never);
    expect(t.res.redirect).toHaveBeenCalledWith(302, '/orders?vnpay=invalid');
  });

  it.each([
    ['PAID', 'success'],
    ['FAILED', 'failed'],
    ['PENDING', 'pending'],
    ['ERROR', 'pending'],
  ])('kết quả queryDr %s: về /orders/7?vnpay=%s', async (state, label) => {
    const t = setup();
    t.vnpay.verifyCallback.mockReturnValue(OK);
    t.payments.findByTxnRef.mockResolvedValue({ orderId: 7 });
    t.orders.syncVnpayPayment.mockResolvedValue(state);
    await t.ctrl.handleReturn({}, t.res as never);
    expect(t.orders.syncVnpayPayment).toHaveBeenCalledWith(7);
    expect(t.res.redirect).toHaveBeenCalledWith(
      302,
      `/orders/7?vnpay=${label}`,
    );
  });

  it('mã phản hồi trên URL (kể cả 00 do người dùng sửa) không quyết định kết quả; không bao giờ gọi applyVnpayResult', async () => {
    const t = setup();
    t.vnpay.verifyCallback.mockReturnValue(OK); // ResponseCode 00 trên URL
    t.payments.findByTxnRef.mockResolvedValue({ orderId: 7 });
    t.orders.syncVnpayPayment.mockResolvedValue('PENDING'); // VNPay nói chưa thanh toán
    await t.ctrl.handleReturn({}, t.res as never);
    expect(t.res.redirect).toHaveBeenCalledWith(302, '/orders/7?vnpay=pending');
    expect(t.orders.applyVnpayResult).not.toHaveBeenCalled();
  });

  it('sync ném lỗi: vẫn chuyển hướng, về trang đơn với vnpay=pending', async () => {
    const t = setup();
    t.vnpay.verifyCallback.mockReturnValue(OK);
    t.payments.findByTxnRef.mockResolvedValue({ orderId: 7 });
    t.orders.syncVnpayPayment.mockRejectedValue(new Error('boom'));
    await t.ctrl.handleReturn({}, t.res as never);
    expect(t.res.redirect).toHaveBeenCalledWith(302, '/orders/7?vnpay=pending');
  });
});
