-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('RECEIPT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "SerialUnitStatus" AS ENUM ('IN_STOCK', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "ReceivingStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');

-- AlterTable
ALTER TABLE "stock" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "warehouses" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "contactPerson" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serialUnitId" TEXT,
    "receivingId" TEXT,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "serial_units" (
    "id" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "status" "SerialUnitStatus" NOT NULL DEFAULT 'IN_STOCK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT,

    CONSTRAINT "serial_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receivings" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "status" "ReceivingStatus" NOT NULL DEFAULT 'DRAFT',
    "supplierDocNumber" TEXT,
    "supplierDocDate" DATE,
    "notes" TEXT,
    "supplierId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receivings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receiving_items" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "purchasePrice" DECIMAL(10,2) NOT NULL,
    "serialNumbers" TEXT[],
    "receivingId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "receiving_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_name_key" ON "suppliers"("name");

-- CreateIndex
CREATE INDEX "stock_movements_productId_createdAt_idx" ON "stock_movements"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "stock_movements_warehouseId_createdAt_idx" ON "stock_movements"("warehouseId", "createdAt");

-- CreateIndex
CREATE INDEX "stock_movements_serialUnitId_idx" ON "stock_movements"("serialUnitId");

-- CreateIndex
CREATE INDEX "stock_movements_receivingId_idx" ON "stock_movements"("receivingId");

-- CreateIndex
CREATE UNIQUE INDEX "serial_units_serialNumber_key" ON "serial_units"("serialNumber");

-- CreateIndex
CREATE INDEX "serial_units_productId_warehouseId_status_idx" ON "serial_units"("productId", "warehouseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "receivings_number_key" ON "receivings"("number");

-- CreateIndex
CREATE INDEX "receivings_status_createdAt_idx" ON "receivings"("status", "createdAt");

-- CreateIndex
CREATE INDEX "receiving_items_receivingId_idx" ON "receiving_items"("receivingId");

-- CreateIndex
CREATE INDEX "stock_warehouseId_idx" ON "stock"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_name_key" ON "warehouses"("name");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_serialUnitId_fkey" FOREIGN KEY ("serialUnitId") REFERENCES "serial_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_receivingId_fkey" FOREIGN KEY ("receivingId") REFERENCES "receivings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serial_units" ADD CONSTRAINT "serial_units_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serial_units" ADD CONSTRAINT "serial_units_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivings" ADD CONSTRAINT "receivings_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivings" ADD CONSTRAINT "receivings_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivings" ADD CONSTRAINT "receivings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivings" ADD CONSTRAINT "receivings_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_items" ADD CONSTRAINT "receiving_items_receivingId_fkey" FOREIGN KEY ("receivingId") REFERENCES "receivings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_items" ADD CONSTRAINT "receiving_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Hand-written: rules Prisma schema cannot express.
-- ---------------------------------------------------------------------------

-- Balances can never go negative or reserve more than is physically there,
-- even if application code has a bug.
ALTER TABLE "stock" ADD CONSTRAINT "stock_quantity_nonnegative" CHECK ("quantity" >= 0);
ALTER TABLE "stock" ADD CONSTRAINT "stock_reserved_nonnegative" CHECK ("reserved" >= 0);
ALTER TABLE "stock" ADD CONSTRAINT "stock_reserved_within_quantity" CHECK ("reserved" <= "quantity");

ALTER TABLE "receiving_items" ADD CONSTRAINT "receiving_items_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_quantity_nonzero" CHECK ("quantity" <> 0);

-- The movement ledger is append-only: history must never be rewritten (ТЗ п.22, п.27).
CREATE FUNCTION forbid_stock_movement_changes() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'stock_movements is append-only: % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stock_movements_append_only
  BEFORE UPDATE OR DELETE ON "stock_movements"
  FOR EACH ROW EXECUTE FUNCTION forbid_stock_movement_changes();
