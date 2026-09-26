-- CreateEnum
CREATE TYPE "StockAlertLevel" AS ENUM ('OK', 'LOW', 'OUT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ORDER_NEW', 'ORDER_PAID', 'ORDER_TO_PICK', 'ORDER_READY_TO_SHIP', 'RECEIVING_CONFIRMED', 'RETURN_REQUESTED', 'STOCK_LOW', 'STOCK_OUT', 'WARRANTY_EXPIRING');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "company_settings" ADD COLUMN     "lowStockThreshold" INTEGER NOT NULL DEFAULT 2;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "lowStockThreshold" INTEGER,
ADD COLUMN     "stockAlert" "StockAlertLevel" NOT NULL DEFAULT 'OK';

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_outbox" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "html" TEXT,
    "documentIds" TEXT[],
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sendAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orderId" TEXT,

    CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_createdAt_idx" ON "notifications"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_userId_dedupeKey_key" ON "notifications"("userId", "dedupeKey");

-- CreateIndex
CREATE INDEX "email_outbox_status_sendAfter_idx" ON "email_outbox"("status", "sendAfter");

-- CreateIndex
CREATE INDEX "email_outbox_orderId_idx" ON "email_outbox"("orderId");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

