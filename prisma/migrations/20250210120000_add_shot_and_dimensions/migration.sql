-- Ensure optional dimension columns exist
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "dimensionA" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "dimensionB" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "dimensionC" TEXT;

-- New field for product shot / view
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "shot" TEXT;