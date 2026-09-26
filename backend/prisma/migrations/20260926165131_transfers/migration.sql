-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('DRAFT', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "SerialUnitStatus" ADD VALUE 'IN_TRANSIT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockMovementType" ADD VALUE 'TRANSFER_OUT';
ALTER TYPE "StockMovementType" ADD VALUE 'TRANSFER_IN';

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "transferId" TEXT;

-- CreateTable
CREATE TABLE "transfers" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "fromWarehouseId" TEXT NOT NULL,
    "toWarehouseId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "sentById" TEXT,
    "sentAt" TIMESTAMP(3),
    "receivedById" TEXT,
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_items" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "serialNumbers" TEXT[],
    "transferId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transfers_number_key" ON "transfers"("number");

-- CreateIndex
CREATE INDEX "transfers_status_createdAt_idx" ON "transfers"("status", "createdAt");

-- CreateIndex
CREATE INDEX "transfers_toWarehouseId_status_idx" ON "transfers"("toWarehouseId", "status");

-- CreateIndex
CREATE INDEX "transfer_items_transferId_idx" ON "transfer_items"("transferId");

-- CreateIndex
CREATE INDEX "transfer_items_productId_idx" ON "transfer_items"("productId");

-- CreateIndex
CREATE INDEX "stock_movements_transferId_idx" ON "stock_movements"("transferId");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_items" ADD CONSTRAINT "transfer_items_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_items" ADD CONSTRAINT "transfer_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Hand-written: rules Prisma schema cannot express.
-- ---------------------------------------------------------------------------
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_different_warehouses" CHECK ("fromWarehouseId" <> "toWarehouseId");
ALTER TABLE "transfer_items" ADD CONSTRAINT "transfer_items_quantity_positive" CHECK ("quantity" > 0);
