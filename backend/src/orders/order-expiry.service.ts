import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { orderSettings } from './order-settings';
import { OrdersService } from './orders.service';

/**
 * Periodically cancels orders whose reservation timer ran out and frees their stock.
 * Safe to run on several servers at once: each cancellation re-checks the order state.
 */
@Injectable()
export class OrderExpiryService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OrderExpiryService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly orders: OrdersService) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.tick(), orderSettings().expiryCheckMs);
  }

  onApplicationShutdown() {
    clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const expired = await this.orders.expireDue();
      if (expired) this.logger.log(`Cancelled ${expired} order(s) with expired reservations`);
    } catch (e) {
      this.logger.error('Order expiry check failed', e instanceof Error ? e.stack : e);
    } finally {
      this.running = false;
    }
  }
}
