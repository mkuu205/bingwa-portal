-- Add synchronized Android device state used by the customer Portal.
ALTER TABLE "devices"
  ADD COLUMN "batteryPercent" INTEGER,
  ADD COLUMN "automationEnabled" BOOLEAN,
  ADD COLUMN "executionState" VARCHAR(40),
  ADD COLUMN "latencyMs" INTEGER;

CREATE TABLE "device_data_plans" (
  "id" SERIAL NOT NULL,
  "deviceId" INTEGER NOT NULL,
  "packageName" VARCHAR(160) NOT NULL,
  "description" TEXT,
  "ussdCode" VARCHAR(160),
  "price" DECIMAL(12,2),
  "validity" VARCHAR(80),
  "dataAmount" VARCHAR(80),
  "category" VARCHAR(100),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "commissionPerSale" DECIMAL(12,2),
  "executeSim" INTEGER,
  "ussdMode" VARCHAR(40),
  "ussdSteps" TEXT,
  "source" VARCHAR(40),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "device_data_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "device_data_plans_deviceId_packageName_key" ON "device_data_plans"("deviceId", "packageName");
CREATE INDEX "device_data_plans_deviceId_isActive_idx" ON "device_data_plans"("deviceId", "isActive");
ALTER TABLE "device_data_plans" ADD CONSTRAINT "device_data_plans_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
