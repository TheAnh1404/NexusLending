-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('LENDER', 'BORROWER', 'LIQUIDATOR');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('Draft', 'Funding', 'Active', 'Matched', 'Cancelled', 'Expired');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('PendingCollateral', 'Active', 'Warning', 'LiquidationPlanning', 'Repaid', 'Closed', 'Expired', 'Defaulted', 'Liquidated');

-- CreateEnum
CREATE TYPE "RiskZone" AS ENUM ('SAFE', 'WARNING', 'LIQUIDATION_PLANNING');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('CONNECT_WALLET', 'CREATE_OFFER', 'FUND_OFFER', 'ACTIVATE_OFFER', 'CANCEL_OFFER', 'EXPIRE_OFFER', 'ACCEPT_OFFER', 'ACTIVATE_LOAN', 'BORROW_LOAN', 'BORROW', 'ADD_COLLATERAL', 'PARTIAL_REPAY', 'FULL_REPAY', 'REPAY', 'LIQUIDATE', 'UPDATE_ORACLE', 'ORACLE_UPDATE', 'HEALTH_RECALCULATION', 'CLAIM_REPAYMENT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "role" "UserRole",
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanOffer" (
    "id" TEXT NOT NULL,
    "contractOfferId" BIGINT,
    "lenderWallet" TEXT NOT NULL,
    "loanAsset" TEXT NOT NULL,
    "loanAmount" DECIMAL(30,7) NOT NULL,
    "fixedAprBps" INTEGER NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "collateralAsset" TEXT NOT NULL,
    "maxLtvBps" INTEGER NOT NULL,
    "liquidationThresholdBps" INTEGER NOT NULL,
    "liquidationBonusBps" INTEGER NOT NULL,
    "gracePeriodDays" INTEGER NOT NULL,
    "minHealthFactorBps" INTEGER NOT NULL DEFAULT 14000,
    "status" "OfferStatus" NOT NULL DEFAULT 'Draft',
    "description" TEXT,
    "txHash" TEXT,
    "explorerUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "contractLoanId" BIGINT,
    "offerId" TEXT,
    "contractOfferId" BIGINT,
    "lenderWallet" TEXT NOT NULL,
    "borrowerWallet" TEXT NOT NULL,
    "loanAsset" TEXT NOT NULL,
    "principal" DECIMAL(30,7) NOT NULL,
    "outstandingDebt" DECIMAL(30,7) NOT NULL,
    "fixedAprBps" INTEGER NOT NULL,
    "collateralAsset" TEXT NOT NULL,
    "collateralAmount" DECIMAL(30,7) NOT NULL,
    "startTime" TIMESTAMP(3),
    "dueTime" TIMESTAMP(3),
    "maxLtvBps" INTEGER NOT NULL,
    "liquidationThresholdBps" INTEGER NOT NULL,
    "liquidationBonusBps" INTEGER NOT NULL,
    "minHealthFactorBps" INTEGER NOT NULL DEFAULT 14000,
    "gracePeriodDays" INTEGER NOT NULL,
    "healthFactor" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "ltv" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "riskZone" "RiskZone" NOT NULL DEFAULT 'SAFE',
    "status" "LoanStatus" NOT NULL DEFAULT 'PendingCollateral',
    "txHash" TEXT,
    "explorerUrl" TEXT,
    "claimedByLender" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OraclePrice" (
    "id" TEXT NOT NULL,
    "assetPair" TEXT NOT NULL,
    "baseAsset" TEXT,
    "quoteAsset" TEXT,
    "price" DECIMAL(30,12) NOT NULL,
    "decimals" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OraclePrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "explorerUrl" TEXT,
    "type" "TransactionType" NOT NULL,
    "wallet" TEXT NOT NULL,
    "offerId" TEXT,
    "loanId" TEXT,
    "asset" TEXT,
    "amount" DECIMAL(30,7),
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_wallet_key" ON "User"("wallet");

-- CreateIndex
CREATE UNIQUE INDEX "LoanOffer_contractOfferId_key" ON "LoanOffer"("contractOfferId");

-- CreateIndex
CREATE INDEX "LoanOffer_lenderWallet_idx" ON "LoanOffer"("lenderWallet");

-- CreateIndex
CREATE INDEX "LoanOffer_status_idx" ON "LoanOffer"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Loan_contractLoanId_key" ON "Loan"("contractLoanId");

-- CreateIndex
CREATE INDEX "Loan_borrowerWallet_idx" ON "Loan"("borrowerWallet");

-- CreateIndex
CREATE INDEX "Loan_lenderWallet_idx" ON "Loan"("lenderWallet");

-- CreateIndex
CREATE INDEX "Loan_status_idx" ON "Loan"("status");

-- CreateIndex
CREATE INDEX "Loan_riskZone_idx" ON "Loan"("riskZone");

-- CreateIndex
CREATE UNIQUE INDEX "OraclePrice_assetPair_key" ON "OraclePrice"("assetPair");

-- CreateIndex
CREATE INDEX "OraclePrice_baseAsset_quoteAsset_idx" ON "OraclePrice"("baseAsset", "quoteAsset");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_txHash_key" ON "Transaction"("txHash");

-- CreateIndex
CREATE INDEX "Transaction_wallet_idx" ON "Transaction"("wallet");

-- CreateIndex
CREATE INDEX "Transaction_type_idx" ON "Transaction"("type");

-- CreateIndex
CREATE INDEX "Transaction_loanId_idx" ON "Transaction"("loanId");

-- CreateIndex
CREATE INDEX "Transaction_offerId_idx" ON "Transaction"("offerId");

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "LoanOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
