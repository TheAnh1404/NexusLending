# Nexus Soroban Contracts

Phase 1 smart contracts for the Nexus Lending Protocol: a collateralized fixed-rate P2P lending marketplace on Stellar Soroban.

## Contract List

- `oracle`: admin-updated price feed used by Loan Manager for collateral valuation.
- `vault`: Vault / Escrow custody contract for lender funds, borrower collateral, repayments, and liquidation collateral.
- `marketplace`: offer lifecycle contract for create, fund, activate, cancel, expire, and accept offer.
- `loan-manager`: loan lifecycle, Health Factor / LTV calculation, borrower rescue, repayment, expiration/default, and liquidation.
- `shared`: ABI-only crate with shared structs, enums, and constants. It is not a deployed contract.

## Responsibilities

Oracle stores `PriceData` by string pair and asset-address pair. MVP price updates are admin-only, positive price only, integer decimals only, and timestamped from the ledger.

Vault / Escrow is a pure custodian. Marketplace can lock/unlock lender offer funds. Loan Manager can lock/release collateral, disburse loan assets, move repayments, and transfer seized collateral.

Marketplace enforces the offer state machine: `Draft -> Funding -> Active -> Matched`, with terminal `Cancelled` and `Expired`. Borrowers can accept only `Active` offers.

Loan Manager enforces the loan state machine: `PendingCollateral -> Active/Warning/LiquidationPlanning`, then repayment, expiration/default, or liquidation. Risk and liquidation logic live here; there is no separate risk engine or liquidation contract.

Offer creation defaults `min_health_factor_bps` to 14,000 and `liquidation_bonus_bps` to 500 when those inputs are passed as 0. Loan activation also floors the effective minimum Health Factor at 14,000.

## Main Functions

Oracle:

- `initialize(admin)`
- `set_price(asset_pair, price, decimals, source)`
- `set_price_for_assets(base_asset, quote_asset, asset_pair, price, decimals, source)`
- `get_price(asset_pair)`
- `get_price_for_assets(base_asset, quote_asset)`
- `get_last_updated(asset_pair)`
- `is_price_stale(asset_pair)`

Vault / Escrow:

- `initialize(admin, marketplace_contract, loan_manager_contract)`
- `lock_lender_funds(offer_id, lender, asset, amount)`
- `unlock_lender_funds(offer_id, lender, asset, amount)`
- `lock_borrower_collateral(loan_id, borrower, asset, amount)`
- `release_borrower_collateral(loan_id, borrower, asset, amount)`
- `transfer_loan_asset_to_borrower(offer_id, loan_id, borrower, asset, amount)`
- `transfer_repayment_to_lender(loan_id, lender, asset, amount)`
- `collect_repayment_from(loan_id, payer, lender, asset, amount)`
- `transfer_collateral_to_liq(loan_id, liquidator, asset, amount)`
- `get_offer_locked_amount(offer_id)`
- `get_loan_collateral_amount(loan_id)`

`transfer_collateral_to_liq` is shortened because Soroban contract function names are limited to 32 characters.

Marketplace:

- `initialize(admin, vault_contract, loan_manager_contract)`
- `create_offer(...)`
- `fund_offer(offer_id)`
- `activate_offer(offer_id)`
- `cancel_offer(offer_id)`
- `expire_offer(offer_id)`
- `accept_offer(offer_id, borrower, collateral_amount)`
- `get_offer(offer_id)`
- `get_offer_count()`

Loan Manager:

- `initialize(admin, vault_contract, oracle_contract)`
- `create_pending_loan_from_offer(offer, borrower, collateral_amount)`
- `activate_loan(loan_id)`
- `get_loan(loan_id)`
- `get_loan_count()`
- `calculate_ltv(loan_id)`
- `calculate_health_factor(loan_id)`
- `refresh_loan_state(loan_id)`
- `add_collateral(loan_id, amount)`
- `partial_repay(loan_id, amount)`
- `full_repay(loan_id)`
- `mark_expired(loan_id)`
- `mark_defaulted(loan_id)`
- `liquidate(loan_id, liquidator, repay_amount)`

## Risk Rules

- `HF >= 14000`: safe, `Active`
- `12000 <= HF < 14000`: `Warning`
- `HF < 12000`: `LiquidationPlanning`

All percentage math uses basis points and integer arithmetic.

## Running Tests

From `contracts/`:

```bash
cargo test --workspace
```

On Windows, if Cargo cannot overwrite locked target files, use a separate target dir:

```powershell
$env:CARGO_INCREMENTAL='0'; cargo test --workspace --target-dir ..\.tmp\contracts-target -j 1
```

## Current Limitations

- Oracle is MVP admin-controlled; decentralized oracle integration is a future step.
- `is_price_stale` uses a fixed 24-hour staleness window.
- Liquidation collateral transfer uses the shortened function name `transfer_collateral_to_liq` due Soroban name length limits.
- Contract deployment scripts and backend/frontend transaction assembly are not part of Phase 1.

## Next Integration Step

Wire the backend Soroban service to assemble unsigned transactions for the new Phase 1 ABI, then update the event indexer to consume the emitted contract events and mirror offer/loan state into PostgreSQL.
