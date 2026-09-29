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
import type { ProductImagesService } from "@backend/products/product-images.service";
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
import type { ReturnsService } from "@backend/returns/returns.service";
import type { WarrantyService } from "@backend/warranty/warranty.service";
import type { FulfillmentService } from "@backend/orders/fulfillment.service";
import type { ShopService } from "@backend/shop/shop.service";
import type { CompanySettingsService } from "@backend/settings/company-settings.service";
import type { ReviewsService } from "@backend/reviews/reviews.service";
import type { WishlistService } from "@backend/wishlist/wishlist.service";

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
export type ProductImageList = Returns<ProductImagesService["list"]>;
export type ProductImage = ProductImageList[number];
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
export type ReturnList = Returns<ReturnsService["listForStaff"]>;
export type ReturnDetail = Returns<ReturnsService["findForStaff"]>;
export type WarrantyList = Returns<WarrantyService["list"]>;
export type WarrantyCase = Returns<WarrantyService["findOne"]>;
export type SerialInfo = Returns<StockService["findSerial"]>;
export type PickingTasks = Returns<FulfillmentService["pickingTasks"]>;
export type PickSheet = Returns<FulfillmentService["pickSheet"]>;
export type ProductByCode = Returns<ProductsService["findByCode"]>;

// ---------- online shop ----------
export type ShopInfo = Returns<ShopService["info"]>;
export type PickupPoint = ShopInfo["pickupPoints"][number];
export type ShopCategory = Returns<ShopService["categories"]>[number];
export type Facets = Returns<ShopService["facets"]>;
export type PublicProductList = Returns<ProductsService["listPublic"]>;
export type PublicProduct = PublicProductList["items"][number];
export type PublicProductDetail = Returns<ProductsService["findPublic"]>;
export type Recommendations = Returns<ProductsService["recommendations"]>;
export type ReviewPage = Returns<ReviewsService["listForProduct"]>;
export type ReviewEligibility = Returns<ReviewsService["eligibility"]>;
export type MyReviews = Returns<ReviewsService["listMine"]>;
export type StaffReviewList = Returns<ReviewsService["listForStaff"]>;
export type WishlistIds = Returns<WishlistService["add"]>;
export type WishlistProducts = Returns<WishlistService["list"]>;
export type CustomerOrderList = Returns<OrdersService["listForCustomer"]>;
export type CustomerOrder = Returns<OrdersService["findForCustomer"]>;
export type CompanySettings = Returns<CompanySettingsService["get"]>;
