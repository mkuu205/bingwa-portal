ALTER TABLE "devices"
  ADD COLUMN "airtimeBalance" DECIMAL(12,2),
  ADD COLUMN "tokenBalance" INTEGER,
  ADD COLUMN "commissionTotal" DECIMAL(12,2),
  ADD COLUMN "completedToday" INTEGER,
  ADD COLUMN "pendingCount" INTEGER,
  ADD COLUMN "scheduledCount" INTEGER,
  ADD COLUMN "failedCount" INTEGER,
  ADD COLUMN "successRate" DECIMAL(5,2);
