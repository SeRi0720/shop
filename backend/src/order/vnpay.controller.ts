import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PaymentService } from '../payment/payment.service';
import { VnpayService } from '../payment/vnpay.service';
import { OrderService } from './order.service';
import type { VnpayApplyOutcome } from './order.types';

type IpnResponse = { RspCode: string; Message: string };

const OK: IpnResponse = { RspCode: '00', Message: 'Confirm Success' };
const IPN_RESPONSE: Record<VnpayApplyOutcome, IpnResponse> = {
  APPLIED_PAID: OK,
  APPLIED_FAILED: OK, // đã ghi nhận kết quả thất bại: VNPay không cần gửi lại
  LATE_PAID: OK,
  ALREADY_CONFIRMED: { RspCode: '02', Message: 'Order already confirmed' },
  NOT_FOUND: { RspCode: '01', Message: 'Order not found' },
  AMOUNT_MISMATCH: { RspCode: '04', Message: 'Invalid amount' },
};

// Đặt trong OrderModule (không phải PaymentModule) để tránh vòng phụ thuộc
// OrderModule <-> PaymentModule: OrderModule đã import PaymentModule.
@ApiTags('payments')
@Controller('payments/vnpay')
export class VnpayController {
  private readonly logger = new Logger(VnpayController.name);

  constructor(
    private readonly vnpay: VnpayService,
    private readonly orders: OrderService,
    private readonly payments: PaymentService,
  ) {}

  /**
   * IPN: máy chủ VNPay gọi máy chủ mình (GET). Không đăng nhập, độ tin cậy dựa vào chữ ký.
   * Luôn trả HTTP 200 kèm { RspCode, Message }. KHÔNG dùng DTO có whitelist cho query
   * (sẽ làm rơi các tham số vnp_* lạ và làm sai chữ ký).
   */
  @Get('ipn')
  @ApiOperation({
    summary: 'IPN của VNPay (server gọi server, xác thực bằng chữ ký)',
  })
  async ipn(@Query() query: Record<string, unknown>): Promise<IpnResponse> {
    try {
      // Bước 1, không chạm DB: chữ ký sai thì dừng ngay.
      const params = this.vnpay.verifyCallback(query);
      if (!params) return { RspCode: '97', Message: 'Invalid signature' };

      const txnRef = params.vnp_TxnRef;
      if (!txnRef) return IPN_RESPONSE.NOT_FOUND;

      const success =
        params.vnp_ResponseCode === '00' &&
        params.vnp_TransactionStatus === '00';
      const outcome = await this.orders.applyVnpayResult(
        txnRef,
        success,
        params,
      );
      this.logger.log(
        `IPN ${txnRef}: ${success ? 'thành công' : 'thất bại'} -> ${outcome}`,
      );
      return IPN_RESPONSE[outcome];
    } catch (error) {
      this.logger.error(`IPN lỗi bất ngờ: ${String(error)}`);
      return { RspCode: '99', Message: 'Unknown error' }; // VNPay sẽ gửi lại
    }
  }

  /**
   * ReturnUrl: trình duyệt của khách. Chỉ KIỂM CHỮ KÝ rồi nhờ server hỏi VNPay (queryDr);
   * mã phản hồi trên URL KHÔNG được dùng để đổi trạng thái đơn.
   */
  @Get('return')
  @ApiOperation({
    summary: 'ReturnUrl: kiểm chữ ký, hỏi VNPay, chuyển hướng về trang đơn',
  })
  async handleReturn(
    @Query() query: Record<string, unknown>,
    @Res() res: Response,
  ): Promise<void> {
    let target = '/orders?vnpay=invalid';
    try {
      const params = this.vnpay.verifyCallback(query);
      const payment = params?.vnp_TxnRef
        ? await this.payments.findByTxnRef(params.vnp_TxnRef)
        : null;
      if (payment) {
        target = `/orders/${payment.orderId}?vnpay=pending`;
        const state = await this.orders.syncVnpayPayment(payment.orderId);
        const label =
          state === 'PAID'
            ? 'success'
            : state === 'FAILED'
              ? 'failed'
              : 'pending';
        target = `/orders/${payment.orderId}?vnpay=${label}`;
      }
    } catch (error) {
      this.logger.error(`ReturnUrl lỗi: ${String(error)}`);
    }
    res.redirect(302, target);
  }
}
