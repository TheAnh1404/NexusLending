# 08 - Data Model

The backend database is a PostgreSQL/Prisma cache and audit layer for the Soroban contracts. Contracts remain the source of truth for financial state.

## Prisma Enums

User roles:

```text
LENDER, BORROWER, LIQUIDATOR
```

Offer statuses:

```text
Draft, Funding, Active, Matched, Cancelled, Expired
```

Loan statuses:

```text
PendingCollateral, Active, Warning, LiquidationPlanning, Repaid, Closed, Expired, Defaulted, Liquidated
```

Risk zones:

```text
SAFE, WARNING, LIQUIDATION_PLANNING
```

Transaction types include offer, loan, oracle, liquidation, and receipt audit actions. Legacy values such as `CLAIM_REPAYMENT` may still exist in the enum for backwards compatibility, but current Soroban repayment flows transfer repayment directly to the lender.

## Core Tables

### User

| Field | Purpose |
| --- | --- |
| `wallet` | Stellar public key, unique |
| `role` | Optional UI role |
| `displayName` | Optional display label |

### LoanOffer

| Field | Purpose |
| --- | --- |
| `contractOfferId` | Soroban offer ID, unique when deployed |
| `lenderWallet` | Lender public key |
| `loanAsset`, `collateralAsset` | Asset contract IDs or configured asset references |
| `loanAmount` | Principal amount, `Decimal(30, 7)` |
| `fixedAprBps`, `durationDays` | Fixed-rate terms |
| `maxLtvBps`, `liquidationThresholdBps`, `liquidationBonusBps` | Risk terms |
| `gracePeriodDays`, `minHealthFactorBps` | Time and HF terms |
| `status` | `Draft` by default |
| `txHash`, `explorerUrl`, `ledger`, `blockTimestamp` | Latest relevant receipt telemetry |

Indexes: `lenderWallet`, `status`.

### Loan

| Field | Purpose |
| --- | --- |
| `contractLoanId` | Soroban loan ID, unique when created |
| `offerId`, `contractOfferId` | Linked offer references |
| `lenderWallet`, `borrowerWallet` | Parties |
| `principal`, `outstandingDebt`, `collateralAmount` | Financial amounts, `Decimal(30, 7)` |
| `fixedAprBps`, `durationDays`, `dueTime`, `gracePeriodDays` | Loan term and maturity |
| `maxLtvBps`, `liquidationThresholdBps`, `liquidationBonusBps`, `minHealthFactorBps` | Risk terms |
| `healthFactor`, `ltv`, `riskZone`, `status` | Indexed risk state |
| `txHash`, `explorerUrl`, `ledger`, `blockTimestamp` | Latest relevant receipt telemetry |
| `closedAt` | Terminal settlement timestamp when applicable |

Indexes: `borrowerWallet`, `lenderWallet`, `status`, `riskZone`.

### OraclePrice

| Field | Purpose |
| --- | --- |
| `assetPair` | Pair label such as `XLM/USDC`, unique |
| `baseAsset`, `quoteAsset` | Asset IDs used by contract fresh-price lookup |
| `price`, `decimals`, `source` | Cached oracle value |
| `updatedAt` | On-chain update timestamp |

Indexes: `baseAsset`, `quoteAsset`.

### Transaction

| Field | Purpose |
| --- | --- |
| `txHash` | Confirmed Stellar transaction hash, unique |
| `explorerUrl`, `ledger`, `network`, `confirmedAt`, `blockTimestamp` | Receipt metadata |
| `contract`, `contractId` | Contract involved in the action |
| `type`, `wallet`, `offerId`, `loanId`, `asset`, `amount` | Audit classification |
| `eventName`, `actor`, `entityType`, `entityId` | Event/indexer metadata |
| `metadata` | Extra normalized event data |

Indexes: `wallet`, `type`, `loanId`, `offerId`, `contractId`, `ledger`, `entityType/entityId`.

### IndexedEvent

Stores every normalized Soroban event seen by the backend verification path or background indexer. `(txHash, eventIndex)` is unique so reprocessing is idempotent.

### IndexerCheckpoint

Tracks the indexer's network, last/current ledger, status, pending/processed/failed event counts, and last error.

## Contract-To-Database Lifecycle

| Phase | On-chain source | Database result |
| --- | --- | --- |
| Draft created | No contract state yet | `LoanOffer` row with `Draft` |
| Offer deployed | Marketplace `create_offer` | `contractOfferId` and receipt saved |
| Offer funded | Marketplace `fund_offer` + Vault lock | Offer becomes `Funding` |
| Offer activated | Marketplace `activate_offer` | Offer becomes `Active` |
| Offer accepted | Marketplace `accept_offer` + Loan Manager loan creation | Offer becomes `Matched`; loan row becomes `PendingCollateral` |
| Loan activated | Loan Manager `activate_loan` | Loan status, HF, LTV, debt, due time synced |
| Oracle updated | Oracle `set_price_for_assets` | `OraclePrice` upserted; open loans can be recalculated |
| Repayment/collateral/liquidation | Loan Manager action events and contract reads | Loan debt/collateral/risk state and `Transaction` updated |

## Precision

Stellar classic asset amounts use 7 decimals. Database amount fields use `Decimal(30, 7)` unless a higher precision is needed for price/risk values.
