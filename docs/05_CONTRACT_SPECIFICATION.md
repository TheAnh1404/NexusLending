# 05 — Contract Specification

> Complete function-level API reference for all four Nexus Lending smart contracts.

---

## 1. Purpose

This document provides the exhaustive API reference for every public function across the four Nexus contracts. For each function: Rust signature, parameters table, return type, authorization requirements, error conditions, and emitted events. For architecture context, see `03_SMART_CONTRACT_ARCHITECTURE.md`. For interaction flows, see `04_CONTRACT_INTERACTION.md`.

---

## 2. Marketplace Contract

### 2.1 `initialize`

**Signature:**
```rust
pub fn initialize(env: Env, admin: Address, loan_manager_contract: Address, vault_contract: Address)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `admin` | `Address` | Protocol admin address |
| `loan_manager_contract` | `Address` | Deployed Loan Manager contract address |
| `vault_contract` | `Address` | Deployed Vault contract address |

| Property | Value |
|----------|-------|
| **Returns** | `()` |
| **Auth** | None (but panics if called twice) |
| **Errors** | `"marketplace already initialized"` — called more than once |
| **Events** | None |
| **Storage Writes** | `Admin`, `LoanManager`, `Vault`, `OfferCount = 0` |

---

### 2.2 `create_offer`

**Signature:**
```rust
pub fn create_offer(
    env: Env,
    lender: Address,
    loan_asset: Address,
    loan_amount: i128,
    fixed_apr_bps: u32,
    duration_days: u32,
    collateral_asset: Address,
    max_ltv_bps: u32,
    liquidation_threshold_bps: u32,
    liquidation_bonus_bps: u32,
    grace_period_days: u32,
    min_health_factor_bps: u32,
) -> u64
```

| Parameter | Type | Description | Validation |
|-----------|------|-------------|------------|
| `lender` | `Address` | Lender's address | `require_auth()` |
| `loan_asset` | `Address` | Loan token contract | — |
| `loan_amount` | `i128` | Amount to lend | Must be > 0 |
| `fixed_apr_bps` | `u32` | Annual interest rate (BPS) | — |
| `duration_days` | `u32` | Loan duration in days | — |
| `collateral_asset` | `Address` | Collateral token contract | — |
| `max_ltv_bps` | `u32` | Max LTV at creation (BPS) | Must be > 0, ≤ `liquidation_threshold_bps` |
| `liquidation_threshold_bps` | `u32` | HF formula parameter (BPS) | Must be > 0 |
| `liquidation_bonus_bps` | `u32` | Liquidator bonus (BPS) | — |
| `grace_period_days` | `u32` | Days after expiry before default | — |
| `min_health_factor_bps` | `u32` | Min HF at creation (BPS) | 0 → defaults to 14,000 |

| Property | Value |
|----------|-------|
| **Returns** | `u64` — the assigned `offer_id` |
| **Auth** | `lender.require_auth()` |
| **Errors** | `"loan amount must be positive"`, `"max ltv exceeds liquidation threshold"`, `"risk bps must be positive"` |
| **Events** | `("offer_new", offer_id, lender) → loan_amount` |
| **Cross-Contract** | `Vault.deposit(loan_asset, lender, loan_amount)` |

---

### 2.3 `cancel_offer`

**Signature:**
```rust
pub fn cancel_offer(env: Env, offer_id: u64)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `offer_id` | `u64` | ID of the offer to cancel |

| Property | Value |
|----------|-------|
| **Returns** | `()` |
| **Auth** | `offer.lender.require_auth()` |
| **Errors** | `"offer not found"`, `"accepted offer cannot be cancelled"`, `"offer already cancelled"` |
| **Events** | `("offer_can", offer_id) → loan_amount` |
| **Cross-Contract** | `Vault.return_loan_asset_to_lender(offer_id, lender, asset, amount)` |
| **Pre-Condition** | Offer status must be `Listed` |
| **Post-Condition** | Offer status becomes `Cancelled` |

---

### 2.4 `accept_offer`

**Signature:**
```rust
pub fn accept_offer(env: Env, offer_id: u64, borrower: Address, collateral_amount: i128) -> u64
```

| Parameter | Type | Description | Validation |
|-----------|------|-------------|------------|
| `offer_id` | `u64` | ID of the offer to accept | Must exist, must be `Listed` |
| `borrower` | `Address` | Borrower's address | `require_auth()` |
| `collateral_amount` | `i128` | Collateral to deposit | Must be > 0 |

| Property | Value |
|----------|-------|
| **Returns** | `u64` — the created `loan_id` |
| **Auth** | `borrower.require_auth()` |
| **Errors** | `"offer not found"`, `"collateral amount must be positive"`, `"offer is not listed"` |
| **Events** | `("offer_acc", offer_id, borrower) → loan_id` |
| **Cross-Contract** | `LoanManager.create_loan_from_offer(offer, borrower, collateral_amount)` |
| **Post-Condition** | Offer status becomes `Accepted` |

---

### 2.5 `get_offer`

**Signature:**
```rust
pub fn get_offer(env: Env, offer_id: u64) -> LoanOffer
```

| Property | Value |
|----------|-------|
| **Returns** | `LoanOffer` |
| **Auth** | None (view function) |
| **Errors** | `"offer not found"` |

---

### 2.6 `get_offer_count`

**Signature:**
```rust
pub fn get_offer_count(env: Env) -> u64
```

| Property | Value |
|----------|-------|
| **Returns** | `u64` — total number of offers created |
| **Auth** | None (view function) |
| **Errors** | None |

---

## 3. Loan Manager Contract

### 3.1 `initialize`

**Signature:**
```rust
pub fn initialize(env: Env, admin: Address, oracle_contract: Address, vault_contract: Address)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `admin` | `Address` | Protocol admin |
| `oracle_contract` | `Address` | Deployed Oracle contract address |
| `vault_contract` | `Address` | Deployed Vault contract address |

| Property | Value |
|----------|-------|
| **Returns** | `()` |
| **Auth** | None (but panics if called twice) |
| **Errors** | `"loan manager already initialized"` |
| **Storage Writes** | `Admin`, `Oracle`, `Vault`, `LoanCount = 0` |

---

### 3.2 `create_loan_from_offer`

**Signature:**
```rust
pub fn create_loan_from_offer(env: Env, offer: LoanOffer, borrower: Address, collateral_amount: i128) -> u64
```

| Parameter | Type | Description | Validation |
|-----------|------|-------------|------------|
| `offer` | `LoanOffer` | The accepted loan offer (passed from Marketplace) | `loan_amount > 0` |
| `borrower` | `Address` | Borrower's address | — |
| `collateral_amount` | `i128` | Collateral to lock | Must be > 0 |

| Property | Value |
|----------|-------|
| **Returns** | `u64` — assigned `loan_id` |
| **Auth** | Called by Marketplace contract (no direct user auth here) |
| **Errors** | `"amount must be positive"`, `"loan amount must be positive"`, `"collateral below max ltv"`, `"health factor below minimum"`, `"oracle price must be positive"` |
| **Events** | `("loan_new", loan_id) → outstanding_debt` |
| **Cross-Contract** | `Oracle.get_price_for_assets()`, `Vault.lock_collateral()`, `Vault.transfer_loan_asset_to_borrower()` |

**Computation:**
1. `outstanding_debt = principal + (principal × apr_bps × duration_days) / (365 × 10,000)`
2. `due_time = start_time + (duration_days × 86,400)`
3. Calculate LTV → reject if > `max_ltv_bps`
4. Calculate HF → reject if < `min_health_factor_bps`
5. Set initial status via `status_for_hf()`

---

### 3.3 `get_loan`

**Signature:**
```rust
pub fn get_loan(env: Env, loan_id: u64) -> Loan
```

| Property | Value |
|----------|-------|
| **Returns** | `Loan` |
| **Auth** | None |
| **Errors** | `"loan not found"` |

---

### 3.4 `get_loan_count`

**Signature:**
```rust
pub fn get_loan_count(env: Env) -> u64
```

| Property | Value |
|----------|-------|
| **Returns** | `u64` |
| **Auth** | None |

---

### 3.5 `calculate_health_factor`

**Signature:**
```rust
pub fn calculate_health_factor(env: Env, loan_id: u64) -> u32
```

| Property | Value |
|----------|-------|
| **Returns** | `u32` — HF in BPS |
| **Auth** | None (view) |
| **Cross-Contract** | `Oracle.get_price_for_assets()` |
| **Notes** | Returns `u32::MAX` if debt ≤ 0; returns 0 if collateral value = 0 |

---

### 3.6 `calculate_ltv`

**Signature:**
```rust
pub fn calculate_ltv(env: Env, loan_id: u64) -> u32
```

| Property | Value |
|----------|-------|
| **Returns** | `u32` — LTV in BPS |
| **Auth** | None (view) |
| **Cross-Contract** | `Oracle.get_price_for_assets()` |
| **Notes** | Returns `u32::MAX` if collateral value = 0 |

---

### 3.7 `refresh_loan_state`

**Signature:**
```rust
pub fn refresh_loan_state(env: Env, loan_id: u64) -> LoanStatus
```

| Property | Value |
|----------|-------|
| **Returns** | `LoanStatus` — the new status |
| **Auth** | None (anyone can trigger) |
| **Events** | `("state", loan_id) → LoanStatus` |
| **Cross-Contract** | `Oracle.get_price_for_assets()` |
| **Logic** | Calls `update_status()` — checks time-based then HF-based status |

---

### 3.8 `add_collateral`

**Signature:**
```rust
pub fn add_collateral(env: Env, loan_id: u64, amount: i128)
```

| Parameter | Type | Description | Validation |
|-----------|------|-------------|------------|
| `loan_id` | `u64` | Loan to add collateral to | Must exist |
| `amount` | `i128` | Collateral to add | Must be > 0 |

| Property | Value |
|----------|-------|
| **Returns** | `()` |
| **Auth** | `loan.borrower.require_auth()` |
| **Errors** | `"amount must be positive"`, `"loan not found"`, `"loan is closed"` |
| **Events** | `("col_add", loan_id) → amount` |
| **Cross-Contract** | `Vault.lock_collateral()`, `Oracle.get_price_for_assets()` (via `update_status`) |
| **Pre-Condition** | Loan must be mutable (Active, Warning, LiquidationPlanning, Expired, or Defaulted) |

---

### 3.9 `partial_repay`

**Signature:**
```rust
pub fn partial_repay(env: Env, loan_id: u64, amount: i128)
```

| Parameter | Type | Description | Validation |
|-----------|------|-------------|------------|
| `loan_id` | `u64` | Loan to repay | Must exist |
| `amount` | `i128` | Amount to repay | Must be > 0 |

| Property | Value |
|----------|-------|
| **Returns** | `()` |
| **Auth** | `loan.borrower.require_auth()` |
| **Errors** | `"amount must be positive"`, `"loan not found"`, `"loan is closed"` |
| **Events** | `("part_pay", loan_id) → repay_amount` |
| **Cross-Contract** | `Vault.collect_repayment_from()`, optionally `Vault.release_collateral()`, `Oracle.get_price_for_assets()` |
| **Notes** | If repayment zeroes debt, collateral is released and status becomes `Repaid` |

---

### 3.10 `full_repay`

**Signature:**
```rust
pub fn full_repay(env: Env, loan_id: u64)
```

| Property | Value |
|----------|-------|
| **Returns** | `()` |
| **Auth** | `loan.borrower.require_auth()` |
| **Errors** | `"loan not found"`, `"loan is closed"` |
| **Events** | `("repaid", loan_id) → repay_amount` |
| **Cross-Contract** | `Vault.collect_repayment_from()`, `Vault.release_collateral()` |
| **Post-Condition** | `outstanding_debt = 0`, `collateral_amount = 0`, `status = Repaid` |

---

### 3.11 `liquidate`

**Signature:**
```rust
pub fn liquidate(env: Env, loan_id: u64, liquidator: Address, repay_amount: i128)
```

| Parameter | Type | Description | Validation |
|-----------|------|-------------|------------|
| `loan_id` | `u64` | Loan to liquidate | Must exist |
| `liquidator` | `Address` | Liquidator's address | `require_auth()` |
| `repay_amount` | `i128` | Desired repayment | Must be > 0 |

| Property | Value |
|----------|-------|
| **Returns** | `()` |
| **Auth** | `liquidator.require_auth()` |
| **Errors** | `"amount must be positive"`, `"loan not found"`, `"loan is not liquidatable"`, `"insufficient collateral to seize"` |
| **Events** | `("liq", loan_id, liquidator) → actual_repay` |
| **Cross-Contract** | `Oracle.get_price_for_assets()`, `Vault.collect_repayment_from()`, `Vault.transfer_collateral_to_liq()`, optionally `Vault.release_collateral()` |
| **Pre-Condition** | HF < 12,000 BPS **OR** status is `Defaulted` |
| **Notes** | Actual repay = `min(requested, 50% of debt, outstanding_debt)` |

**Seize Collateral Formula:**
```
repay_with_bonus = repay × (10,000 + liquidation_bonus_bps) / 10,000
seize_collateral = repay_with_bonus × 10^decimals / oracle_price
```

---

### 3.12 `mark_expired`

**Signature:**
```rust
pub fn mark_expired(env: Env, loan_id: u64)
```

| Property | Value |
|----------|-------|
| **Returns** | `()` |
| **Auth** | None (anyone can call) |
| **Errors** | `"loan not found"`, `"loan not expired"` |
| **Events** | `("state", loan_id) → LoanStatus::Expired` |
| **Pre-Condition** | `current_timestamp > loan.due_time` |

---

### 3.13 `mark_defaulted`

**Signature:**
```rust
pub fn mark_defaulted(env: Env, loan_id: u64)
```

| Property | Value |
|----------|-------|
| **Returns** | `()` |
| **Auth** | None (anyone can call) |
| **Errors** | `"loan not found"`, `"loan still in grace period"` |
| **Events** | `("state", loan_id) → LoanStatus::Defaulted` |
| **Pre-Condition** | `current_timestamp > loan.due_time + (grace_period_days × 86,400)` |

---

## 4. Oracle Contract

### 4.1 `initialize`

**Signature:**
```rust
pub fn initialize(env: Env, admin: Address)
```

| Property | Value |
|----------|-------|
| **Returns** | `()` |
| **Auth** | None (one-time) |
| **Errors** | `"oracle already initialized"` |

---

### 4.2 `set_price`

**Signature:**
```rust
pub fn set_price(env: Env, asset_pair: String, price: i128, decimals: u32, source: String)
```

| Parameter | Type | Description | Validation |
|-----------|------|-------------|------------|
| `asset_pair` | `String` | Human-readable pair (e.g., `"XLM/USDC"`) | — |
| `price` | `i128` | Price value | Must be > 0 |
| `decimals` | `u32` | Decimal places in price | — |
| `source` | `String` | Price source identifier | — |

| Property | Value |
|----------|-------|
| **Returns** | `()` |
| **Auth** | `admin.require_auth()` |
| **Errors** | `"oracle not initialized"`, `"price must be positive"` |
| **Events** | `("price_upd", asset_pair) → price` |

---

### 4.3 `set_price_for_assets`

**Signature:**
```rust
pub fn set_price_for_assets(
    env: Env,
    base_asset: Address,
    quote_asset: Address,
    asset_pair: String,
    price: i128,
    decimals: u32,
    source: String,
)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `base_asset` | `Address` | Base asset token contract (e.g., XLM) |
| `quote_asset` | `Address` | Quote asset token contract (e.g., USDC) |
| `asset_pair` | `String` | Human-readable pair |
| `price` | `i128` | Price value (must be > 0) |
| `decimals` | `u32` | Decimal places |
| `source` | `String` | Source identifier |

| Property | Value |
|----------|-------|
| **Returns** | `()` |
| **Auth** | `admin.require_auth()` |
| **Events** | `("price_upd", base_asset, quote_asset) → price` |
| **Notes** | Stores price under both `DataKey::AssetPrice(base, quote)` and `DataKey::Price(pair)` |

---

### 4.4 `get_price`

**Signature:**
```rust
pub fn get_price(env: Env, asset_pair: String) -> PriceData
```

| Property | Value |
|----------|-------|
| **Returns** | `PriceData` |
| **Auth** | None |
| **Errors** | `"price not found"` |

---

### 4.5 `get_price_for_assets`

**Signature:**
```rust
pub fn get_price_for_assets(env: Env, base_asset: Address, quote_asset: Address) -> PriceData
```

| Property | Value |
|----------|-------|
| **Returns** | `PriceData` |
| **Auth** | None |
| **Errors** | `"asset price not found"` |
| **Notes** | This is the function used by Loan Manager for HF/LTV calculation |

---

### 4.6 `get_last_updated`

**Signature:**
```rust
pub fn get_last_updated(env: Env, asset_pair: String) -> u64
```

| Property | Value |
|----------|-------|
| **Returns** | `u64` — ledger timestamp of last update |
| **Auth** | None |

---

## 5. Vault / Escrow Contract

### 5.1 `initialize`

**Signature:**
```rust
pub fn initialize(env: Env, admin: Address, loan_manager_contract: Address, marketplace_contract: Address)
```

| Property | Value |
|----------|-------|
| **Returns** | `()` |
| **Auth** | None (one-time) |
| **Errors** | `"vault already initialized"` |
| **Storage Writes** | `Admin`, `LoanManager`, `Marketplace` |

---

### 5.2 `deposit`

**Signature:**
```rust
pub fn deposit(env: Env, asset: Address, from: Address, amount: i128)
```

| Property | Value |
|----------|-------|
| **Returns** | `()` |
| **Auth** | `from.require_auth()` |
| **Errors** | `"amount must be positive"` |
| **Events** | `("deposit", asset, from) → amount` |
| **Token Transfer** | `from → vault` |
| **Notes** | Called by Marketplace during offer creation |

---

### 5.3 `withdraw`

**Signature:**
```rust
pub fn withdraw(env: Env, asset: Address, to: Address, amount: i128)
```

| Property | Value |
|----------|-------|
| **Returns** | `()` |
| **Auth** | `admin.require_auth()` |
| **Events** | `("withdraw", asset, to) → amount` |
| **Notes** | Emergency admin function |

---

### 5.4 `lock_collateral`

**Signature:**
```rust
pub fn lock_collateral(env: Env, loan_id: u64, borrower: Address, asset: Address, amount: i128)
```

| Property | Value |
|----------|-------|
| **Returns** | `()` |
| **Auth** | `require_loan_manager()` + `borrower.require_auth()` |
| **Events** | `("locked", loan_id, borrower, asset) → amount` |
| **Token Transfer** | `borrower → vault` |
| **Storage** | Increments `Locked(loan_id, asset)` by `amount` |

---

### 5.5 `release_collateral`

**Signature:**
```rust
pub fn release_collateral(env: Env, loan_id: u64, borrower: Address, asset: Address, amount: i128)
```

| Property | Value |
|----------|-------|
| **Returns** | `()` |
| **Auth** | `require_loan_manager()` |
| **Errors** | `"insufficient locked collateral"` |
| **Events** | `("released", loan_id, borrower, asset) → amount` |
| **Token Transfer** | `vault → borrower` |
| **Storage** | Decrements `Locked(loan_id, asset)` by `amount` |

---

### 5.6 `transfer_loan_asset_to_borrower`

**Signature:**
```rust
pub fn transfer_loan_asset_to_borrower(env: Env, loan_id: u64, borrower: Address, asset: Address, amount: i128)
```

| Property | Value |
|----------|-------|
| **Returns** | `()` |
| **Auth** | `require_loan_manager()` |
| **Events** | `("loan_out", loan_id, borrower, asset) → amount` |
| **Token Transfer** | `vault → borrower` |

---

### 5.7 `transfer_repayment_to_lender`

**Signature:**
```rust
pub fn transfer_repayment_to_lender(env: Env, loan_id: u64, lender: Address, asset: Address, amount: i128)
```

| Property | Value |
|----------|-------|
| **Returns** | `()` |
| **Auth** | `require_loan_manager()` |
| **Events** | `("repay_out", loan_id, lender, asset) → amount` |
| **Token Transfer** | `vault → lender` |
| **Notes** | Not currently used by Loan Manager (uses `collect_repayment_from` instead) |

---

### 5.8 `collect_repayment_from`

**Signature:**
```rust
pub fn collect_repayment_from(env: Env, loan_id: u64, payer: Address, lender: Address, asset: Address, amount: i128)
```

| Property | Value |
|----------|-------|
| **Returns** | `()` |
| **Auth** | `require_loan_manager()` + `payer.require_auth()` |
| **Events** | `("repay_in", loan_id, payer, lender) → amount` |
| **Token Transfer** | `payer → lender` (direct, not through vault) |
| **Notes** | Used for both borrower repayment and liquidator repayment |

---

### 5.9 `transfer_collateral_to_liq`

**Signature:**
```rust
pub fn transfer_collateral_to_liq(env: Env, loan_id: u64, liquidator: Address, asset: Address, amount: i128)
```

| Property | Value |
|----------|-------|
| **Returns** | `()` |
| **Auth** | `require_loan_manager()` |
| **Events** | `("liq_col", loan_id, liquidator, asset) → amount` |
| **Token Transfer** | `vault → liquidator` |
| **Storage** | Decrements `Locked(loan_id, asset)` by `amount` |

---

### 5.10 `return_loan_asset_to_lender`

**Signature:**
```rust
pub fn return_loan_asset_to_lender(env: Env, offer_id: u64, lender: Address, asset: Address, amount: i128)
```

| Property | Value |
|----------|-------|
| **Returns** | `()` |
| **Auth** | `require_marketplace()` |
| **Events** | `("offer_ret", offer_id, lender, asset) → amount` |
| **Token Transfer** | `vault → lender` |
| **Notes** | Used exclusively during offer cancellation |

---

### 5.11 `get_locked`

**Signature:**
```rust
pub fn get_locked(env: Env, loan_id: u64, asset: Address) -> i128
```

| Property | Value |
|----------|-------|
| **Returns** | `i128` — locked collateral amount (0 if not found) |
| **Auth** | None (view function) |

---

*Previous: `04_CONTRACT_INTERACTION.md` · Next: `06_ESCROW_AND_FUNDING_FLOW.md`*
