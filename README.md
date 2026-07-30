# Nexus Lending Protocol

<p align="center">
  <img src="assets/logo.png" alt="Nexus Protocol Logo" width="160" />
</p>

<p align="center">
  <strong>Secure, Decentralized Peer-to-Peer Fixed-Rate Isolated Lending Marketplace on Stellar Soroban</strong>
</p>

<p align="center">
  <a href="https://nexus-nta9.vercel.app/"><img src="https://img.shields.io/badge/Live_Demo-0727-blueviolet?style=for-the-badge&logo=vercel" alt="Live Demo" /></a>
  <a href="https://stellar.org/"><img src="https://img.shields.io/badge/Network-Stellar_Testnet-14B8A6?style=for-the-badge&logo=stellar" alt="Stellar Testnet" /></a>
  <a href="https://soroban.stellar.org/"><img src="https://img.shields.io/badge/Soroban_SDK-v25.3.1-6366F1?style=for-the-badge&logo=rust" alt="Soroban SDK" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/Frontend-React_19_+_Vite-0EA5E9?style=for-the-badge&logo=react" alt="React 19" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License" /></a>
</p>

---

## 🚀 Overview

**Nexus** is an isolated, fixed-rate peer-to-peer (P2P) lending marketplace built natively on **Stellar Soroban smart contracts**. Unlike pooled lending protocols (e.g., Aave or Compound) where all liquidity is co-mingled into a single liquidity pool subject to systemic cascade risks, Nexus enforces **isolated escrow vaults per position**.

Lenders create fixed APR offers with custom parameters (principal asset, collateral asset, APR, duration, Max LTV, liquidation threshold, and grace periods). Borrowers select offers that match their needs, lock collateral directly into Soroban escrow smart contracts, and receive principal funds instantly.

- **🌐 Live Demo (07/27 Release):** [https://nexus-nta9.vercel.app/](https://nexus-nta9.vercel.app/)
- **🚰 Testnet Faucet:** [https://nexus-nta9.vercel.app/faucet](https://nexus-nta9.vercel.app/faucet)
- **📖 Technical Documentation:** [docs/](docs/)

---

## 🌟 Demo 0727 Milestone (July 27 Testnet Release)

The **Demo 0727** release represents a fully integrated, end-to-end testnet milestone. It showcases the complete lifecycle of peer-to-peer lending backed by Soroban Rust contracts, real-time transaction verification, off-chain event indexing, and active risk monitoring.

<p align="center">
  <video src="https://raw.githubusercontent.com/TheAnh1404/NexusLending/main/frontend/src/assets/0727.mp4" controls="controls" width="100%" style="max-width: 900px; border-radius: 8px;"></video>
</p>
<p align="center">
  📹 <strong>Demo 0727 Video Walkthrough</strong> (<a href="https://raw.githubusercontent.com/TheAnh1404/NexusLending/main/frontend/src/assets/0727.mp4">Direct raw video link</a>)
</p>

<p align="center">
  <a href="https://nexus-nta9.vercel.app/">
    <img src="assets/screenshots/demo-home.png" alt="Nexus Live Demo Home Page" width="900" />
  </a>
</p>

### 🔬 Demo 0727 Walkthrough Scenarios

The Demo 0727 environment validates 6 core financial scenarios:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             DEMO 0727 LIFECYCLE FLOW                             │
├─────────────┬─────────────┬─────────────┬──────────────┬───────────┬─────────────┤
│  1. Faucet  │  2. Create  │  3. Accept  │ 4. Price     │ 5. Rescue │  6. Repay / │
│     Drip    │     Offer   │   & Escrow  │   Crash Liq. │  Position │  Settlement │
└─────────────┴─────────────┴─────────────┴──────────────┴───────────┴─────────────┘
```

1. **Testnet Token Faucet (`/faucet`)**:
   Users claim testnet `XLM` collateral and `USDC` principal tokens directly via Soroban contract execution or backend rate-limited API fallback.
2. **Lender Offer Creation (`/app/marketplace`)**:
   Alice (Lender) creates a loan offer for 1,000 USDC at 10% APR over 30 days, backed by XLM collateral (Max LTV 75%, Liquidation Threshold 80%, 5% bonus). The 1,000 USDC is transferred to the Soroban Escrow Vault.
3. **Borrower Acceptance & Escrow Disbursement**:
   Bob (Borrower) accepts the offer by locking 8,000 XLM collateral into the Escrow Vault. The Vault automatically releases 1,000 USDC principal to Bob's wallet. Initial Health Factor (HF) is established at `1.58x` (Safe).
4. **Oracle Price Crash & Partial Liquidation**:
   Admin updates the XLM/USDC price from $0.25 down to $0.15. Bob's Health Factor drops below `1.20x` (`LiquidationPlanning` state). Liquidator Charlie executes a **50% Close Factor partial liquidation**, repaying 504.11 USDC of debt and seizing 3,528.77 XLM collateral (including a 5% liquidation bonus).
5. **Borrower Rescue Mechanism**:
   Borrowers can stabilize positions in real time by invoking `add_collateral` (adding XLM) or `partial_repay` (paying down USDC principal), driving the Health Factor back above the safe threshold (`1.40x`).
6. **Full Repayment & Settlement**:
   Bob repays outstanding principal + accrued interest. The Escrow Vault returns 100% of remaining locked XLM collateral to Bob, while disbursing USDC principal and interest yield to Alice.

---

## 🖼️ Demo Screens

| 1. Landing Telemetry | 2. Wallet Connect & Roles | 3. Standalone Testnet Faucet |
| :---: | :---: | :---: |
| <img src="assets/screenshots/demo-home.png" alt="Nexus Landing Page" width="300" /> | <img src="assets/screenshots/demo-connect.png" alt="Wallet Connect Page" width="300" /> | <img src="assets/screenshots/demo-faucet.png" alt="Testnet Faucet Page" width="300" /> |

| 4. Active Marketplace | 5. Health Factor Gauge | 6. Loan Position Details |
| :---: | :---: | :---: |
| <img src="assets/screenshots/marketplace.png" alt="Lending Marketplace" width="300" /> | <img src="assets/screenshots/health-factor.png" alt="Health Factor Gauge" width="300" /> | <img src="assets/screenshots/loan-detail.png" alt="Loan Details View" width="300" /> |

---

## 💡 Why Nexus? (P2P Isolated vs. Pooled Lending)

| Feature | Nexus (Isolated P2P) | Traditional Pooled Protocols (Aave/Compound) |
| --- | --- | --- |
| **Risk Containment** | **Isolated Escrow per Position**. Bad debt in one loan cannot affect other lenders. | **Shared Liquidity Pool**. Cascade liquidations and bad debt threaten all pool participants. |
| **Interest Rate Model** | **Fixed APR**. Agreed upon upfront by lender and borrower. | **Variable Rate**. Fluctuates constantly based on pool utilization rates. |
| **Escrow Custody** | Direct Soroban Vault contracts per loan ID. | Global shared token reserve pools. |
| **Borrower Control** | Custom collateral additions, partial repayments, and rescue mechanisms. | Standard pool liquidation upon threshold breach. |
| **Chain Verification** | Cryptographic Soroban receipt verification + indexing layer. | Subgraph indexers. |

---

## 🛠️ Tech Stack

| Layer | Technologies & Tools |
| --- | --- |
| **Smart Contracts** | Rust, Soroban SDK v25.3.1, Stellar Testnet Workspace |
| **Frontend UI** | Vite 8, React 19, TypeScript, Ant Design 6, Framer Motion, Recharts, Lucide Icons |
| **Wallet & SDK** | Freighter Wallet Extension, `@stellar/stellar-sdk` v16, Soroban RPC, Horizon API |
| **Backend API** | Node.js, Express 5, TypeScript, Prisma ORM, PostgreSQL |
| **Verification & Sync** | Stellar Transaction Receipt Verifier, Soroban Event Indexer, Rate-Limited Faucet Service |
| **Deployment** | Vercel (Frontend & Serverless API Entrypoint) |

---

## 🏗️ Architecture & Data Flow

```mermaid
graph TB
    User[User Browser / Wallet] --> FE[Frontend React 19 App]
    FE --> Wallet[Freighter Wallet]
    FE --> API[Backend REST API / Express]
    FE --> RPC[Stellar Soroban RPC]
    
    API --> DB[(PostgreSQL Database)]
    API --> Verifier[Receipt Verifier]
    API --> Indexer[Event Sync Indexer]
    
    Indexer --> RPC
    Verifier --> RPC
    Wallet --> RPC

    subgraph Soroban Smart Contracts
      Marketplace[Marketplace Contract]
      LoanManager[Loan Manager Contract]
      Vault[Escrow Vault Contract]
      Oracle[Price Oracle Contract]
      Faucet[Testnet Faucet Contract]
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

* **Smart Contracts**: Authoritative source of truth for financial balances, collateral custody, state transitions, and health calculations.
* **Backend API**: Event indexer and cryptographic receipt verifier serving fast cached data and real-time dashboard analytics.
* **Frontend App**: Responsive React UI signing transactions securely through Freighter without ever touching user private keys.

---

## 📜 Smart Contracts & Testnet Deployments

The Soroban workspace consists of 5 modular smart contracts located in `contracts/`:

| Contract Name | Directory Path | Key Responsibilities |
| --- | --- | --- |
| **Marketplace** | `contracts/marketplace` | Manages offer creation, funding, listing, cancellation, expiration, and acceptance. |
| **Loan Manager** | `contracts/loan-manager` | Tracks active loans, Health Factor, LTV, interest accrual, repayment, and partial/full liquidations. |
| **Vault** | `contracts/vault` | Enforces isolated escrow custody of principal and collateral assets per position ID. |
| **Oracle** | `contracts/oracle` | Stores XLM/USDC price records with staleness security checks (`MAX_STALENESS_SECONDS`). |
| **Faucet** | `contracts/faucet` | Dispenses testnet tokens with per-address cooldowns and daily request limits. |
| **Shared** | `contracts/shared` | Core Rust data structures, status enums, and mathematical helper traits. |

### 📍 Active Stellar Testnet Contract Addresses (`deployments/testnet.json`)

| Component | Contract Address (StrKey Format) |
| --- | --- |
| **Marketplace** | `CDSGIW54X2RKDBO45MWALEVFTQSPSVBHVJHWKNXPH6I45X53O3VKSPTQ` |
| **Loan Manager** | `CAYTXKDN2234LNH2VMZJQ4WLE4QLMZRDA6GMAYB2MBRNIHNHPT4HSNGI` |
| **Vault (Escrow)** | `CD55UGC2V2W4GQCZUOJNGBCBMCDFM5W3OEKJAFUKJ36AEPWIPFKAYUKK` |
| **Oracle** | `CAJ4XISOJBHJOCLYF5722T27ZF3UZ57P7DEZ4I462CRC7X5QYQPH63DC` |
| **Faucet** | `CBG5N6EN3P2P7TW6IZ3LIDDUXT6VHNBNBTYPCHAQTREHETMM5XAXMTLL` |
| **Deployer Wallet** | `GBPRBYNTXJYTWVOP2WB62FZWHCUTCIB5SNX6KLJPIOOEH4QURLIFN3XK` |

---

## 📱 Application Routes Map

| Path | Purpose & Capabilities |
| --- | --- |
| `/` | **Landing Overview**: Telemetry, live stats, protocol features, interactive mechanics diagram. |
| `/connect` | **Wallet Connect**: Freighter connection, network validation, role selection. |
| `/faucet` | **Testnet Faucet**: Request testnet XLM/USDC with cooldown and balance indicators. |
| `/app/marketplace` | **Lending Marketplace**: Browse active offers, filter terms, create new offers, accept loans. |
| `/app/my-loans` | **Loan Manager**: View borrowing/lending positions, repay, add collateral, execute liquidations. |
| `/app/portfolio` | **Portfolio Dashboard**: Exposure graphs, asset distribution, net APY, active position drawers. |
| `/app/settings` | **Settings & Admin**: Contract configuration, custom RPC settings, oracle price update panel. |

---

## ⚡ Backend REST API Overview

The backend service runs under `/api` and provides indexed state and transaction verification:

| Module | Base Route | Key Operations |
| --- | --- | --- |
| **Health** | `/api/health` | Service uptime and database connection checks. |
| **Users** | `/api/users` | Wallet profile registration and activity log. |
| **Offers** | `/api/offers` | Filter, list, create, fund, activate, cancel, and sync chain state for offers. |
| **Loans** | `/api/loans` | Active loan tracking, repayment events, rescue actions, and liquidation logs. |
| **Analytics** | `/api/analytics/dashboard` | Protocol TVL, active volume, total interest earned, health factor distribution. |
| **Oracle** | `/api/oracle` | Price feed queries, admin price pushes, health factor recalculation triggers. |
| **Transactions** | `/api/transactions` | Blockchain activity logs, transaction status verification receipts. |
| **Faucet** | `/api/faucet` | Testnet asset eligibility check, request processing, cooldown timers. |

---

## 💻 Local Development Setup

### 📋 Prerequisites

* **Node.js**: `v20.0.0` or higher
* **npm**: `v10.0.0` or higher
* **PostgreSQL**: `v15` or higher
* **Rust**: `1.84+` with `wasm32-unknown-unknown` target
* **Stellar CLI**: Installed for contract compilation and testnet scripts
* **Freighter Wallet**: Browser extension configured for **Stellar Testnet**

### 1. Repository Setup

```bash
git clone https://github.com/NexusLending/nexus.git
cd Nexus
npm install
```

### 2. Backend Setup

```bash
cd backend
npm install

# Copy configuration
cp .env.example .env
```

Configure `backend/.env` with your PostgreSQL database URL and contract IDs:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nexus?schema=public"
PORT=5000
FRONTEND_URL="http://localhost:5173"
STELLAR_NETWORK="testnet"
STELLAR_RPC_URL="https://soroban-testnet.stellar.org:443"
MARKETPLACE_CONTRACT_ID="CDSGIW54X2RKDBO45MWALEVFTQSPSVBHVJHWKNXPH6I45X53O3VKSPTQ"
LOAN_MANAGER_CONTRACT_ID="CAYTXKDN2234LNH2VMZJQ4WLE4QLMZRDA6GMAYB2MBRNIHNHPT4HSNGI"
ORACLE_CONTRACT_ID="CAJ4XISOJBHJOCLYF5722T27ZF3UZ57P7DEZ4I462CRC7X5QYQPH63DC"
VAULT_CONTRACT_ID="CD55UGC2V2W4GQCZUOJNGBCBMCDFM5W3OEKJAFUKJ36AEPWIPFKAYUKK"
```

Initialize Prisma and launch the server:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

### 3. Frontend Setup

```bash
cd ../frontend
npm install

# Copy configuration
cp .env.example .env
```

Configure `frontend/.env`:

```env
VITE_API_URL="http://localhost:5000"
VITE_DATA_MODE="api"
VITE_CHAIN_MODE="live"
VITE_STELLAR_NETWORK="testnet"
VITE_MARKETPLACE_CONTRACT_ID="CDSGIW54X2RKDBO45MWALEVFTQSPSVBHVJHWKNXPH6I45X53O3VKSPTQ"
VITE_LOAN_MANAGER_CONTRACT_ID="CAYTXKDN2234LNH2VMZJQ4WLE4QLMZRDA6GMAYB2MBRNIHNHPT4HSNGI"
VITE_ORACLE_CONTRACT_ID="CAJ4XISOJBHJOCLYF5722T27ZF3UZ57P7DEZ4I462CRC7X5QYQPH63DC"
VITE_VAULT_CONTRACT_ID="CD55UGC2V2W4GQCZUOJNGBCBMCDFM5W3OEKJAFUKJ36AEPWIPFKAYUKK"
```

Start the Vite dev server:

```bash
npm run dev
```

Access the frontend at `http://localhost:5173`.

### 4. Smart Contract Building & Testing

```bash
cd ../contracts

# Run Rust workspace unit and integration tests
cargo test

# Build release WASM binaries for Soroban
cargo build --target wasm32-unknown-unknown --release
```

---

## 🔒 Security Architecture & Risk Safeguards

Nexus adopts a defense-in-depth security model to safeguard protocol assets:

1. **Safe Arithmetic Math**: All contract calculations utilize `i128` signed integers with explicit checked operations (`checked_add`, `checked_mul`, `checked_div`) to prevent overflow/underflow exploits.
2. **Reentrancy Immunity**: Soroban's execution engine strictly prohibits reentrant cross-contract execution stacks.
3. **Per-Position Vault Isolation**: Funds are locked in isolated escrow storage per loan ID. Logic flaws in one loan position cannot compromise other positions.
4. **Stale Oracle Defense**: Prices older than `MAX_STALENESS_SECONDS` trigger explicit invocation reverts, protecting borrowers against liquidations during oracle outages.
5. **Non-Custodial Keys**: User private keys remain completely within the Freighter browser wallet extension; the frontend never reads or exports private key material.

---

## 📚 Technical Documentation Map

Detailed technical design specs are available in the [docs/](docs/) directory:

| Document | Topic & Focus |
| --- | --- |
| [docs/00_PROJECT_OVERVIEW.md](docs/00_PROJECT_OVERVIEW.md) | Protocol identity, actors, glossary, core stack |
| [docs/01_BUSINESS_RULES.md](docs/01_BUSINESS_RULES.md) | Financial formulas, LTV math, Health Factor, close factor rules |
| [docs/02_SYSTEM_ARCHITECTURE.md](docs/02_SYSTEM_ARCHITECTURE.md) | System data flow, indexer, receipt verification |
| [docs/03_SMART_CONTRACT_ARCHITECTURE.md](docs/03_SMART_CONTRACT_ARCHITECTURE.md) | Soroban contract internals, storage models, traits |
| [docs/05_CONTRACT_SPECIFICATION.md](docs/05_CONTRACT_SPECIFICATION.md) | Public smart contract API reference & invocation signatures |
| [docs/09_BACKEND_SPEC.md](docs/09_BACKEND_SPEC.md) | Express REST API specifications & Prisma schema |
| [docs/11_SECURITY_RULES.md](docs/11_SECURITY_RULES.md) | Trust boundaries, defense mechanisms, error handling |
| [docs/12_DEMO_FLOW.md](docs/12_DEMO_FLOW.md) | Step-by-step numeric walkthrough of Demo 0727 scenarios |

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

<div align="center">
  <sub>Built with ❤️ for the <strong>Stellar Soroban Ecosystem</strong></sub>
</div>
