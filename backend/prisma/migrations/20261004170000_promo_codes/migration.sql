-- CreateEnum
CREATE TYPE "PromoType" AS ENUM ('PERCENT', 'FIXED');

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "listPrice" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "promoCodeId" TEXT;

-- CreateTable
CREATE TABLE "promo_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "type" "PromoType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "minSubtotal" DECIMAL(10,2),
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "onePerCustomer" BOOLEAN NOT NULL DEFAULT true,
    "excludeSaleItems" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "promo_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_value_check" CHECK ("value" > 0 AND ("type" <> 'PERCENT' OR "value" <= 100));
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_uses_check" CHECK ("usedCount" >= 0 AND ("maxUses" IS NULL OR "maxUses" > 0));
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_code_check" CHECK ("code" ~ '^[A-Z0-9_-]{3,40}$');
ALTER TABLE "orders" ADD CONSTRAINT "orders_discount_check" CHECK ("discountTotal" >= 0);
