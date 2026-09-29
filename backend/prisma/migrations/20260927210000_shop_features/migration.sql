-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "company_settings" ADD COLUMN     "courierFee" DECIMAL(10,2) NOT NULL DEFAULT 10,
ADD COLUMN     "freeShippingFrom" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "pickupWarehouseId" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "discountEndsAt" TIMESTAMP(3),
ADD COLUMN     "ratingAvg" DECIMAL(3,2),
ADD COLUMN     "ratingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shopPrice" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deliveryAddress" TEXT,
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "warehouses" ADD COLUMN     "isPickupPoint" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "openingHours" TEXT,
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "text" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "productId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moderatedAt" TIMESTAMP(3),
    "moderatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlist_items" (
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("userId","productId")
);

-- CreateIndex
CREATE INDEX "reviews_productId_status_idx" ON "reviews"("productId", "status");

-- CreateIndex
CREATE INDEX "reviews_status_createdAt_idx" ON "reviews"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_productId_userId_key" ON "reviews"("productId", "userId");

-- CreateIndex
CREATE INDEX "products_shopPrice_idx" ON "products"("shopPrice");

-- CreateIndex
CREATE INDEX "products_discountEndsAt_idx" ON "products"("discountEndsAt");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_pickupWarehouseId_fkey" FOREIGN KEY ("pickupWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- The price the shop sells at right now; ProductsService keeps it in step from here on.
UPDATE "products" SET "shopPrice" = COALESCE("discountPrice", "sellingPrice");
ALTER TABLE "products" ALTER COLUMN "shopPrice" SET NOT NULL;

ALTER TABLE "products" ADD CONSTRAINT "products_shopPrice_check" CHECK ("shopPrice" >= 0);
ALTER TABLE "products" ADD CONSTRAINT "products_rating_check" CHECK ("ratingCount" >= 0 AND ("ratingAvg" IS NULL OR "ratingAvg" BETWEEN 1 AND 5));
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_delivery_check" CHECK ("courierFee" >= 0 AND ("freeShippingFrom" IS NULL OR "freeShippingFrom" >= 0));
