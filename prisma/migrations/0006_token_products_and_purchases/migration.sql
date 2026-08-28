ALTER TYPE "ProductType" ADD VALUE IF NOT EXISTS 'TOKEN';
ALTER TYPE "TransactionStatus" ADD VALUE IF NOT EXISTS 'SKIPPED';
ALTER TYPE "TransactionStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

DO $$ BEGIN
  CREATE TYPE "TokenDeliveryStatus" AS ENUM ('PAYMENT_PENDING', 'PAYMENT_COMPLETED', 'QUEUED', 'DELIVERED', 'FAILED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "tokenQuantity" INTEGER;

CREATE TABLE IF NOT EXISTS "token_purchases" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "deviceId" INTEGER NOT NULL,
  "productId" TEXT NOT NULL,
  "paymentId" TEXT,
  "commandId" INTEGER,
  "idempotencyKey" VARCHAR(180) NOT NULL,
  "phone" VARCHAR(40) NOT NULL,
  "tokens" INTEGER NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'KES',
  "purchaseMethod" "PaymentMethod" NOT NULL,
  "deliveryStatus" "TokenDeliveryStatus" NOT NULL DEFAULT 'PAYMENT_PENDING',
  "failureMessage" TEXT,
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "token_purchases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "token_purchases_paymentId_key" ON "token_purchases"("paymentId");
CREATE UNIQUE INDEX IF NOT EXISTS "token_purchases_commandId_key" ON "token_purchases"("commandId");
CREATE UNIQUE INDEX IF NOT EXISTS "token_purchases_idempotencyKey_key" ON "token_purchases"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "token_purchases_customerId_deliveryStatus_createdAt_idx" ON "token_purchases"("customerId", "deliveryStatus", "createdAt");
CREATE INDEX IF NOT EXISTS "token_purchases_deviceId_deliveryStatus_createdAt_idx" ON "token_purchases"("deviceId", "deliveryStatus", "createdAt");

DO $$ BEGIN
  ALTER TABLE "token_purchases" ADD CONSTRAINT "token_purchases_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "token_purchases" ADD CONSTRAINT "token_purchases_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "token_purchases" ADD CONSTRAINT "token_purchases_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "token_purchases" ADD CONSTRAINT "token_purchases_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "bingwa_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
