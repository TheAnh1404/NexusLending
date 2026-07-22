# 09 - Backend Specification

The backend is an Express + TypeScript + Prisma service. It is a verified index/cache layer for Nexus protocol state; it is not a wallet, custodian, or transaction signer.

## Current Responsibilities

- Serve REST data to the React frontend.
- Persist users, offers, loans, oracle prices, transaction receipts, indexed events, and indexer checkpoints.
- Verify submitted Stellar transaction hashes through Soroban RPC before mutating protocol state.
- Match expected contract IDs, event names, actors, entities, and amounts for sensitive actions.
- Read authoritative offer/loan/risk state back from contracts after confirmed mutations.
- Run a background event indexer that polls Soroban RPC and deduplicates by `(txHash, eventIndex)`.

## Verification Boundary

In `VITE_DATA_MODE=api`, the frontend signs and submits transactions through Freighter/Stellar SDK. The backend only accepts the resulting confirmed receipt:

```json
{
  "txHash": "64_hex_chars",
  "explorerUrl": "https://stellar.expert/explorer/testnet/tx/<txHash>",
  "ledger": 123456,
  "txStatus": "SUCCESS",
  "contractId": "C...",
  "blockTimestamp": "2026-07-22T00:00:00.000Z",
  "contractReturnValue": "optional"
}
```

`requireConfirmedReceipt()` rejects missing hashes, non-64-character hashes, non-Stellar-Expert URLs, missing/invalid ledgers, and any non-`SUCCESS` status.

`verificationService.verifyAction()` then verifies the action against Soroban RPC. Services use it for offer deployment/funding/activation/cancel/expire/accept, loan activation/collateral/repay/liquidation, oracle price updates, and transaction logging.

## API Surface

Base URL: `/api`.

### Health

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Service health check |

### Users

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/users/:wallet` | Get a wallet user |
| `POST` | `/users` | Create/register a wallet user |

### Offers

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/offers` | List offers. Filters: `status`, `lenderWallet`, `marketplaceOnly=true` |
| `GET` | `/offers/:id` | Get offer by database ID |
| `POST` | `/offers` | Create local draft terms |
| `POST` | `/offers/:id/deploy` | Persist verified `create_offer` receipt and contract offer ID |
| `POST` | `/offers/:id/fund` | Verify `fund_offer`; move `Draft -> Funding` |
| `POST` | `/offers/:id/sync-chain` | Read current on-chain offer and sync DB |
| `POST` | `/offers/:id/activate` | Verify `activate_offer`; move `Funding -> Active` |
| `POST` | `/offers/:id/cancel` | Verify `cancel_offer`; move to `Cancelled` |
| `POST` | `/offers/:id/expire` | Verify `expire_offer`; move to `Expired` |
| `POST` | `/offers/:id/accept` | Verify `accept_offer`; move offer to `Matched` and create `PendingCollateral` loan |
| `PATCH` | `/offers/:id/status` | Administrative/status sync endpoint |

### Loans

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/loans` | List loans. Filters: `status`, `borrowerWallet`, `lenderWallet`, `riskZone` |
| `GET` | `/loans/liquidatable` | List `LiquidationPlanning` and `Defaulted` loans |
| `GET` | `/loans/:id` | Get loan by database ID |
| `POST` | `/loans` | Create a loan record when needed for sync/import paths |
| `POST` | `/loans/:id/activate` | Verify `activate_loan`; lock collateral and disburse principal |
| `PATCH` | `/loans/:id` | Verify `ADD_COLLATERAL`, `PARTIAL_REPAY`, `FULL_REPAY`, or `LIQUIDATE` action |

### Oracle

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/oracle/prices` | Return cached oracle prices |
| `POST` | `/oracle/prices` | Verify oracle update receipt and upsert price |
| `POST` | `/oracle/recalculate-health` | Read current contract risk for loans and update cache |

### Transactions

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/transactions` | List receipts. Filters: `wallet`, `relatedWallet`, `type`, `loanId`, `offerId` |
| `POST` | `/transactions` | Verify and persist a confirmed transaction receipt |

## State Names

Backend enum names match the current contract/frontend state names.

Offer statuses:

```text
Draft, Funding, Active, Matched, Cancelled, Expired
```

Loan statuses:

```text
PendingCollateral, Active, Warning, LiquidationPlanning, Repaid, Closed, Expired, Defaulted, Liquidated
```

## Indexer

The background indexer:

- Connects to the configured Soroban RPC network.
- Filters contract events by the deployed Marketplace, Vault, Loan Manager, and Oracle IDs.
- Parses event topics/data into normalized `IndexedEvent` records.
- Applies event changes to `LoanOffer`, `Loan`, `OraclePrice`, and `Transaction`.
- Uses `(txHash, eventIndex)` uniqueness to make polling idempotent.
- Keeps `IndexerCheckpoint` with current ledger, processed count, pending count, failures, and last error.

API verification and background indexing share the same persistence rules, so a transaction handled through a mutation route will be ignored safely when later seen by the indexer.

## Soroban Service

`src/modules/soroban/soroban.service.ts` is not a mock transaction generator in the live path. The live frontend assembles, signs, submits, and confirms Soroban calls. Backend services verify receipts and read contract state. Any old mock-chain flow must remain outside `DATA_MODE=api`; API mode requires real Soroban RPC verification.

## Environment

Important backend variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | Express runtime port |
| `FRONTEND_URL` | CORS allowlist origin |
| `STELLAR_NETWORK` | `testnet`, `public`, `futurenet`, or standalone/local |
| `STELLAR_RPC_URL` | Soroban RPC endpoint |
| `STELLAR_READ_SOURCE_ACCOUNT` | Optional account used for read-only contract simulations when events do not expose a usable source |
| `MARKETPLACE_CONTRACT_ID` | Marketplace contract ID |
| `LOAN_MANAGER_CONTRACT_ID` | Loan Manager contract ID |
| `ORACLE_CONTRACT_ID` | Oracle contract ID |
| `VAULT_CONTRACT_ID` | Vault contract ID |

## Validation Commands

Run from `backend/`:

```bash
npm run build
npm run test
```
