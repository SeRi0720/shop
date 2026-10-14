import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderService } from './order.service';

/**
 * Chạy mỗi phút. Toàn bộ logic nằm trong OrderService.cancelExpiredVnpayOrders(now) nên
 * đổi cách lên lịch (cron, setInterval...) không ảnh hưởng gì tới nghiệp vụ.
 * Nhiều instance cùng chạy vẫn an toàn: mỗi đơn xử lý dưới khóa dòng và kiểm tra lại trạng thái.
 */
@Injectable()
export class OrderExpiryScheduler {
  private readonly logger = new Logger(OrderExpiryScheduler.name);
  private running = false;

  constructor(private readonly orders: OrderService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async run(): Promise<void> {
    // Lượt trước còn đang chờ VNPay (mỗi truy vấn tối đa 5 giây, tối đa 20 đơn): bỏ lượt này.
    if (this.running) return;
    this.running = true;
    try {
      const r = await this.orders.cancelExpiredVnpayOrders(new Date());
      if (r.checked > 0) {
        this.logger.log(
          `Tự hủy VNPay: kiểm tra ${r.checked}, đã thanh toán ${r.paid}, hủy ${r.cancelled}, bỏ qua ${r.skipped}`,
        );
      }
    } catch (error) {
      this.logger.error(`Tự hủy VNPay lỗi: ${String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
