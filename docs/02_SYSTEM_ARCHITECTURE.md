# 02 — System Architecture

> Three-tier architecture, component responsibilities, deployment topology, and cross-layer data flow for the Nexus Lending Protocol.

---

## 1. Purpose

This document describes the overall system architecture of Nexus Lending. It defines the three-tier structure (Smart Contracts → Backend → Frontend), component responsibilities, deployment topology, and how data flows between layers. For smart contract internals, see `03_SMART_CONTRACT_ARCHITECTURE.md`. For backend and frontend specifics, see `09_BACKEND_SPEC.md` and `10_FRONTEND_INTEGRATION.md`.

---

## 2. Architecture Overview

Nexus follows a three-tier architecture where the smart contracts are the authoritative source of truth for financial state, the backend indexes and caches that state for query performance, and the frontend provides the user experience.

```mermaid
graph TB
    subgraph "Tier 1 — Presentation"
        FE["Frontend<br/>Vite + React + TypeScript + Ant Design"]
    end

    subgraph "Tier 2 — Application"
        BE["Backend API<br/>Express + TypeScript"]
        PR["Prisma ORM"]
        PG[(PostgreSQL)]
        IX["Event Indexer"]
    end

    subgraph "Tier 3 — Smart Contracts"
        MKT["Marketplace"]
        LM["Loan Manager"]
        VLT["Vault / Escrow"]
        ORC["Oracle"]
    end

    subgraph "Infrastructure"
        RPC["Soroban RPC"]
        HZ["Horizon API"]
        NET["Stellar Network<br/>Testnet / Mainnet"]
    end

    FE -->|"REST API"| BE
    FE -->|"Soroban SDK"| RPC
    BE --> PR --> PG
    IX -->|"Poll events"| RPC
    IX --> PG
    BE -->|"Submit tx"| RPC
    MKT & LM & VLT & ORC --- NET
    RPC --- NET
    HZ --- NET
```

---

## 3. Tier Responsibilities

### 3.1 Tier 1 — Presentation (Frontend)

| Responsibility | Description |
|----------------|-------------|
| **Wallet Connection** | Integrates with Freighter wallet for Stellar account management |
| **Transaction Assembly** | Builds Soroban transactions client-side and submits via Soroban RPC |
| **Data Display** | Fetches cached data from the backend REST API for fast rendering |
| **Role-Based Views** | Provides different dashboards for Lender, Borrower, and Liquidator |
| **Real-Time Monitoring** | Displays oracle prices, Health Factors, and loan status |

**Does NOT:**
- Store private keys
- Custody funds
- Execute contract logic server-side

### 3.2 Tier 2 — Application (Backend)

| Responsibility | Description |
|----------------|-------------|
| **REST API** | Serves cached contract data to the frontend via HTTP endpoints |
| **Database** | Stores indexed on-chain state in PostgreSQL via Prisma ORM |
| **Event Indexer** | Polls Soroban RPC for contract events and syncs to database |
| **Analytics** | Computes derived metrics (portfolio totals, historical HF, etc.) |
| **Transaction Support** | Optionally assembles transactions for frontend submission |

**Does NOT:**
- Custody user funds
- Make financial decisions
- Override contract logic
- Store private keys

### 3.3 Tier 3 — Smart Contracts (Soroban)

| Responsibility | Description |
|----------------|-------------|
| **Financial Logic** | All lending rules, HF calculation, interest computation |
| **Asset Custody** | Vault holds and transfers all tokens |
| **State Machine** | Authoritative loan and offer status management |
| **Access Control** | Enforces `require_auth()` on all sensitive operations |
| **Event Emission** | Publishes events for every state change |

**Is the single source of truth** for all financial state.

---

## 4. Component Dependency Matrix

```mermaid
graph LR
    subgraph "Smart Contracts"
        MKT["Marketplace"]
        LM["Loan Manager"]
        VLT["Vault"]
        ORC["Oracle"]
    end

    MKT -->|"create_loan_from_offer()"| LM
    MKT -->|"deposit()<br/>return_loan_asset_to_lender()"| VLT
    LM -->|"lock_collateral()<br/>release_collateral()<br/>transfer_loan_asset_to_borrower()<br/>collect_repayment_from()<br/>transfer_collateral_to_liq()"| VLT
    LM -->|"get_price_for_assets()"| ORC
```

| Caller | Callee | Functions Called |
|--------|--------|-----------------|
| Marketplace | Vault | `deposit()`, `return_loan_asset_to_lender()` |
| Marketplace | Loan Manager | `create_loan_from_offer()` |
| Loan Manager | Vault | `lock_collateral()`, `release_collateral()`, `transfer_loan_asset_to_borrower()`, `collect_repayment_from()`, `transfer_collateral_to_liq()` |
| Loan Manager | Oracle | `get_price_for_assets()` |
| Oracle | — | No outbound calls |
| Vault | — | No outbound calls (only receives) |

---

## 5. Data Flow

### 5.1 On-Chain Data (Source of Truth)

| Data | Location | Format |
|------|----------|--------|
| Loan Offers | Marketplace persistent storage | `LoanOffer` struct per `DataKey::Offer(u64)` |
| Loans | Loan Manager persistent storage | `Loan` struct per `DataKey::Loan(u64)` |
| Oracle Prices | Oracle persistent storage | `PriceData` per `DataKey::Price(String)` and `DataKey::AssetPrice(Address, Address)` |
| Locked Collateral | Vault persistent storage | `i128` per `DataKey::Locked(u64, Address)` |
| Token Balances | Stellar token contracts | Standard Soroban token balances |

### 5.2 Off-Chain Data (Indexed Cache)

| Data | Location | Format |
|------|----------|--------|
| Users | PostgreSQL `User` table | Wallet, role, display name |
| Loan Offers | PostgreSQL `LoanOffer` table | Mirror of on-chain + metadata |
| Loans | PostgreSQL `Loan` table | Mirror of on-chain + computed HF/LTV/riskZone |
| Oracle Prices | PostgreSQL `OraclePrice` table | Latest prices with history |
| Transactions | PostgreSQL `Transaction` table | Transaction log with hashes |

### 5.3 Data Synchronization

```
┌─────────────┐     Events     ┌─────────────┐     REST API    ┌─────────────┐
│   Soroban   │ ──────────────▶│   Backend   │ ──────────────▶│  Frontend   │
│  Contracts  │                │   Indexer   │                │     UI      │
└─────────────┘                └──────┬──────┘                └─────────────┘
                                      │
                                      ▼
                               ┌──────────────┐
                               │  PostgreSQL  │
                               └──────────────┘
```

**Sync Flow:**
1. Smart contracts emit events on every state change
2. Backend indexer polls Soroban RPC for new events
3. Indexer parses events and updates PostgreSQL
4. Frontend queries backend REST API for cached data
5. For write operations, frontend submits transactions directly to Soroban RPC

---

## 6. Transaction Flow

### 6.1 Write Path (User Action → Blockchain)

```
User → Frontend → Wallet (Sign) → Soroban RPC → Contract Execution → Event Emission
```

1. User initiates action in the UI (e.g., "Accept Offer")
2. Frontend assembles a Soroban transaction
3. Wallet (Freighter) signs the transaction
4. Frontend submits the signed transaction to Soroban RPC
5. Soroban executes the contract function
6. Contract emits events

### 6.2 Read Path (Blockchain → User Display)

```
Contract Events → Indexer → PostgreSQL → Backend API → Frontend → User
```

1. Indexer polls Soroban RPC for new events
2. Indexer parses events and writes to PostgreSQL
3. Frontend requests data from the backend REST API
4. Backend queries PostgreSQL and returns JSON
5. Frontend renders the data

### 6.3 Direct Read Path (Emergency / Verification)

```
Frontend → Soroban RPC → Contract View Function → Frontend
```

For real-time or critical data (e.g., HF at the moment of liquidation), the frontend can query contract view functions directly via Soroban RPC.

---

## 7. Deployment Topology

### 7.1 Testnet Environment

```
┌─────────────────────────────────────────┐
│              User's Browser             │
│  ┌─────────────────────────────────┐    │
│  │   Frontend (localhost:5173)     │    │
│  │   Vite Dev Server               │    │
│  └─────────────┬───────────────────┘    │
└────────────────┼────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
┌───────────────┐  ┌──────────────────┐
│ Backend API   │  │ Stellar Testnet  │
│ localhost:5000│  │ Soroban RPC      │
├───────────────┤  │ (Futurenet/Test) │
│ PostgreSQL    │  └──────────────────┘
│ localhost:5432│
└───────────────┘
```

### 7.2 Production Environment

```
┌─────────────────────────────────────────┐
│              CDN / Static Hosting       │
│  ┌─────────────────────────────────┐    │
│  │   Frontend (Vercel / Netlify)   │    │
│  └─────────────┬───────────────────┘    │
└────────────────┼────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
┌───────────────┐  ┌──────────────────┐
│ Backend API   │  │ Stellar Mainnet  │
│ (Cloud VM)    │  │ Soroban RPC      │
├───────────────┤  │ (Public Node)    │
│ PostgreSQL    │  └──────────────────┘
│ (Managed DB)  │
└───────────────┘
```

### 7.3 Contract Deployment

All four contracts are deployed as separate Soroban WASM programs:

| Contract | Deployment Order | Dependencies |
|----------|-----------------|--------------|
| 1. Oracle | First | None |
| 2. Vault | Second | None (addresses set during init) |
| 3. Loan Manager | Third | Oracle address, Vault address |
| 4. Marketplace | Fourth | Loan Manager address, Vault address |

**Initialization Order:**
1. Deploy all four contracts to get their addresses
2. Initialize Oracle with admin address
3. Initialize Vault with admin, Loan Manager address, Marketplace address
4. Initialize Loan Manager with admin, Oracle address, Vault address
5. Initialize Marketplace with admin, Loan Manager address, Vault address

> The Vault must be initialized after Loan Manager and Marketplace are deployed because it needs their addresses for access control.

---

## 8. Configuration

### 8.1 Backend Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/nexus` |
| `PORT` | Backend API port | `5000` |
| `FRONTEND_URL` | CORS origin | `http://localhost:5173` |
| `STELLAR_NETWORK` | Network identifier | `testnet` |
| `STELLAR_RPC_URL` | Soroban RPC endpoint | `https://soroban-testnet.stellar.org` |
| `MARKETPLACE_CONTRACT_ID` | Deployed Marketplace address | `C...` |
| `LOAN_MANAGER_CONTRACT_ID` | Deployed Loan Manager address | `C...` |
| `ORACLE_CONTRACT_ID` | Deployed Oracle address | `C...` |
| `VAULT_CONTRACT_ID` | Deployed Vault address | `C...` |

### 8.2 Frontend Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `VITE_API_URL` | Backend API base URL | `http://localhost:5000/api` |

---

## 9. Security Boundaries

```
┌──────────────────────────────────────────────────────┐
│                    TRUST BOUNDARY                    │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐                  │
│  │ Marketplace  │  │ Loan Manager │                  │
│  └──────────────┘  └──────────────┘                  │
│  ┌──────────────┐  ┌──────────────┐                  │
│  │    Vault     │  │    Oracle    │                  │
│  └──────────────┘  └──────────────┘                  │
│                                                      │
│  All financial logic is inside this boundary.        │
│  Smart contracts are the ONLY authority on funds.    │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│                   CACHE BOUNDARY                     │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐                  │
│  │   Backend    │  │  PostgreSQL  │                  │
│  └──────────────┘  └──────────────┘                  │
│                                                      │
│  Read-only mirror of on-chain state.                 │
│  NEVER authoritative for financial decisions.        │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│                PRESENTATION BOUNDARY                 │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐                  │
│  │   Frontend   │  │   Wallet     │                  │
│  └──────────────┘  └──────────────┘                  │
│                                                      │
│  User interface only. Signs and submits transactions │
│  but never holds custody of funds.                   │
└──────────────────────────────────────────────────────┘
```

> See `11_SECURITY_RULES.md` for the complete security model.

---

## 10. Error Handling Strategy

| Layer | Strategy |
|-------|----------|
| **Smart Contracts** | `panic!()` on invalid state — transaction is atomic, rolls back on failure |
| **Backend** | HTTP error codes (400, 404, 500) with JSON error messages |
| **Frontend** | Toast notifications for user-facing errors, console logs for debugging |
| **Indexer** | Retry with backoff on RPC failures, skip malformed events with logging |

---

## 11. Scalability Considerations

| Concern | Current Design | Future Path |
|---------|---------------|-------------|
| **Loan Volume** | Sequential IDs in persistent storage | Pagination via backend queries |
| **Oracle Updates** | Admin-only manual updates | External oracle integration (e.g., Pyth, Band) |
| **Event Indexing** | Polling-based | WebSocket subscriptions when available |
| **Database** | Single PostgreSQL instance | Read replicas for analytics |
| **Frontend** | Client-side rendering | SSR for SEO if needed |

---

*Previous: `01_BUSINESS_RULES.md` · Next: `03_SMART_CONTRACT_ARCHITECTURE.md`*
