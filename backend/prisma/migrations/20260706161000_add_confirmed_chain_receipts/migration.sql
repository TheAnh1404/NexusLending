-- Persist confirmed Soroban transaction metadata after frontend submission succeeds.
ALTER TABLE "LoanOffer"
ADD COLUMN "ledger" INTEGER,
ADD COLUMN "blockTimestamp" TIMESTAMP(3);

ALTER TABLE "Loan"
ADD COLUMN "ledger" INTEGER,
ADD COLUMN "blockTimestamp" TIMESTAMP(3);

ALTER TABLE "Transaction"
ADD COLUMN "contract" TEXT,
ADD COLUMN "ledger" INTEGER,
ADD COLUMN "blockTimestamp" TIMESTAMP(3);
