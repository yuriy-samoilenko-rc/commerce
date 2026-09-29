import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ProductsService } from './products.service';

const checkMs = () => {
  const seconds = Number(process.env.SALE_EXPIRY_CHECK_SECONDS);
  return (Number.isFinite(seconds) && seconds > 0 ? seconds : 60) * 1000;
};

/**
 * Periodically ends sales whose end date has passed. Orders never rely on it: they
 * check the end date themselves, so a late run only delays what the shop displays.
 */
@Injectable()
export class SaleExpiryService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(SaleExpiryService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly products: ProductsService) {}

  onApplicationBootstrap() {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), checkMs());
  }

  onApplicationShutdown() {
    clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const ended = await this.products.endExpiredSales();
      if (ended) this.logger.log(`Ended the sale on ${ended} product(s)`);
    } catch (e) {
      this.logger.error(
        'Sale expiry check failed',
        e instanceof Error ? e.stack : e,
      );
    } finally {
      this.running = false;
    }
  }
}
