-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('pending', 'online', 'idle', 'offline', 'blocked');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('MPESA', 'AIRTEL_MONEY', 'AIRTIME', 'OTHER');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'WAITING');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "CommandStatus" AS ENUM ('QUEUED', 'DELIVERED', 'ACKNOWLEDGED', 'EXECUTING', 'SUCCEEDED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('OPERATIONAL', 'DEGRADED', 'OUTAGE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('DEVICE', 'SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('CUSTOMER', 'ADMIN', 'DEVICE', 'SYSTEM');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "openId" VARCHAR(64) NOT NULL,
    "name" TEXT,
    "email" VARCHAR(320),
    "loginMethod" VARCHAR(64),
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSignedIn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "phone" VARCHAR(40),
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "emailVerifiedAt" TIMESTAMP(3),
    "lastSignedInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_sessions" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" SERIAL NOT NULL,
    "deviceId" VARCHAR(128) NOT NULL,
    "deviceName" VARCHAR(160) NOT NULL,
    "model" VARCHAR(160),
    "manufacturer" VARCHAR(120),
    "androidVersion" VARCHAR(40),
    "sdkVersion" VARCHAR(40),
    "appVersion" VARCHAR(80),
    "appBuild" VARCHAR(40),
    "phoneNumber" VARCHAR(40),
    "simSlot" INTEGER,
    "subscriptionId" INTEGER,
    "carrierName" VARCHAR(120),
    "iccId" VARCHAR(160),
    "automationSimConfigured" BOOLEAN NOT NULL DEFAULT false,
    "status" "DeviceStatus" NOT NULL DEFAULT 'pending',
    "lastHeartbeatAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "enrollmentTokenHash" VARCHAR(128),
    "enrolledAt" TIMESTAMP(3),
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_credentials" (
    "id" TEXT NOT NULL,
    "deviceId" INTEGER NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "device_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pairing_tokens" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "deviceId" INTEGER,
    "codeHash" VARCHAR(128) NOT NULL,
    "secretHash" VARCHAR(128) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pairing_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" SERIAL NOT NULL,
    "deviceId" INTEGER,
    "androidTransactionId" VARCHAR(128),
    "executionId" VARCHAR(128),
    "operationId" VARCHAR(160),
    "customerName" VARCHAR(180),
    "phoneNumber" VARCHAR(40) NOT NULL,
    "packageName" VARCHAR(160) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentMethod" "PaymentMethod",
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "verificationStatus" "VerificationStatus",
    "verificationMessage" TEXT,
    "receiptCode" VARCHAR(120),
    "issue" TEXT,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commands" (
    "id" SERIAL NOT NULL,
    "deviceId" INTEGER NOT NULL,
    "commandType" VARCHAR(80) NOT NULL,
    "payload" JSONB,
    "status" "CommandStatus" NOT NULL DEFAULT 'QUEUED',
    "requestedBy" INTEGER,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "resultMessage" TEXT,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" SERIAL NOT NULL,
    "customerId" TEXT,
    "deviceId" INTEGER,
    "productId" TEXT,
    "storeName" VARCHAR(180) NOT NULL,
    "ownerPhone" VARCHAR(40),
    "planName" VARCHAR(120) NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "tokenBalance" INTEGER NOT NULL DEFAULT 0,
    "renewalAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" SERIAL NOT NULL,
    "serviceKey" VARCHAR(100) NOT NULL,
    "serviceName" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "status" "ServiceStatus" NOT NULL DEFAULT 'OPERATIONAL',
    "lastCheckedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_events" (
    "id" SERIAL NOT NULL,
    "deviceId" INTEGER NOT NULL,
    "eventType" VARCHAR(80) NOT NULL,
    "payload" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted" BOOLEAN NOT NULL DEFAULT true,
    "rejectionReason" TEXT,

    CONSTRAINT "sync_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "productType" "ProductType" NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'KES',
    "durationDays" INTEGER,
    "deviceLimit" INTEGER,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bingwa_payments" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "deviceId" INTEGER,
    "idempotencyKey" VARCHAR(180) NOT NULL,
    "phone" VARCHAR(40) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'KES',
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "checkoutRequestId" VARCHAR(180),
    "merchantRequestId" VARCHAR(180),
    "payflowTransactionId" VARCHAR(180),
    "receiptCode" VARCHAR(120),
    "failureCode" VARCHAR(80),
    "failureMessage" TEXT,
    "statusCheckedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bingwa_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlement_grants" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "deviceId" INTEGER,
    "subscriptionId" INTEGER,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "entitlement_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorType" "AuditActorType" NOT NULL,
    "actorUserId" INTEGER,
    "actorCustomerId" TEXT,
    "deviceId" INTEGER,
    "paymentId" TEXT,
    "action" VARCHAR(120) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_openId_key" ON "users"("openId");

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

-- CreateIndex
CREATE INDEX "customers_status_createdAt_idx" ON "customers"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "customer_sessions_tokenHash_key" ON "customer_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "customer_sessions_customerId_expiresAt_idx" ON "customer_sessions"("customerId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_tokenHash_key" ON "email_verification_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "email_verification_tokens_customerId_expiresAt_idx" ON "email_verification_tokens"("customerId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "devices_deviceId_key" ON "devices"("deviceId");

-- CreateIndex
CREATE INDEX "devices_enrollment_lookup_idx" ON "devices"("deviceId", "enrollmentTokenHash");

-- CreateIndex
CREATE INDEX "devices_heartbeat_idx" ON "devices"("status", "lastHeartbeatAt");

-- CreateIndex
CREATE INDEX "devices_customer_status_idx" ON "devices"("customerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "device_credentials_tokenHash_key" ON "device_credentials"("tokenHash");

-- CreateIndex
CREATE INDEX "device_credentials_deviceId_revokedAt_idx" ON "device_credentials"("deviceId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "pairing_tokens_deviceId_key" ON "pairing_tokens"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "pairing_tokens_secretHash_key" ON "pairing_tokens"("secretHash");

-- CreateIndex
CREATE INDEX "pairing_tokens_customerId_expiresAt_consumedAt_idx" ON "pairing_tokens"("customerId", "expiresAt", "consumedAt");

-- CreateIndex
CREATE INDEX "pairing_tokens_codeHash_expiresAt_idx" ON "pairing_tokens"("codeHash", "expiresAt");

-- CreateIndex
CREATE INDEX "transactions_search_idx" ON "transactions"("phoneNumber", "status", "createdAt");

-- CreateIndex
CREATE INDEX "transactions_device_idx" ON "transactions"("deviceId", "createdAt");

-- CreateIndex
CREATE INDEX "transactions_executionId_idx" ON "transactions"("executionId");

-- CreateIndex
CREATE INDEX "commands_poll_idx" ON "commands"("deviceId", "status", "requestedAt");

-- CreateIndex
CREATE INDEX "commands_result_idx" ON "commands"("deviceId", "id", "status");

-- CreateIndex
CREATE INDEX "subscriptions_device_idx" ON "subscriptions"("deviceId", "status");

-- CreateIndex
CREATE INDEX "subscriptions_customerId_status_idx" ON "subscriptions"("customerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "services_serviceKey_key" ON "services"("serviceKey");

-- CreateIndex
CREATE INDEX "sync_events_device_idx" ON "sync_events"("deviceId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_productType_status_idx" ON "products"("productType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "bingwa_payments_idempotencyKey_key" ON "bingwa_payments"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "bingwa_payments_checkoutRequestId_key" ON "bingwa_payments"("checkoutRequestId");

-- CreateIndex
CREATE INDEX "bingwa_payments_customerId_status_createdAt_idx" ON "bingwa_payments"("customerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "bingwa_payments_checkoutRequestId_status_idx" ON "bingwa_payments"("checkoutRequestId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "entitlement_grants_paymentId_key" ON "entitlement_grants"("paymentId");

-- CreateIndex
CREATE INDEX "entitlement_grants_customerId_expiresAt_idx" ON "entitlement_grants"("customerId", "expiresAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorCustomerId_createdAt_idx" ON "audit_logs"("actorCustomerId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_paymentId_createdAt_idx" ON "audit_logs"("paymentId", "createdAt");

-- AddForeignKey
ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_credentials" ADD CONSTRAINT "device_credentials_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pairing_tokens" ADD CONSTRAINT "pairing_tokens_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pairing_tokens" ADD CONSTRAINT "pairing_tokens_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commands" ADD CONSTRAINT "commands_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commands" ADD CONSTRAINT "commands_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_events" ADD CONSTRAINT "sync_events_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bingwa_payments" ADD CONSTRAINT "bingwa_payments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bingwa_payments" ADD CONSTRAINT "bingwa_payments_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bingwa_payments" ADD CONSTRAINT "bingwa_payments_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement_grants" ADD CONSTRAINT "entitlement_grants_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "bingwa_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement_grants" ADD CONSTRAINT "entitlement_grants_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement_grants" ADD CONSTRAINT "entitlement_grants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement_grants" ADD CONSTRAINT "entitlement_grants_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement_grants" ADD CONSTRAINT "entitlement_grants_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorCustomerId_fkey" FOREIGN KEY ("actorCustomerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "bingwa_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

