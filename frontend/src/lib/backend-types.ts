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
import type { ProductsService } from "@backend/products/products.service";
import type { UsersService } from "@backend/users/users.service";
import type { CategoriesService } from "@backend/categories/categories.service";
import type { BrandsService } from "@backend/brands/brands.service";
import type { StockService } from "@backend/stock/stock.service";
import type { WarehousesService } from "@backend/warehouses/warehouses.service";
import type { SuppliersService } from "@backend/suppliers/suppliers.service";
import type { ReceivingsService } from "@backend/receivings/receivings.service";
import type { DocumentsService } from "@backend/documents/documents.service";
import type { TransfersService } from "@backend/transfers/transfers.service";
import type { InventoryService } from "@backend/inventory/inventory.service";

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
export type StaffProductList = Returns<ProductsService["listStaff"]>;
export type StaffProduct = StaffProductList["items"][number];
export type ProductDetail = Returns<ProductsService["findStaff"]>;
export type CategoryTree = Returns<CategoriesService["findTree"]>;
export type BrandList = Returns<BrandsService["findAll"]>;
export type StockList = Returns<StockService["listStock"]>;
export type MovementList = Returns<StockService["listMovements"]>;
export type CustomerList = Returns<UsersService["listCustomers"]>;
export type Customer = CustomerList["items"][number];
export type WarehouseList = Returns<WarehousesService["findAll"]>;
export type SupplierList = Returns<SuppliersService["findAll"]>;
export type ReceivingList = Returns<ReceivingsService["list"]>;
export type Receiving = Returns<ReceivingsService["findOne"]>;
export type DocumentList = Returns<DocumentsService["list"]>;
export type TransferList = Returns<TransfersService["list"]>;
export type Transfer = Returns<TransfersService["findOne"]>;
export type CountList = Returns<InventoryService["list"]>;
export type Count = Returns<InventoryService["findOne"]>;
export type CountLineView = Returns<InventoryService["scan"]>;
