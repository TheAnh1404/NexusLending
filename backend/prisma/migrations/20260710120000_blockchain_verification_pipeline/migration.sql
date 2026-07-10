-- Add verification metadata to transaction activity records.
ALTER TABLE "Transaction"
ADD COLUMN "contractId" TEXT,
ADD COLUMN "eventName" TEXT,
ADD COLUMN "actor" TEXT,
ADD COLUMN "entityType" TEXT,
ADD COLUMN "entityId" TEXT,
ADD COLUMN "network" TEXT,
ADD COLUMN "confirmedAt" TIMESTAMP(3);

UPDATE "Transaction"
SET "contractId" = COALESCE("contractId", "contract");

CREATE INDEX "Transaction_contractId_idx" ON "Transaction"("contractId");
CREATE INDEX "Transaction_ledger_idx" ON "Transaction"("ledger");
CREATE INDEX "Transaction_entityType_entityId_idx" ON "Transaction"("entityType", "entityId");

-- Idempotency ledger for parsed Soroban events.
CREATE TABLE "IndexedEvent" (
  "id" TEXT NOT NULL,
  "txHash" TEXT NOT NULL,
  "eventIndex" INTEGER NOT NULL,
  "ledger" INTEGER NOT NULL,
  "contractId" TEXT NOT NULL,
  "eventName" TEXT NOT NULL,
  "actor" TEXT,
  "entityType" TEXT,
  "entityId" TEXT,
  "amount" DECIMAL(30,7),
  "asset" TEXT,
  "network" TEXT NOT NULL,
  "explorerUrl" TEXT NOT NULL,
  "payload" JSONB,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "IndexedEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IndexedEvent_txHash_eventIndex_key" ON "IndexedEvent"("txHash", "eventIndex");
CREATE INDEX "IndexedEvent_ledger_idx" ON "IndexedEvent"("ledger");
CREATE INDEX "IndexedEvent_contractId_idx" ON "IndexedEvent"("contractId");
CREATE INDEX "IndexedEvent_eventName_idx" ON "IndexedEvent"("eventName");
CREATE INDEX "IndexedEvent_entityType_entityId_idx" ON "IndexedEvent"("entityType", "entityId");

-- Persistent indexer resume/status state.
CREATE TABLE "IndexerCheckpoint" (
  "id" TEXT NOT NULL,
  "network" TEXT NOT NULL,
  "lastLedger" INTEGER NOT NULL DEFAULT 0,
  "currentLedger" INTEGER NOT NULL DEFAULT 0,
  "rpcStatus" TEXT NOT NULL DEFAULT 'unknown',
  "status" TEXT NOT NULL DEFAULT 'stopped',
  "pendingEvents" INTEGER NOT NULL DEFAULT 0,
  "processedEvents" INTEGER NOT NULL DEFAULT 0,
  "failedEvents" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "IndexerCheckpoint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IndexerCheckpoint_network_key" ON "IndexerCheckpoint"("network");
