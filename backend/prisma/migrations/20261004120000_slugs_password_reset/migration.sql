
-- Existing rows get a slug from their name; repeated names get -2, -3, ...
ALTER TABLE "categories" ADD COLUMN "slug" TEXT;
WITH base AS (
  SELECT id, COALESCE(NULLIF(trim(both '-' from regexp_replace(translate(replace(replace(lower("name"), 'đ', 'dj'), 'Đ', 'dj'), 'čćžšČĆŽŠ', 'cczscczs'), '[^a-z0-9]+', '-', 'g')), ''), 'stavka') AS s,
         ROW_NUMBER() OVER (PARTITION BY COALESCE(NULLIF(trim(both '-' from regexp_replace(translate(replace(replace(lower("name"), 'đ', 'dj'), 'Đ', 'dj'), 'čćžšČĆŽŠ', 'cczscczs'), '[^a-z0-9]+', '-', 'g')), ''), 'stavka') ORDER BY "id") AS n
  FROM "categories"
)
UPDATE "categories" t SET "slug" = CASE WHEN base.n = 1 THEN base.s ELSE base.s || '-' || base.n END
FROM base WHERE base.id = t.id;
ALTER TABLE "categories" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "categories" ADD CONSTRAINT "categories_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- Existing rows get a slug from their name; repeated names get -2, -3, ...
ALTER TABLE "products" ADD COLUMN "slug" TEXT;
WITH base AS (
  SELECT id, COALESCE(NULLIF(trim(both '-' from regexp_replace(translate(replace(replace(lower("name"), 'đ', 'dj'), 'Đ', 'dj'), 'čćžšČĆŽŠ', 'cczscczs'), '[^a-z0-9]+', '-', 'g')), ''), 'stavka') AS s,
         ROW_NUMBER() OVER (PARTITION BY COALESCE(NULLIF(trim(both '-' from regexp_replace(translate(replace(replace(lower("name"), 'đ', 'dj'), 'Đ', 'dj'), 'čćžšČĆŽŠ', 'cczscczs'), '[^a-z0-9]+', '-', 'g')), ''), 'stavka') ORDER BY "id") AS n
  FROM "products"
)
UPDATE "products" t SET "slug" = CASE WHEN base.n = 1 THEN base.s ELSE base.s || '-' || base.n END
FROM base WHERE base.id = t.id;
ALTER TABLE "products" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "products" ADD CONSTRAINT "products_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "passwordChangedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_createdAt_idx" ON "password_reset_tokens"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

