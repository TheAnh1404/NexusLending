# 11 - Security Rules

This document records the current security model in the contracts, backend, and frontend.

## Core Principles

| Rule | Description |
| --- | --- |
| No off-chain custody | Backend and frontend never hold private keys or user funds. |
| Contract authority | Financial state changes happen in Soroban contracts. |
| Verified backend writes | API mode database mutations require confirmed Soroban receipts. |
| Fresh oracle reads | Loan Manager uses oracle fresh getters for risk-sensitive calculations. |
| Isolated escrow | Vault locks lender funds and borrower collateral per offer/loan. |
| Checked arithmetic | Contract math uses checked operations and basis points. |

## Contract Access Control

| Contract | Function group | Required authority |
| --- | --- | --- |
| Marketplace | `create_offer`, `fund_offer`, `activate_offer`, `cancel_offer`, `expire_offer` | Lender auth and valid offer status |
| Marketplace | `accept_offer` | Borrower auth, active offer, borrower not lender |
| Loan Manager | `create_pending_loan_from_offer` | Marketplace contract only |
| Loan Manager | `activate_loan`, `add_collateral`, `partial_repay`, `full_repay` | Borrower auth |
| Loan Manager | `liquidate` | Liquidator auth plus liquidation eligibility |
| Loan Manager | `mark_expired`, `mark_defaulted`, `refresh_loan_state` | Permissionless but time/state gated |
| Vault | Lender fund lock/unlock | Marketplace contract path |
| Vault | Collateral, repayment, disbursement, liquidation transfers | Loan Manager contract path |
| Oracle | `set_price`, `set_price_for_assets` | Oracle admin auth |

All contracts prevent double initialization.

## Oracle Freshness

The current oracle has a fixed freshness window:

```text
MAX_PRICE_AGE_SECONDS = 86_400
```

The oracle exposes:

- `get_fresh_price(asset_pair)`
- `get_fresh_price_for_assets(base_asset, quote_asset)`
- `is_price_stale(asset_pair)`
- `is_price_for_assets_stale(base_asset, quote_asset)`

`LoanManager` calls `get_fresh_price_for_assets()` when calculating Health Factor/LTV and during actions that depend on price. If a price is older than 24 hours, the oracle panics with `oracle price is stale`, and the whole Soroban transaction rolls back.

Production hardening still recommended:

- Reduce the window for volatile collateral, for example 1 hour instead of 24 hours.
- Use multisig or hardware custody for the oracle admin.
- Add price deviation guards.
- Integrate decentralized oracle sources before mainnet scale.

## Backend Receipt Verification

The backend rejects API-mode mutations unless a receipt is both syntactically valid and verified against Soroban RPC.

Receipt-level validation requires:

- 64-character hex `txHash`
- Stellar Expert `explorerUrl` ending in `/tx/<txHash>`
- positive integer `ledger`
- `txStatus` or `status` equal to `SUCCESS`

Action-level verification then checks the expected contract/action/event. Backend services use verified receipts to create `Transaction` records and `IndexedEvent` rows, and they read contract state back for offers, loans, and risk metrics.

`VITE_DATA_MODE=api` must use live Soroban receipts. Mock chain receipts are intentionally ignored in API mode because the backend verifies against RPC.

## Threats And Mitigations

| Threat | Current mitigation |
| --- | --- |
| Fake transaction hash | Soroban RPC `getTransaction` verification and event matching |
| Wrong contract/event | Verification service checks contract ID and expected event/action |
| Backend DB tampering | Contracts remain source of truth; indexer can resync from events |
| Replay/double indexing | Transaction hash uniqueness plus `(txHash, eventIndex)` uniqueness |
| Unauthorized fund movement | Vault accepts fund-moving calls only through configured contracts |
| Stale oracle price | Loan Manager uses fresh oracle getter; stale price rolls back tx |
| Private key exposure | Signing happens only in Freighter/client wallet |
| Arithmetic overflow | Contract checked math panics atomically |

## Runtime Checklist

- Keep `MARKETPLACE_CONTRACT_ID`, `LOAN_MANAGER_CONTRACT_ID`, `ORACLE_CONTRACT_ID`, and `VAULT_CONTRACT_ID` aligned across backend/frontend.
- Configure `VITE_USDC_ISSUER` and/or `VITE_USDC_CONTRACT_ID` for the real USDC asset used on the selected Stellar network.
- Monitor indexer checkpoint lag and failed event count.
- Rotate/redeploy if an admin key is compromised.
- Treat PostgreSQL as a cache/audit layer, not as authority for fund movement.
