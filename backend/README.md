# Nexus Backend

Express + TypeScript + Prisma backend for indexing Nexus contract data and serving the React frontend.

## Responsibilities

- Store indexed users, offers, loans, oracle prices, and transactions.
- Serve REST APIs to the frontend.
- Store `txHash` and explorer URLs.
- Recalculate health factor/risk zones from indexed oracle prices.
- Keep custody and sensitive lending logic inside Soroban contracts.

## Setup

```bash
npm install
cp .env.example .env
npx prisma generate
npm run build
npm run dev
```

Use PostgreSQL for `DATABASE_URL`, then run migrations when ready:

```bash
npx prisma migrate dev --name init
```

## API

Health:

- `GET /api/health`

Users:

- `GET /api/users/:wallet`
- `POST /api/users`

Offers:

- `GET /api/offers`
- `GET /api/offers/:id`
- `POST /api/offers`
- `POST /api/offers/:id/fund`
- `POST /api/offers/:id/activate`
- `POST /api/offers/:id/cancel`
- `POST /api/offers/:id/expire`
- `POST /api/offers/:id/accept`
- `PATCH /api/offers/:id/status`

Loans:

- `GET /api/loans`
- `GET /api/loans/liquidatable`
- `GET /api/loans/:id`
- `POST /api/loans`
- `POST /api/loans/:id/activate`
- `PATCH /api/loans/:id`

Oracle:

- `GET /api/oracle/prices`
- `POST /api/oracle/prices`
- `POST /api/oracle/recalculate-health`

Transactions:

- `GET /api/transactions`
- `POST /api/transactions`

## Finance Utility

`src/utils/finance.ts` mirrors frontend rules:

- `calculateHealthFactor()`
- `calculateLTV()`
- `getRiskZone()`
- `calculateRepaymentAmount()`
- `calculateRequiredCollateral()`

## Soroban Integration & Event Indexer

The backend is database/indexer only. It never signs transactions, creates transaction hashes, or fabricates explorer URLs. Mutating endpoints accept only confirmed Soroban transaction receipts from the frontend wallet flow: `txHash`, `explorerUrl`, `ledger`, `txStatus=SUCCESS`, contract metadata, and optional block timestamp.

The background `IndexerService` monitors Stellar Testnet RPC for contract events, parses them, and can mirror confirmed on-chain state into PostgreSQL asynchronously.

### Background Indexer Service
When the server starts:
- It connects to Stellar Testnet RPC.
- Polls events filtered by the deployed `Marketplace`, `Vault`, `Oracle`, and `Loan Manager` contract addresses.
- Parses topic structures (e.g. `offer_created`, `offer_accepted`, `loan_activated`) and updates database state.
- Gracefully handles service shutdown.
