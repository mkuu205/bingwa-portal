-- Add a nullable unique key for Android transaction projections.
-- PostgreSQL permits multiple NULL values, preserving legacy/manual transactions.
CREATE UNIQUE INDEX "transactions_projection_key_unique"
  ON "transactions" ("projectionKey");
