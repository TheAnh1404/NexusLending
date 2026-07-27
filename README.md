# Nexus Lending Protocol

Nexus is a collateralized fixed-rate peer-to-peer lending marketplace built on Stellar Soroban. Lenders create isolated loan offers, borrowers accept terms with XLM collateral, and Soroban contracts enforce escrow, repayment, health factor monitoring, and liquidation.

Live demo: [https://nexus-nta9.vercel.app/](https://nexus-nta9.vercel.app/)

<p align="center">
  <a href="https://nexus-nta9.vercel.app/">
    <img src="assets/screenshots/demo-home.png" alt="Nexus live demo home page" width="920" />
  </a>
</p>

## Demo Screens

| Home | Wallet Connect | Testnet Faucet |
| --- | --- | --- |
| <img src="assets/screenshots/demo-home.png" alt="Nexus landing page" width="300" /> | <img src="assets/screenshots/demo-connect.png" alt="Nexus wallet connect page" width="300" /> | <img src="assets/screenshots/demo-faucet.png" alt="Nexus testnet faucet" width="300" /> |

## What Nexus Does

Nexus is not a pooled lending protocol. Every position is a direct lender-borrower agreement with its own terms and isolated escrow.

- Fixed APR offers: lenders choose amount, duration, APR, max LTV, liquidation threshold, liquidation bonus, grace period, and minimum health factor.
- Isolated escrow: principal and collateral move through Soroban contracts instead of shared liquidity pools.
- Borrower controls: borrowers can accept offers, activate loans, add collateral, partially repay, or fully repay.
- Lender controls: lenders can create, fund, activate, manage, and cancel available offers.
- Risk monitoring: health factor, LTV, due dates, liquidation planning, and default states are tracked in the UI.
- Testnet faucet: testers can request Stellar testnet assets from a standalone faucet page.
- Backend verification: the API stores indexed state and verifies confirmed chain receipts from Soroban transactions.

## Current Stack

| Layer | Technology |
| --- | --- |
| Frontend | Vite, React 19, TypeScript, Ant Design 6, React Router, Recharts, Framer Motion |
| Wallet and chain | Freighter, Stellar SDK 16, Stellar Testnet, Soroban RPC, Horizon |
| Backend | Node.js, Express 5, TypeScript, Prisma, PostgreSQL, Zod |
| Smart contracts | Rust, Soroban SDK 25.3.1, workspace contracts |
| Deployment | Vercel frontend and backend-compatible serverless entrypoint |

## Architecture

```mermaid
graph TB
    User[User Browser] --> FE[Frontend<br/>Vite + React]
    FE --> Wallet[Freighter Wallet]
    FE --> API[Backend REST API]
    FE --> RPC[Soroban RPC]
    API --> DB[(PostgreSQL<br/>Prisma)]
    API --> Verifier[Receipt and Event Verification]
    API --> Indexer[Event Indexer]
    Indexer --> RPC
    Verifier --> RPC
    Wallet --> RPC

    subgraph Soroban Contracts
      Marketplace[Marketplace]
      LoanManager[Loan Manager]
      Vault[Vault / Escrow]
      Oracle[Oracle]
      Faucet[Faucet]
    end

    RPC --> Marketplace
    RPC --> LoanManager
    RPC --> Vault
    RPC --> Oracle
    RPC --> Faucet
    Marketplace --> Vault
    Marketplace --> LoanManager
    LoanManager --> Vault
    LoanManager --> Oracle
```

The smart contracts are the source of truth for financial state. The backend is an indexed cache and verification layer. The frontend signs transactions with Freighter and submits them to Stellar.

## Project Layout

```text
Nexus/
  assets/
    logo.png
    screenshots/                 # README and product screenshots
  backend/
    api/index.ts                 # Vercel serverless entrypoint
    prisma/                      # Prisma schema, migrations, seed
    src/
      app.ts                     # Express app
      config/                    # Environment parsing
      middlewares/               # Validation and error handling
      modules/
        analytics/               # Dashboard metrics
        faucet/                  # Faucet config, eligibility, request API
        indexer/                 # Soroban event sync
        loans/                   # Loan APIs and action verification
        offers/                  # Offer APIs and state transitions
        oracle/                  # Price updates and recalculation
        transactions/            # Activity and receipt logs
        users/                   # Wallet user records
        verification/            # Stellar/Soroban tx verification
  contracts/
    Cargo.toml                   # Soroban Rust workspace
    shared/                      # Shared contract structs and enums
    marketplace/                 # Offer lifecycle and matching
    loan-manager/                # Loan state, repayment, liquidation
    vault/                       # Escrow custody and transfers
    oracle/                      # Asset price records
    faucet/                      # Testnet asset request contract
    scripts/                     # Build, deploy, init, verification scripts
  deployments/
    testnet.json                 # Current public testnet contract IDs
  docs/                          # Product, architecture, contract, API docs
  frontend/
    public/
    src/
      app/                       # Routes and app context
      components/                # Common, landing, faucet, marketplace, portfolio UI
      contexts/                  # Lending and wallet state
      data/                      # Mock data
      layouts/                   # Public, app, faucet layouts
      pages/                     # Landing, Connect, Marketplace, My Loans, Portfolio, Settings, Faucet
      services/                  # API clients, Soroban contracts, wallet, faucet
      types/                     # Shared frontend domain types
      utils/                     # Finance, health, formatting, wallet helpers
```

Generated folders such as `frontend/dist`, `backend/dist`, and `node_modules` should not be hand-edited.

## Application Routes

| Route | Purpose |
| --- | --- |
| `/` | Public landing page with protocol overview and live telemetry |
| `/connect` | Freighter wallet connection and role selection |
| `/faucet` | Standalone Stellar Testnet faucet |
| `/app/marketplace` | Active offers, grouped lending terms, borrow/create/manage offer flows |
| `/app/my-loans` | Borrowing and lending positions, repayment, collateral, liquidation actions |
| `/app/portfolio` | Wallet balances, lent/borrowed exposure, asset breakdown, positions |
| `/app/settings` | Network, contract, notification, oracle/admin, and activity panels |

## Core User Flows

### Lender Flow

1. Connect Freighter on Stellar Testnet.
2. Create a loan offer with USDC principal and XLM collateral terms.
3. Sign `create_offer`.
4. Fund escrow through the Marketplace/Vault contracts.
5. Activate the offer so borrowers can accept it.
6. Receive repayment or cancel an unmatched offer.

### Borrower Flow

1. Open Marketplace and choose an active offer.
2. Review required XLM collateral, LTV, APR, duration, total repayment, and health factor.
3. Sign `accept_offer`.
4. Activate the pending loan to lock collateral and receive principal.
5. Manage the loan by adding collateral, partial repayment, full repayment, or monitoring liquidation risk.

### Liquidation Flow

1. Watch loans in Warning, Liquidation Planning, Expired, or Defaulted states.
2. Repay the allowed portion of unhealthy debt.
3. Receive seized collateral with the configured liquidation bonus.

### Faucet Flow

1. Open `/faucet`.
2. Connect wallet or paste a Stellar address.
3. Select XLM, USDC, or collateral test asset.
4. Request testnet funds subject to cooldown and daily limits.

## Smart Contracts

The Soroban workspace contains five contracts plus one shared crate.

| Contract | Path | Responsibility |
| --- | --- | --- |
| Marketplace | `contracts/marketplace` | Create, fund, activate, cancel, expire, and accept offers |
| Loan Manager | `contracts/loan-manager` | Loan activation, health factor, LTV, repayment, default, liquidation |
| Vault | `contracts/vault` | Isolated custody of principal, collateral, repayment, refunds |
| Oracle | `contracts/oracle` | Admin-updated XLM/USDC price records for HF/LTV math |
| Faucet | `contracts/faucet` | Testnet asset request and cooldown logic |
| Shared | `contracts/shared` | Shared Soroban structs, enums, constants |

Current testnet deployment is recorded in [deployments/testnet.json](deployments/testnet.json):

| Component | Contract ID |
| --- | --- |
| Marketplace | `CDSGIW54X2RKDBO45MWALEVFTQSPSVBHVJHWKNXPH6I45X53O3VKSPTQ` |
| Loan Manager | `CAYTXKDN2234LNH2VMZJQ4WLE4QLMZRDA6GMAYB2MBRNIHNHPT4HSNGI` |
| Vault | `CD55UGC2V2W4GQCZUOJNGBCBMCDFM5W3OEKJAFUKJ36AEPWIPFKAYUKK` |
| Oracle | `CAJ4XISOJBHJOCLYF5722T27ZF3UZ57P7DEZ4I462CRC7X5QYQPH63DC` |
| Faucet | `CBG5N6EN3P2P7TW6IZ3LIDDUXT6VHNBNBTYPCHAQTREHETMM5XAXMTLL` |

## Backend API

The backend exposes an Express REST API under `/api`.

| Module | Base Path | Notes |
| --- | --- | --- |
| Health | `/api/health` and `/health` | Service status |
| Users | `/api/users` | Wallet user records |
| Offers | `/api/offers` | Offer listing, create, deploy, fund, activate, cancel, accept, sync-chain |
| Loans | `/api/loans` | Loan listing and borrower/lender actions |
| Analytics | `/api/analytics/dashboard` | Dashboard aggregates |
| Oracle | `/api/oracle` | Price update and health recalculation APIs |
| Indexer | `/api/indexer` | Event sync controls |
| Transactions | `/api/transactions` | Activity and receipt logs |
| Faucet | `/api/faucet` | Faucet config, eligibility, request, reset |

The backend validates request bodies with Zod, serializes BigInt/Decimal responses, verifies Soroban receipts, and stores indexed state in PostgreSQL through Prisma.

## Local Development

### Prerequisites

- Node.js 20 or newer
- npm
- PostgreSQL
- Rust toolchain
- `wasm32-unknown-unknown` target
- Stellar CLI for contract deployment/testing workflows
- Freighter browser extension configured for Stellar Testnet

### Install

```bash
npm install
npm --prefix frontend install
npm --prefix backend install
```

### Backend Setup

Create `backend/.env` from `backend/.env.example` and replace values with your local database and deployed contract IDs. Do not commit real credentials.

Required backend variables:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/nexus?schema=public"
PORT=5000
FRONTEND_URL=http://localhost:5173
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org:443
MARKETPLACE_CONTRACT_ID=...
LOAN_MANAGER_CONTRACT_ID=...
ORACLE_CONTRACT_ID=...
VAULT_CONTRACT_ID=...
```

Run Prisma and start the API:

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

The API runs on `http://localhost:5000` by default.

### Frontend Setup

Create `frontend/.env` from `frontend/.env.example`.

Important frontend variables:

```bash
VITE_API_URL=http://localhost:5000
VITE_DATA_MODE=api
VITE_CHAIN_MODE=live
VITE_STELLAR_NETWORK=testnet
VITE_MARKETPLACE_CONTRACT_ID=...
VITE_LOAN_MANAGER_CONTRACT_ID=...
VITE_ORACLE_CONTRACT_ID=...
VITE_VAULT_CONTRACT_ID=...
```

Start Vite:

```bash
cd frontend
npm run dev
```

The app runs on `http://localhost:5173` by default.

## Build, Lint, and Test

Frontend validation:

```bash
cd frontend
npm run lint
npm run build
```

Backend validation:

```bash
cd backend
npm test
npm run build
```

Root convenience scripts:

```bash
npm run lint
npm run test
npm run build
```

Contract checks:

```bash
cd contracts
cargo test
cargo build --target wasm32-unknown-unknown --release
```

Contract helper scripts are in `contracts/scripts`, including PowerShell and shell versions for build, deploy, initialize, price update, and verification.

## Data Modes

The frontend can run in two modes:

| Mode | Config | Behavior |
| --- | --- | --- |
| API/live | `VITE_DATA_MODE=api` | Uses backend REST API and live Soroban receipts. This is the default. |
| Mock | `VITE_DATA_MODE=mock` | Uses local mock state for UI demos and offline development. |

When `VITE_DATA_MODE=api`, `VITE_CHAIN_MODE=mock` is ignored because backend writes require confirmed Soroban receipts.

## Documentation Map

The detailed technical docs live in `docs/`.

| File | Topic |
| --- | --- |
| [docs/00_PROJECT_OVERVIEW.md](docs/00_PROJECT_OVERVIEW.md) | Project identity, actors, stack, glossary |
| [docs/01_BUSINESS_RULES.md](docs/01_BUSINESS_RULES.md) | Lending rules, formulas, risk thresholds |
| [docs/02_SYSTEM_ARCHITECTURE.md](docs/02_SYSTEM_ARCHITECTURE.md) | System architecture and data flow |
| [docs/03_SMART_CONTRACT_ARCHITECTURE.md](docs/03_SMART_CONTRACT_ARCHITECTURE.md) | Contract internals and dependencies |
| [docs/05_CONTRACT_SPECIFICATION.md](docs/05_CONTRACT_SPECIFICATION.md) | Public contract API reference |
| [docs/09_BACKEND_SPEC.md](docs/09_BACKEND_SPEC.md) | Backend API specification |
| [docs/10_FRONTEND_INTEGRATION.md](docs/10_FRONTEND_INTEGRATION.md) | Frontend integration notes |
| [docs/11_SECURITY_RULES.md](docs/11_SECURITY_RULES.md) | Security model and trust boundaries |
| [docs/12_DEMO_FLOW.md](docs/12_DEMO_FLOW.md) | End-to-end demo scenarios |

Some older documentation files contain encoding artifacts, but the project structure and code are current.

## Security Notes

- User keys remain in Freighter. The frontend never stores or exports private keys.
- Smart contracts are authoritative for funds and loan state.
- Backend state is a cache/index plus verification layer, not the financial source of truth.
- Use only testnet assets in the current demo.
- Never commit `.env` files, wallet keys, production database URLs, or deployer secrets.

## Status

Nexus is a live Stellar Testnet MVP. It demonstrates the full product surface for collateralized fixed-rate P2P lending, including smart contracts, frontend workflows, backend indexing, transaction verification, and a standalone testnet faucet.
