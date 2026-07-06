# 01 — Business Rules

> Complete set of business rules, formulas, constraints, and invariants governing the Nexus Lending Protocol.

---

## 1. Purpose

This document formalizes every business rule that smart contracts, the backend, and the frontend must enforce. It serves as the authoritative reference for protocol behavior. All rules are derived from the project principles defined in `00_PROJECT_OVERVIEW.md`.

---

## 2. Protocol Principles

| # | Principle | Rule |
|---|-----------|------|
| P1 | **P2P Marketplace** | Every loan is an independent agreement between ONE lender and ONE borrower. There are no shared liquidity pools. |
| P2 | **Fixed Interest Rate** | Each loan offer specifies a fixed APR in BPS. Once the loan is created, the interest rate never changes. |
| P3 | **Independent Loan** | Every loan is a standalone on-chain record. No loan shares collateral, risk, or capital with another loan. |
| P4 | **Escrow-Based** | All assets (loan principal and collateral) are held inside the Vault smart contract. No contract or party holds tokens directly. |
| P5 | **Trustless** | No centralized approval. All logic is enforced by smart contracts. The admin role is limited to oracle price updates and contract initialization. |
| P6 | **Health Factor** | Risk is measured continuously by a Health Factor. The HF drives status transitions and liquidation eligibility. |
| P7 | **Partial Liquidation** | Liquidation is partial by default. A liquidator repays up to 50% of outstanding debt per call and receives discounted collateral. |
| P8 | **Borrower Rescue** | A borrower can add collateral or partially repay at any time before full liquidation to restore their Health Factor. |

---

## 3. Interest Calculation

### 3.1 Formula

Interest is computed once at loan creation and added to the outstanding debt:

```
outstanding_debt = principal + (principal × fixed_apr_bps × duration_days) / (365 × BPS_DENOMINATOR)
```

Where:
- `principal` = loan amount in smallest unit (i128)
- `fixed_apr_bps` = annual percentage rate in basis points (u32)
- `duration_days` = loan term in days (u32)
- `BPS_DENOMINATOR` = 10,000

### 3.2 Example

| Parameter | Value |
|-----------|-------|
| Principal | 1,000 USDC (1,000_0000000 stroops) |
| Fixed APR | 1,000 BPS (10%) |
| Duration | 30 days |

```
interest = (1,000_0000000 × 1,000 × 30) / (365 × 10,000)
         = 30,000,000_0000000 / 3,650,000
         = 8,219,178 stroops ≈ 0.8219 USDC

outstanding_debt = 1,000_0000000 + 8,219,178 = 1,008,219,178 stroops
```

### 3.3 Rules

| Rule ID | Rule |
|---------|------|
| INT-1 | Interest is fixed at loan creation. It never changes. |
| INT-2 | Interest is computed using simple interest (no compounding). |
| INT-3 | The full `outstanding_debt` (principal + interest) must be repaid for the loan to reach `Repaid` status. |
| INT-4 | Partial repayments reduce `outstanding_debt` directly. |

---

## 4. Collateral Valuation

### 4.1 Formula

Collateral value is denominated in the loan asset's unit using oracle prices:

```
collateral_value = (collateral_amount × oracle_price) / 10^decimals
```

Where:
- `collateral_amount` = borrower's locked collateral (i128)
- `oracle_price` = price of collateral asset in terms of loan asset (i128)
- `decimals` = oracle price decimals (u32)

### 4.2 Example

| Parameter | Value |
|-----------|-------|
| Collateral | 10,000 XLM (10,000_0000000 stroops) |
| Oracle Price (XLM/USDC) | 2,500,000 (0.25 USDC with 7 decimals) |
| Decimals | 7 |

```
collateral_value = (10,000_0000000 × 2,500,000) / 10^7
                 = 25,000,000_0000000,000,000 / 10,000,000
                 = 2,500_0000000 stroops = 2,500 USDC
```

---

## 5. Health Factor (HF)

### 5.1 Formula

```
HF = (collateral_value × liquidation_threshold_bps) / outstanding_debt
```

The result is expressed in BPS. An HF of 14,000 BPS means the collateral value (adjusted by the liquidation threshold) is 1.4× the outstanding debt.

### 5.2 Thresholds

| HF Range (BPS) | HF Range (Decimal) | Zone | Color | Loan Status | Action |
|-----------------|---------------------|------|-------|-------------|--------|
| ≥ 14,000 | ≥ 1.40 | **SAFE** | 🟢 Green | `Active` | No action required |
| 12,000 – 13,999 | 1.20 – 1.3999 | **WARNING** | 🟠 Orange | `Warning` | Borrower should rescue |
| < 12,000 | < 1.20 | **LIQUIDATION** | 🔴 Red | `LiquidationPlanning` | Liquidation enabled |

### 5.3 Constants (from `shared` crate)

| Constant | Value | Meaning |
|----------|-------|---------|
| `SAFE_HEALTH_FACTOR_BPS` | 14,000 | Default minimum HF at loan creation |
| `LIQUIDATION_HEALTH_FACTOR_BPS` | 12,000 | HF below which liquidation is enabled |

### 5.4 Status Determination Logic

The `status_for_hf()` function in the Loan Manager determines loan status based on HF:

```
if hf_bps >= loan.min_health_factor_bps → Active
else if hf_bps >= LIQUIDATION_HEALTH_FACTOR_BPS (12,000) → Warning
else → LiquidationPlanning
```

> Note: `min_health_factor_bps` defaults to `SAFE_HEALTH_FACTOR_BPS` (14,000) but can be customized per offer.

### 5.5 Example

| Parameter | Value |
|-----------|-------|
| Collateral Value | 2,500 USDC |
| Liquidation Threshold | 8,000 BPS (80%) |
| Outstanding Debt | 1,008 USDC |

```
HF = (2,500 × 8,000) / 1,008 = 20,000,000 / 1,008 ≈ 19,841 BPS (1.98)
```

Result: **SAFE** (19,841 ≥ 14,000)

### 5.6 Rules

| Rule ID | Rule |
|---------|------|
| HF-1 | HF is recalculated whenever collateral amount, outstanding debt, or oracle price changes. |
| HF-2 | If `outstanding_debt` ≤ 0, HF is `u32::MAX` (infinite safety). |
| HF-3 | If `collateral_value` = 0 and debt exists, HF is 0 (immediate liquidation). |
| HF-4 | HF drives loan status transitions via `status_for_hf()`. |
| HF-5 | Time-based status (`Expired`, `Defaulted`) takes precedence over HF-based status. |

---

## 6. Loan-to-Value (LTV)

### 6.1 Formula

```
LTV = (outstanding_debt × BPS_DENOMINATOR) / collateral_value
```

### 6.2 Rules

| Rule ID | Rule |
|---------|------|
| LTV-1 | LTV is checked at loan creation. If LTV > `max_ltv_bps`, the loan is rejected. |
| LTV-2 | LTV is an informational metric during the loan's lifetime. HF drives liquidation, not LTV. |
| LTV-3 | If collateral value is 0, LTV is `u32::MAX`. |

### 6.3 Relationship Between LTV and HF

LTV and HF are inversely related:

```
HF = liquidation_threshold_bps / LTV
```

Example: If `liquidation_threshold_bps` = 8,000 and LTV = 5,000 (50%):
```
HF = 8,000 / 5,000 = 1.6 (16,000 BPS) → SAFE
```

---

## 7. Liquidation Rules

### 7.1 Eligibility

A loan is eligible for liquidation when:

| Condition | Description |
|-----------|-------------|
| HF < `LIQUIDATION_HEALTH_FACTOR_BPS` (12,000) | Collateral is unsafe |
| **OR** Loan status is `Defaulted` | Borrower failed to repay after grace period |

### 7.2 Close Factor

| Constant | Value | Meaning |
|----------|-------|---------|
| `CLOSE_FACTOR_BPS` | 5,000 | Liquidator can repay up to 50% of outstanding debt per call |

```
max_repay = (outstanding_debt × CLOSE_FACTOR_BPS) / BPS_DENOMINATOR
actual_repay = min(requested_repay, max_repay, outstanding_debt)
```

### 7.3 Seize Collateral Calculation

```
repay_with_bonus = (repay_amount × (BPS_DENOMINATOR + liquidation_bonus_bps)) / BPS_DENOMINATOR
seize_collateral = (repay_with_bonus × 10^decimals) / oracle_price
```

### 7.4 Liquidation Example

| Parameter | Value |
|-----------|-------|
| Outstanding Debt | 1,000 USDC |
| Collateral | 8,000 XLM |
| XLM Price | 0.15 USDC |
| Liquidation Bonus | 500 BPS (5%) |
| Close Factor | 5,000 BPS (50%) |

```
max_repay = (1,000 × 5,000) / 10,000 = 500 USDC
repay_with_bonus = (500 × 10,500) / 10,000 = 525 USDC
seize_collateral = (525 × 10^7) / 1,500,000 = 3,500 XLM
```

The liquidator:
- Pays 500 USDC (sent directly to the lender)
- Receives 3,500 XLM (≈ 525 USDC — a 5% bonus)

After liquidation:
- Outstanding Debt: 500 USDC
- Remaining Collateral: 4,500 XLM
- New Collateral Value: 675 USDC
- New HF: (675 × 8,000) / 500 = 10,800 BPS (1.08) → still `LiquidationPlanning`

### 7.5 Rules

| Rule ID | Rule |
|---------|------|
| LIQ-1 | Any address can call `liquidate()` — no whitelist. |
| LIQ-2 | Liquidator must provide `require_auth()`. |
| LIQ-3 | Repayment is capped at `min(requested, close_factor × debt, outstanding_debt)`. |
| LIQ-4 | Seized collateral must not exceed available collateral. |
| LIQ-5 | Repayment goes directly from liquidator to lender (via Vault `collect_repayment_from`). |
| LIQ-6 | Seized collateral is transferred from Vault to liquidator. |
| LIQ-7 | If outstanding debt reaches 0 after liquidation, status becomes `Liquidated`. |
| LIQ-8 | If outstanding debt reaches 0 and collateral remains, remaining collateral is returned to borrower. |
| LIQ-9 | Multiple partial liquidations can occur on the same loan. |

---

## 8. Borrower Rescue Rules

### 8.1 Add Collateral

| Rule ID | Rule |
|---------|------|
| RSC-1 | Borrower can call `add_collateral(loan_id, amount)` at any time while the loan is mutable. |
| RSC-2 | Collateral amount must be positive. |
| RSC-3 | Added collateral is locked in the Vault via `lock_collateral`. |
| RSC-4 | Loan status is recalculated after adding collateral. |
| RSC-5 | Adding collateral can move a loan from `Warning` or `LiquidationPlanning` back to `Active`. |

### 8.2 Partial Repay

| Rule ID | Rule |
|---------|------|
| RSC-6 | Borrower can call `partial_repay(loan_id, amount)` at any time while the loan is mutable. |
| RSC-7 | Repay amount is capped at outstanding debt: `actual = min(amount, outstanding_debt)`. |
| RSC-8 | Repayment goes directly from borrower to lender (via Vault `collect_repayment_from`). |
| RSC-9 | If outstanding debt reaches 0, all collateral is released and status becomes `Repaid`. |
| RSC-10 | If outstanding debt remains, loan status is recalculated. |

### 8.3 Mutable Loan States

Rescue operations are allowed when `require_mutable()` passes:

| Status | Mutable? |
|--------|----------|
| `Active` | ✅ Yes |
| `Warning` | ✅ Yes |
| `LiquidationPlanning` | ✅ Yes |
| `Expired` | ✅ Yes |
| `Defaulted` | ✅ Yes |
| `Repaid` | ❌ No — loan is closed |
| `Liquidated` | ❌ No — loan is closed |
| `Closed` | ❌ No — loan is closed |

---

## 9. Loan Offer Rules

### 9.1 Creation Rules

| Rule ID | Rule |
|---------|------|
| OFR-1 | Only the lender can create an offer (requires `lender.require_auth()`). |
| OFR-2 | `loan_amount` must be positive (> 0). |
| OFR-3 | `max_ltv_bps` must not exceed `liquidation_threshold_bps`. |
| OFR-4 | `max_ltv_bps` and `liquidation_threshold_bps` must be positive (> 0). |
| OFR-5 | If `min_health_factor_bps` is 0, it defaults to `SAFE_HEALTH_FACTOR_BPS` (14,000). |
| OFR-6 | Upon creation, the loan asset is deposited into the Vault via `deposit()`. |
| OFR-7 | Offer status is set to `Listed`. |
| OFR-8 | Offers are assigned sequential IDs (1, 2, 3, ...). |

### 9.2 Cancellation Rules

| Rule ID | Rule |
|---------|------|
| OFR-9 | Only the lender can cancel their offer (requires `lender.require_auth()`). |
| OFR-10 | Only `Listed` offers can be cancelled. |
| OFR-11 | `Accepted` offers cannot be cancelled. |
| OFR-12 | Upon cancellation, the loan asset is returned to the lender via `return_loan_asset_to_lender()`. |

### 9.3 Acceptance Rules

| Rule ID | Rule |
|---------|------|
| OFR-13 | Only a borrower can accept an offer (requires `borrower.require_auth()`). |
| OFR-14 | Only `Listed` offers can be accepted. |
| OFR-15 | Collateral amount must be positive (> 0). |
| OFR-16 | Acceptance triggers `create_loan_from_offer()` on the Loan Manager. |
| OFR-17 | Offer status becomes `Accepted` after successful loan creation. |
| OFR-18 | Each offer can be accepted by exactly one borrower (1:1 matching). |

---

## 10. Loan Creation Rules

| Rule ID | Rule |
|---------|------|
| LN-1 | Loans are created exclusively by the Loan Manager's `create_loan_from_offer()`, called by the Marketplace. |
| LN-2 | Outstanding debt is computed at creation (principal + interest). |
| LN-3 | `due_time = start_time + (duration_days × 86,400)`. |
| LN-4 | LTV is checked at creation: if LTV > `max_ltv_bps`, the loan is rejected. |
| LN-5 | HF is checked at creation: if HF < `min_health_factor_bps`, the loan is rejected. |
| LN-6 | After validation, collateral is locked in the Vault via `lock_collateral()`. |
| LN-7 | After validation, the loan asset is transferred from the Vault to the borrower via `transfer_loan_asset_to_borrower()`. |
| LN-8 | Initial status is determined by `status_for_hf()`. |
| LN-9 | Loans are assigned sequential IDs (1, 2, 3, ...). |

---

## 11. Repayment Rules

### 11.1 Full Repayment

| Rule ID | Rule |
|---------|------|
| REP-1 | Only the borrower can call `full_repay()` (requires `borrower.require_auth()`). |
| REP-2 | The entire outstanding debt is collected from the borrower and sent to the lender. |
| REP-3 | All collateral is released back to the borrower. |
| REP-4 | Loan status becomes `Repaid`. |

### 11.2 Partial Repayment

| Rule ID | Rule |
|---------|------|
| REP-5 | Only the borrower can call `partial_repay()` (requires `borrower.require_auth()`). |
| REP-6 | Amount is capped at outstanding debt. |
| REP-7 | If outstanding debt reaches 0, loan is fully settled (collateral released, status `Repaid`). |
| REP-8 | If outstanding debt remains, HF and status are recalculated. |

---

## 12. Expiration and Default Rules

### 12.1 Expiration

| Rule ID | Rule |
|---------|------|
| EXP-1 | A loan is expired when `current_timestamp > due_time`. |
| EXP-2 | `mark_expired()` can be called by anyone after the due time. |
| EXP-3 | An expired loan is still mutable — the borrower can repay. |

### 12.2 Default

| Rule ID | Rule |
|---------|------|
| DEF-1 | `default_time = due_time + (grace_period_days × 86,400)`. |
| DEF-2 | A loan is defaulted when `current_timestamp > default_time`. |
| DEF-3 | `mark_defaulted()` can be called by anyone after the default time. |
| DEF-4 | A defaulted loan is eligible for liquidation regardless of HF. |
| DEF-5 | A defaulted loan is still mutable — the borrower can repay before full liquidation. |

### 12.3 Status Update Priority

The `update_status()` function checks conditions in this order:

```
1. If outstanding_debt == 0 → skip (already settled)
2. If current_time > default_time → Defaulted
3. If current_time > due_time → Expired
4. Else → status_for_hf() (Active / Warning / LiquidationPlanning)
```

Time-based status always takes precedence over HF-based status.

---

## 13. Oracle Rules

| Rule ID | Rule |
|---------|------|
| ORC-1 | Only the admin can set prices (requires `admin.require_auth()`). |
| ORC-2 | Prices must be positive (> 0). |
| ORC-3 | Prices are stored with configurable decimal precision. |
| ORC-4 | Prices are stored by both string key (`"XLM/USDC"`) and asset address pair. |
| ORC-5 | The Loan Manager queries prices by asset address pair via `get_price_for_assets()`. |
| ORC-6 | Each price update records the ledger timestamp as `updated_at`. |

---

## 14. Vault / Escrow Rules

| Rule ID | Rule |
|---------|------|
| VLT-1 | The Vault never makes autonomous decisions. It only executes transfers when instructed by authorized contracts. |
| VLT-2 | `deposit()` — anyone can deposit (requires `from.require_auth()`). Used by Marketplace for offer funding. |
| VLT-3 | `withdraw()` — admin only. Emergency function. |
| VLT-4 | `lock_collateral()` — Loan Manager only. Transfers collateral from borrower into Vault and records locked amount. |
| VLT-5 | `release_collateral()` — Loan Manager only. Transfers collateral from Vault back to borrower. |
| VLT-6 | `transfer_loan_asset_to_borrower()` — Loan Manager only. Sends loan asset from Vault to borrower upon loan creation. |
| VLT-7 | `collect_repayment_from()` — Loan Manager only. Transfers repayment directly from payer to lender. |
| VLT-8 | `transfer_collateral_to_liq()` — Loan Manager only. Sends seized collateral from Vault to liquidator. |
| VLT-9 | `return_loan_asset_to_lender()` — Marketplace only. Returns loan asset to lender upon offer cancellation. |
| VLT-10 | Locked collateral is tracked per `(loan_id, asset)` pair. |
| VLT-11 | Releasing or seizing collateral decreases the locked amount. If insufficient, the transaction panics. |
| VLT-12 | All amounts must be positive. |

---

## 15. Invariants

These conditions must hold true at all times:

| Invariant | Description |
|-----------|-------------|
| **INV-1** | The sum of all locked collateral for a loan never exceeds the total collateral deposited by the borrower. |
| **INV-2** | Outstanding debt is monotonically non-increasing (it never increases after creation). |
| **INV-3** | A loan's status can only move forward in the state machine — never backward, except for HF-based recovery (LiquidationPlanning → Warning → Active). |
| **INV-4** | Once a loan is `Repaid`, `Liquidated`, or `Closed`, no further state changes occur. |
| **INV-5** | An offer transitions from `Listed` to either `Accepted` or `Cancelled` — never both. |
| **INV-6** | Exactly one loan is created per accepted offer. |
| **INV-7** | No tokens exist outside the Vault during an active loan (except the loan asset already transferred to the borrower). |

---

*Previous: `00_PROJECT_OVERVIEW.md` · Next: `02_SYSTEM_ARCHITECTURE.md`*
