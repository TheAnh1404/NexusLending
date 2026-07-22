# 13 - Implementation Roadmap

This roadmap reflects the current codebase as of 2026-07-22.

## Current State

| Area | Status | Notes |
| --- | --- | --- |
| Contracts | Implemented | `shared`, `oracle`, `vault`, `marketplace`, and `loan-manager` compile and cover the current offer/loan state machines. |
| Offer lifecycle | Implemented | `Draft -> Funding -> Active -> Matched`, plus `Cancelled` and `Expired`. |
| Loan lifecycle | Implemented | `PendingCollateral`, HF states, repayment, expiration/default, liquidation, and terminal states. |
| Oracle freshness | Implemented | Fresh getters reject prices older than 24 hours. Loan Manager uses `get_fresh_price_for_assets`. |
| Backend verification | Implemented | API mutations verify Soroban receipts and read contract state before/after updates where needed. |
| Event indexer | Implemented | Polls Soroban RPC, normalizes events, deduplicates by `(txHash, eventIndex)`, and mirrors DB state. |
| Frontend API mode | Implemented | Uses backend REST APIs, Freighter signing, Soroban transaction submission, and receipt persistence. |
| Frontend mock mode | Available | Local browser-state demo mode only. It must not be used as a backend API verification path. |
| Transaction history | Implemented | `/app/transactions` lists records and receipt links, with detail pages linking into filtered history. |

## Validation Baseline

Run from each folder:

```bash
cd contracts
cargo test --workspace

cd ../backend
npm run build
npm run test

cd ../frontend
npm run lint
npm run build
```

On Windows, contract tests may need a separate target directory:

```powershell
$env:CARGO_INCREMENTAL='0'; cargo test --workspace --target-dir ..\.tmp\contracts-target -j 1
```

## Remaining Work

| Priority | Work | Why |
| --- | --- | --- |
| P0 | End-to-end testnet smoke flow with real USDC issuer/contract config | Confirms deployed contract IDs, Horizon balances, Freighter signatures, backend verification, and UI receipts all agree. |
| P0 | Add automated frontend tests | No frontend test runner is configured yet; current validation is lint/build only. |
| P1 | Add backend/indexer operational dashboards and alerts | Needed to monitor RPC lag, failed events, and verification failures. |
| P1 | Harden oracle admin operations | Add multisig/admin runbook, price deviation guards, and shorter freshness for volatile markets. |
| P1 | Remove legacy claim-repayment enum/action if no longer used | Repayments currently transfer directly to lender; claim flows should not reappear in UI. |
| P2 | Multi-asset collateral/loan support | Current UI flow is centered on USDC loans backed by XLM collateral. |
| P2 | External audit | Required before any mainnet launch handling real value. |

## Launch Gates

Before public testnet demo:

- `frontend/.env` and `backend/.env` use the same deployed contract IDs.
- `VITE_DATA_MODE=api` and live chain mode are used for all backend-backed demos.
- `VITE_USDC_ISSUER` or `VITE_USDC_CONTRACT_ID` is configured for the real selected network asset.
- Admin oracle wallet is controlled and documented.
- Indexer checkpoint advances and no recent failed events remain unresolved.

Before mainnet:

- External audit completed or explicitly accepted as a risk.
- Oracle source and admin custody hardened.
- Incident response and redeployment procedure documented.
- Real monitoring is active for RPC health, backend errors, indexer lag, and failed verification attempts.
