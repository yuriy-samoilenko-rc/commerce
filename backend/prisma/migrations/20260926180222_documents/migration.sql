-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('INVOICE', 'DELIVERY_NOTE', 'WARRANTY_CARD', 'RECEIVING_NOTE', 'TRANSFER_NOTE', 'RETURN_NOTE', 'INVENTORY_ACT');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('ISSUED', 'CANCELLED');

-- CreateTable
CREATE TABLE "company_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL DEFAULT 'TechStore',
    "legalName" TEXT,
    "address" TEXT,
    "taxId" TEXT,
    "registrationNumber" TEXT,
    "bankAccount" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "defaultVatPercent" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_counters" (
    "type" "DocumentType" NOT NULL,
    "year" INTEGER NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "document_counters_pkey" PRIMARY KEY ("type","year")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "number" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'ISSUED',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "title" TEXT NOT NULL,
    "counterpartyName" TEXT,
    "total" DECIMAL(12,2),
    "currency" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "orderId" TEXT,
    "receivingId" TEXT,
    "transferId" TEXT,
    "returnId" TEXT,
    "inventoryCountId" TEXT,
    "warehouseId" TEXT,
    "supplierId" TEXT,
    "customerId" TEXT,
    "createdById" TEXT,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documents_number_key" ON "documents"("number");

-- CreateIndex
CREATE INDEX "documents_type_issuedAt_idx" ON "documents"("type", "issuedAt");

-- CreateIndex
CREATE INDEX "documents_issuedAt_idx" ON "documents"("issuedAt");

-- CreateIndex
CREATE INDEX "documents_orderId_idx" ON "documents"("orderId");

-- CreateIndex
CREATE INDEX "documents_receivingId_idx" ON "documents"("receivingId");

-- CreateIndex
CREATE INDEX "documents_transferId_idx" ON "documents"("transferId");

-- CreateIndex
CREATE INDEX "documents_returnId_idx" ON "documents"("returnId");

-- CreateIndex
CREATE INDEX "documents_inventoryCountId_idx" ON "documents"("inventoryCountId");

-- CreateIndex
CREATE INDEX "documents_supplierId_idx" ON "documents"("supplierId");

-- CreateIndex
CREATE INDEX "documents_customerId_idx" ON "documents"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "documents_type_year_seq_key" ON "documents"("type", "year", "seq");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_receivingId_fkey" FOREIGN KEY ("receivingId") REFERENCES "receivings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "returns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_inventoryCountId_fkey" FOREIGN KEY ("inventoryCountId") REFERENCES "inventory_counts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Hand-written: rules Prisma schema cannot express.
-- ---------------------------------------------------------------------------
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_single_row" CHECK ("id" = 1);
INSERT INTO "company_settings" ("id", "updatedAt") VALUES (1, now()) ON CONFLICT DO NOTHING;
