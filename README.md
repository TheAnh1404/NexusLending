# Nexus Lending Protocol

Collateralized P2P lending marketplace for Stellar Soroban. The repo now contains:

- `frontend/`: completed Vite React frontend.
- `contracts/`: Soroban Rust contracts for marketplace, loan manager, oracle, and vault.
- `backend/`: Express + TypeScript + Prisma indexer/API service.

## MVP Flow

1. Lender creates a fixed-rate offer and escrow-deposits loan assets into the vault.
2. Borrower accepts an offer and locks XLM collateral.
3. Loan manager creates one loan record keyed by `loan_id`; it does not deploy per-loan contracts.
4. Oracle updates XLM/USDC price.
5. Loan manager/backend calculate HF:
   - `HF >= 1.4`: `SAFE` / `ACTIVE`
   - `1.2 <= HF < 1.4`: `WARNING`
   - `HF < 1.2`: `LIQUIDATION_PLANNING`
6. Borrower can add collateral or partial repay.
7. Liquidator can partially liquidate when HF is below 1.2 or loan is defaulted.

## Contracts

Contracts are in `contracts/`:

- `marketplace`: create/cancel/accept loan offers.
- `loan-manager`: loan records, HF/LTV, repayment, rescue, liquidation, expiration/default.
- `oracle`: admin-updated price storage.
- `vault`: token custody, collateral lock/release, repayments, liquidation transfers.
- `shared`: ABI structs/enums shared by the four contracts.

Run:

```bash
cd contracts
cargo test
```

On Windows, if target file locks occur:

```powershell
$env:CARGO_INCREMENTAL='0'; cargo test --target-dir ..\.tmp\contracts-target -j 1
```

## Backend

Backend is in `backend/` and provides REST APIs:

- `GET /api/health`
- `GET /api/users/:wallet`, `POST /api/users`
- `GET /api/offers`, `GET /api/offers/:id`, `POST /api/offers`, `PATCH /api/offers/:id/status`
- `GET /api/loans`, `GET /api/loans/liquidatable`, `GET /api/loans/:id`, `POST /api/loans`, `PATCH /api/loans/:id`
- `GET /api/oracle/prices`, `POST /api/oracle/prices`, `POST /api/oracle/recalculate-health`
- `GET /api/transactions`, `POST /api/transactions`

Run:

```bash
cd backend
npm install
cp .env.example .env
npx prisma generate
npm run build
npm run dev
```

## Environment

`backend/.env.example`:

```env
DATABASE_URL=
PORT=5000
FRONTEND_URL=http://localhost:5173
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=
MARKETPLACE_CONTRACT_ID=
LOAN_MANAGER_CONTRACT_ID=
ORACLE_CONTRACT_ID=
VAULT_CONTRACT_ID=
```

## Mocked Parts

The backend does not custody funds and does not execute sensitive contract logic. Soroban transaction functions in `backend/src/modules/soroban/soroban.service.ts` are stubs returning mock `txHash` and explorer URLs. Contract event indexing is also a placeholder.

## Next Integration Steps

- Deploy Soroban contracts and set backend contract IDs.
- Replace Soroban service stubs with real transaction assembly/submission.
- Implement event polling from Stellar RPC into Prisma models.
- Wire frontend API calls to backend REST endpoints.
- Add database migrations and production deployment configuration.

