-- CreateTable
CREATE TABLE "stock_alert_subscriptions" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productId" TEXT NOT NULL,

    CONSTRAINT "stock_alert_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_alert_subscriptions_createdAt_idx" ON "stock_alert_subscriptions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "stock_alert_subscriptions_productId_email_key" ON "stock_alert_subscriptions"("productId", "email");

-- AddForeignKey
ALTER TABLE "stock_alert_subscriptions" ADD CONSTRAINT "stock_alert_subscriptions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

