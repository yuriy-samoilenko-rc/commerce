import { DeliveryMethod, PaymentMethod } from '../generated/prisma/client';

const positive = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const orderSettings = () => ({
  paymentTtlMs: positive('ORDER_PAYMENT_TTL_MINUTES', 30) * 60_000,
  confirmTtlMs: positive('ORDER_CONFIRM_TTL_HOURS', 24) * 3_600_000,
  expiryCheckMs: positive('ORDER_EXPIRY_CHECK_SECONDS', 60) * 1000,
});

// Until delivery pricing gets its own settings screen (ТЗ Settings → Delivery).
export const DELIVERY_FEES: Record<DeliveryMethod, string> = {
  PICKUP: '0.00',
  COURIER: '10.00',
};

/** Online card orders must be paid quickly; the others wait for a manager to confirm. */
export function reservationTtlMs(method: PaymentMethod) {
  const s = orderSettings();
  return method === PaymentMethod.CARD_ONLINE ? s.paymentTtlMs : s.confirmTtlMs;
}
