/**
 * Response types come straight from the backend's compiled declarations
 * (`npm run backend:types`), so they can never drift from what the API returns.
 * Json<> turns them into their wire form: Decimal and Date arrive as strings.
 */
import type { AuthService } from "@backend/auth/auth.service";
import type { PublicUser } from "@backend/users/users.service";
import type { DashboardService } from "@backend/reports/dashboard.service";
import type { NotificationsService } from "@backend/notifications/notifications.service";
import type { OrdersService } from "@backend/orders/orders.service";

export type Json<T> = T extends { toJSON(): infer R }
  ? R
  : T extends (infer U)[]
    ? Json<U>[]
    : T extends object
      ? { [K in keyof T]: Json<T[K]> }
      : T;

/** Wire type of whatever a backend method resolves to. */
export type Returns<F> = F extends (...args: never[]) => Promise<infer R> ? Json<R> : never;

export type User = Json<PublicUser>;
export type Role = User["role"];
export type LoginResponse = Returns<AuthService["login"]>;
export type Dashboard = Returns<DashboardService["overview"]>;
export type NotificationList = Returns<NotificationsService["listMine"]>;
export type UnreadCount = Returns<NotificationsService["unreadCount"]>;
export type OrderList = Returns<OrdersService["listForStaff"]>;
export type Order = Returns<OrdersService["findForStaff"]>;
export type OrderStatus = Order["status"];
