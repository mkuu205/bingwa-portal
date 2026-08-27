-- Add a nullable unique key for Android transaction projections.
-- PostgreSQL permits multiple NULL values, preserving legacy/manual transactions.
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "projectionKey" VARCHAR(220);
CREATE UNIQUE INDEX IF NOT EXISTS "transactions_projection_key_unique"
  ON "transactions" ("projectionKey");
