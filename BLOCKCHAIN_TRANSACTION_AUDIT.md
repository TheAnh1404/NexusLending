# Blockchain Transaction Audit

## Summary

Nexus transaction flow has been refactored so blockchain-related mutations are driven by confirmed Soroban transactions from the frontend Freighter flow. The backend is now an indexer/database layer: it does not sign, submit, create transaction hashes, or fabricate explorer URLs.

Required transaction order:

1. Frontend builds Soroban transaction.
2. Freighter requests user signature.
3. Frontend submits the signed transaction to Stellar RPC.
4. Frontend polls RPC until `SUCCESS`.
5. Frontend receives real `txHash`, ledger, status, contract return value, and Stellar Expert URL.
6. Frontend calls backend with the confirmed receipt.
7. Backend validates and persists the receipt and indexed state.
8. UI refreshes from backend state.

## Shared Receipt Contract

Backend mutating endpoints now require:

- `txHash`: 64-character Stellar transaction hash.
- `explorerUrl`: `https://stellar.expert/explorer/testnet/tx/{txHash}` or equivalent Stellar Expert network URL.
- `ledger`: positive integer.
- `txStatus`: `SUCCESS`.
- `contractId`: invoked contract ID.
- `blockTimestamp`: frontend-provided ledger close time when available.
- Contract return IDs where required, such as `contractOfferId` and `contractLoanId`.

Requests missing a confirmed receipt are rejected before any database write.

## Transaction Flows

### 1. Create Offer

Old implementation:
- Backend `offersService.create()` called a mock Soroban service and persisted an offer plus generated tx metadata.

New implementation:
- Frontend calls `marketplace.create_offer`.
- Freighter signs.
- RPC confirms `SUCCESS`.
- Return value is parsed as `contractOfferId`.
- Backend persists offer and transaction only after receipt validation.

### 2. Fund Offer

Old implementation:
- Backend changed offer status to `Funding` and generated or accepted fallback tx metadata.

New implementation:
- Frontend calls `marketplace.fund_offer(contractOfferId)`.
- Backend persists `Funding` only with confirmed tx receipt.

### 3. Activate Offer

Old implementation:
- Backend changed offer status to `Active` before any required on-chain confirmation in non-Soroban paths.

New implementation:
- Frontend calls `marketplace.activate_offer(contractOfferId)`.
- Backend persists `Active` only after confirmed receipt.

### 4. Accept Offer

Old implementation:
- Backend created the loan and marked offer matched while relying on mock Soroban metadata.

New implementation:
- Frontend calls `marketplace.accept_offer`.
- Return value is parsed as `contractLoanId`.
- Backend creates the indexed loan and marks the offer matched only after confirmed receipt.

### 5. Activate Loan

Old implementation:
- Backend activated loans and generated fallback transaction metadata.

New implementation:
- Frontend calls `loan_manager.activate_loan(contractLoanId)`.
- Backend persists loan activation, ledger, hash, and explorer URL only after confirmed receipt.

### 6. Add Collateral

Old implementation:
- Backend updated loan collateral and health state using mock transaction data when needed.

New implementation:
- Frontend calls `loan_manager.add_collateral`.
- Backend recalculates indexed risk state only after confirmed receipt.

### 7. Partial Repay

Old implementation:
- Backend reduced debt and logged a generated/fallback transaction.

New implementation:
- Frontend calls `loan_manager.partial_repay`.
- Backend persists debt/risk changes only after confirmed receipt.

### 8. Full Repay

Old implementation:
- Backend closed repayment state and generated/fallback transaction metadata.

New implementation:
- Frontend calls `loan_manager.full_repay`.
- Backend persists `Repaid`, released-collateral index state, and transaction record only after confirmed receipt.

### 9. Liquidate Loan

Old implementation:
- Backend computed liquidation changes and generated/fallback tx metadata.

New implementation:
- Frontend calls `loan_manager.liquidate`.
- Backend persists liquidation result only after confirmed receipt.

### 10. Oracle Update

Old implementation:
- Backend called mock oracle tx generation before upserting oracle price.

New implementation:
- Frontend calls `oracle.set_price_for_assets`.
- Backend upserts oracle price and transaction record only after confirmed receipt.

### 11. Future Blockchain Actions

Backend direct loan writes and direct offer status writes are disabled. New blockchain actions must provide the same confirmed receipt contract before persistence.

## Files Changed

Key frontend files:
- `frontend/src/services/soroban/transaction.ts`
- `frontend/src/services/soroban/config.ts`
- `frontend/src/services/soroban/marketplace.contract.ts`
- `frontend/src/services/soroban/loanManager.contract.ts`
- `frontend/src/services/soroban/oracle.contract.ts`
- `frontend/src/contexts/LendingContext.tsx`
- `frontend/src/services/api/*.ts`
- `frontend/src/types/index.ts`

Key backend files:
- `backend/src/modules/transactions/chainReceipt.ts`
- `backend/src/modules/transactions/transactions.schemas.ts`
- `backend/src/modules/offers/*.ts`
- `backend/src/modules/loans/*.ts`
- `backend/src/modules/oracle/*.ts`
- `backend/src/modules/soroban/soroban.service.ts`
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260706161000_add_confirmed_chain_receipts/migration.sql`

## Mock Logic Removed

Removed application paths that:
- Generated mock transaction hashes in backend offer, loan, oracle, and Soroban services.
- Generated frontend fallback transaction hashes.
- Fabricated Stellar Expert URLs from backend mock hashes.
- Let backend mutate offer/loan/oracle state before confirmed transaction metadata.
- Recorded wallet connection as a fake transaction.

## Explorer Integration

The frontend generates Stellar Expert links from the actual RPC hash:

`https://stellar.expert/explorer/testnet/tx/{txHash}`

The backend validates that the explorer URL points to the supplied `txHash` before storing it.

## Backend Persistence Strategy

The backend now stores confirmed receipt fields on:

- `LoanOffer`: `contractOfferId`, `txHash`, `explorerUrl`, `ledger`, `blockTimestamp`, `status`.
- `Loan`: `contractLoanId`, `txHash`, `explorerUrl`, `ledger`, `blockTimestamp`, `status`.
- `Transaction`: `type`, `wallet`, `txHash`, `contract`, `ledger`, `status`, `blockTimestamp`, `createdAt`.

## Known Limitations

- `CLAIM_REPAYMENT` is disabled in the frontend/API flow because the current Soroban contracts transfer repayment during `partial_repay`/`full_repay` and do not expose a public claim method.
- `USDC` needs a real Stellar asset contract. Set `VITE_USDC_CONTRACT_ID` or `VITE_USDC_ISSUER`; `XLM` is resolved from `Asset.native().contractId(PASSPHRASE)`.
- `prisma generate` updated the generated TypeScript client but Windows held the Prisma query engine DLL open during replacement. Backend build passed with the regenerated types.

## Validation

Commands run:

- `cargo test --workspace` from `contracts/`: passed.
- `npm run build` from `backend/`: passed.
- `npm run build` from `frontend/`: passed with elevated process permission after Vite hit Windows `spawn EPERM`.
