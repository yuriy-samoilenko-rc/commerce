-- Product photos for the online shop. Files live in media storage; rows keep order and alt text.
-- CreateTable
CREATE TABLE "product_images" (
    "id" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "alt" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productId" TEXT NOT NULL,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_images_position_check" CHECK ("position" >= 0),
    CONSTRAINT "product_images_size_check" CHECK ("width" > 0 AND "height" > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "product_images_fileKey_key" ON "product_images"("fileKey");

-- CreateIndex
CREATE INDEX "product_images_productId_position_idx" ON "product_images"("productId", "position");

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

