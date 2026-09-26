-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('REQUESTED', 'RECEIVED', 'APPROVED', 'REJECTED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReturnReason" AS ENUM ('DEFECTIVE', 'CHANGED_MIND', 'DAMAGED', 'WRONG_ITEM', 'OTHER');

-- CreateEnum
CREATE TYPE "ReturnDecision" AS ENUM ('RESTOCK', 'SCRAP', 'REJECT');

-- CreateEnum
CREATE TYPE "WarrantyStatus" AS ENUM ('OPEN', 'RECEIVED', 'IN_SERVICE', 'REPAIRED', 'CLOSED', 'REPLACED', 'REJECTED');

-- AlterEnum
ALTER TYPE "OrderEventType" ADD VALUE 'RETURN_APPROVED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'PARTIALLY_RETURNED';
ALTER TYPE "OrderStatus" ADD VALUE 'RETURNED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SerialUnitStatus" ADD VALUE 'RETURNED';
ALTER TYPE "SerialUnitStatus" ADD VALUE 'IN_SERVICE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockMovementType" ADD VALUE 'RETURN';
ALTER TYPE "StockMovementType" ADD VALUE 'WARRANTY_REPLACEMENT';

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "returnId" TEXT,
ADD COLUMN     "warrantyCaseId" TEXT;

-- CreateTable
CREATE TABLE "returns" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'REQUESTED',
    "note" TEXT,
    "orderId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "refundAmount" DECIMAL(12,2),
    "refundReference" TEXT,
    "createdById" TEXT NOT NULL,
    "receivedById" TEXT,
    "receivedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "refundedById" TEXT,
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_items" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "serialNumbers" TEXT[],
    "reason" "ReturnReason" NOT NULL,
    "reasonNote" TEXT,
    "decision" "ReturnDecision",
    "inspectionNote" TEXT,
    "returnId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warranty_cases" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "status" "WarrantyStatus" NOT NULL DEFAULT 'OPEN',
    "problem" TEXT NOT NULL,
    "serviceCenter" TEXT,
    "resolutionNote" TEXT,
    "serialUnitId" TEXT NOT NULL,
    "replacementUnitId" TEXT,
    "warehouseId" TEXT,
    "createdById" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3),
    "sentToServiceAt" TIMESTAMP(3),
    "repairedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warranty_cases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "returns_number_key" ON "returns"("number");

-- CreateIndex
CREATE INDEX "returns_orderId_idx" ON "returns"("orderId");

-- CreateIndex
CREATE INDEX "returns_status_createdAt_idx" ON "returns"("status", "createdAt");

-- CreateIndex
CREATE INDEX "return_items_returnId_idx" ON "return_items"("returnId");

-- CreateIndex
CREATE INDEX "return_items_orderItemId_idx" ON "return_items"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "warranty_cases_number_key" ON "warranty_cases"("number");

-- CreateIndex
CREATE INDEX "warranty_cases_serialUnitId_idx" ON "warranty_cases"("serialUnitId");

-- CreateIndex
CREATE INDEX "warranty_cases_status_createdAt_idx" ON "warranty_cases"("status", "createdAt");

-- CreateIndex
CREATE INDEX "stock_movements_returnId_idx" ON "stock_movements"("returnId");

-- CreateIndex
CREATE INDEX "stock_movements_warrantyCaseId_idx" ON "stock_movements"("warrantyCaseId");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "returns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warrantyCaseId_fkey" FOREIGN KEY ("warrantyCaseId") REFERENCES "warranty_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_refundedById_fkey" FOREIGN KEY ("refundedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_cases" ADD CONSTRAINT "warranty_cases_serialUnitId_fkey" FOREIGN KEY ("serialUnitId") REFERENCES "serial_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_cases" ADD CONSTRAINT "warranty_cases_replacementUnitId_fkey" FOREIGN KEY ("replacementUnitId") REFERENCES "serial_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_cases" ADD CONSTRAINT "warranty_cases_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_cases" ADD CONSTRAINT "warranty_cases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Hand-written: rules Prisma schema cannot express.
-- ---------------------------------------------------------------------------
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_quantity_positive" CHECK ("quantity" > 0);

-- One unit cannot have two warranty cases in progress at the same time.
CREATE UNIQUE INDEX "warranty_cases_one_open_per_unit"
  ON "warranty_cases" ("serialUnitId")
  WHERE "status" IN ('OPEN', 'RECEIVED', 'IN_SERVICE', 'REPAIRED');
