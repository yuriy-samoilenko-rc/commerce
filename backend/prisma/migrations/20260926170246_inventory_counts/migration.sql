-- CreateEnum
CREATE TYPE "InventoryStatus" AS ENUM ('IN_PROGRESS', 'COUNTED', 'APPROVED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "StockMovementType" ADD VALUE 'INVENTORY';

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "inventoryCountId" TEXT;

-- CreateTable
CREATE TABLE "inventory_counts" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "status" "InventoryStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "notes" TEXT,
    "warehouseId" TEXT NOT NULL,
    "categoryId" TEXT,
    "scopeCategoryIds" TEXT[],
    "createdById" TEXT NOT NULL,
    "finishedById" TEXT,
    "finishedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_lines" (
    "id" TEXT NOT NULL,
    "countedQuantity" INTEGER NOT NULL DEFAULT 0,
    "expectedQuantity" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "countId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "inventory_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_serials" (
    "id" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "countId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "inventory_serials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_counts_number_key" ON "inventory_counts"("number");

-- CreateIndex
CREATE INDEX "inventory_counts_warehouseId_status_idx" ON "inventory_counts"("warehouseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_lines_countId_productId_key" ON "inventory_lines"("countId", "productId");

-- CreateIndex
CREATE INDEX "inventory_serials_countId_productId_idx" ON "inventory_serials"("countId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_serials_countId_serialNumber_key" ON "inventory_serials"("countId", "serialNumber");

-- CreateIndex
CREATE INDEX "stock_movements_inventoryCountId_idx" ON "stock_movements"("inventoryCountId");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_inventoryCountId_fkey" FOREIGN KEY ("inventoryCountId") REFERENCES "inventory_counts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_finishedById_fkey" FOREIGN KEY ("finishedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_lines" ADD CONSTRAINT "inventory_lines_countId_fkey" FOREIGN KEY ("countId") REFERENCES "inventory_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_lines" ADD CONSTRAINT "inventory_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_serials" ADD CONSTRAINT "inventory_serials_countId_fkey" FOREIGN KEY ("countId") REFERENCES "inventory_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_serials" ADD CONSTRAINT "inventory_serials_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Hand-written: rules Prisma schema cannot express.
-- ---------------------------------------------------------------------------

-- At most one open count per warehouse (a partial unique index only covers matching rows).
CREATE UNIQUE INDEX "inventory_counts_one_open_per_warehouse"
  ON "inventory_counts" ("warehouseId")
  WHERE "status" IN ('IN_PROGRESS', 'COUNTED');

ALTER TABLE "inventory_lines" ADD CONSTRAINT "inventory_lines_counted_nonnegative" CHECK ("countedQuantity" >= 0);
