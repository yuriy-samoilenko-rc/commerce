import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { StockAlertsService } from './stock-alerts.service';

const checkMs = () => {
  const seconds = Number(process.env.STOCK_ALERT_CHECK_SECONDS);
  return (Number.isFinite(seconds) && seconds > 0 ? seconds : 60) * 1000;
};

/**
 * Periodically sends "back in stock" emails. Polling instead of hooking every stock
 * movement keeps receivings, transfers and returns untouched; a minute's delay is fine.
 */
@Injectable()
export class StockAlertNotifier
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(StockAlertNotifier.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly alerts: StockAlertsService) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.tick(), checkMs());
  }

  onApplicationShutdown() {
    clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const sent = await this.alerts.notifyAvailable();
      if (sent) this.logger.log(`Sent ${sent} back-in-stock email(s)`);
    } catch (e) {
      this.logger.error(
        'Back-in-stock check failed',
        e instanceof Error ? e.stack : e,
      );
    } finally {
      this.running = false;
    }
  }
}
