-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderEventType" ADD VALUE 'PICKING_STARTED';
ALTER TYPE "OrderEventType" ADD VALUE 'PICKING_COMPLETED';
ALTER TYPE "OrderEventType" ADD VALUE 'SHIPPED';
ALTER TYPE "OrderEventType" ADD VALUE 'DELIVERED';
ALTER TYPE "OrderEventType" ADD VALUE 'COMPLETED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'PICKING';
ALTER TYPE "OrderStatus" ADD VALUE 'READY_TO_SHIP';
ALTER TYPE "OrderStatus" ADD VALUE 'SHIPPED';
ALTER TYPE "OrderStatus" ADD VALUE 'DELIVERED';
ALTER TYPE "OrderStatus" ADD VALUE 'COMPLETED';

-- AlterEnum
ALTER TYPE "SerialUnitStatus" ADD VALUE 'SOLD';

-- AlterEnum
ALTER TYPE "StockMovementType" ADD VALUE 'SALE';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "carrier" TEXT,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "shippedAt" TIMESTAMP(3),
ADD COLUMN     "trackingNumber" TEXT;

-- AlterTable
ALTER TABLE "serial_units" ADD COLUMN     "orderItemId" TEXT,
ADD COLUMN     "soldAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "orderId" TEXT;

-- AlterTable
ALTER TABLE "stock_reservations" ADD COLUMN     "pickedQuantity" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "stock_movements_orderId_idx" ON "stock_movements"("orderId");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serial_units" ADD CONSTRAINT "serial_units_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Hand-written: rules Prisma schema cannot express.
-- ---------------------------------------------------------------------------
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_picked_within_quantity"
  CHECK ("pickedQuantity" >= 0 AND "pickedQuantity" <= "quantity");
