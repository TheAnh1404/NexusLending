# 12 — Demo Flow

> End-to-end walkthrough of the Nexus Lending Protocol with concrete values, covering the happy path, price crash liquidation, and borrower rescue scenarios.

---

## 1. Purpose

This document provides a complete step-by-step demo scenario that exercises every major protocol feature. It includes specific numeric values at each step so that the reader can trace balances, HF values, and state transitions exactly. For the business rules behind each calculation, see `01_BUSINESS_RULES.md`. For the state transitions, see `07_STATE_MACHINE.md`.

---

## 2. Demo Setup

### 2.1 Actors

| Actor | Wallet | Role | Starting Balances |
|-------|--------|------|-------------------|
| Alice | `GALICE...` | Lender | 50,000 USDC |
| Bob | `GBOB...` | Borrower | 100,000 XLM, 500 USDC |
| Charlie | `GCHARLIE...` | Liquidator | 10,000 USDC, 50,000 XLM |
| Admin | `GADMIN...` | Oracle Admin | — |

### 2.2 Initial Oracle Price

| Pair | Price | Decimals | Meaning |
|------|-------|----------|---------|
| XLM/USDC | 2,500,000 | 7 | 1 XLM = 0.25 USDC |

### 2.3 Constants

| Constant | Value |
|----------|-------|
| `BPS_DENOMINATOR` | 10,000 |
| `SAFE_HEALTH_FACTOR_BPS` | 14,000 |
| `LIQUIDATION_HEALTH_FACTOR_BPS` | 12,000 |
| `CLOSE_FACTOR_BPS` | 5,000 |

---

## 3. Scenario A: Happy Path (Full Repayment)

### Step 1: Alice Creates an Offer

**Action:** Alice calls `Marketplace.create_offer()`

| Parameter | Value | Human Readable |
|-----------|-------|----------------|
| `loan_asset` | USDC contract | USDC |
| `loan_amount` | 10,000,000,000 (i128) | 1,000 USDC |
| `fixed_apr_bps` | 1,000 | 10% APR |
| `duration_days` | 30 | 30 days |
| `collateral_asset` | XLM contract | XLM |
| `max_ltv_bps` | 7,500 | 75% |
| `liquidation_threshold_bps` | 8,000 | 80% |
| `liquidation_bonus_bps` | 500 | 5% |
| `grace_period_days` | 7 | 7 days |
| `min_health_factor_bps` | 0 → 14,000 | 1.4× (default) |

**Result:**
- Offer ID: `1`
- Status: `Listed`
- Alice's USDC: 50,000 → 49,000 (−1,000 deposited to Vault)
- Vault USDC: 0 → 1,000

### Step 2: Bob Accepts the Offer

**Action:** Bob calls `Marketplace.accept_offer(offer_id=1, borrower=Bob, collateral_amount=60,000,000,000)`

**Collateral:** 6,000 XLM

**Interest Calculation:**
```
interest = (1,000 × 1,000 × 30) / (365 × 10,000)
         = 30,000,000 / 3,650,000
         = 8.2191... USDC
outstanding_debt = 1,000 + 8.22 = 1,008.22 USDC
```

**LTV Check:**
```
collateral_value = 6,000 XLM × 0.25 = 1,500 USDC
LTV = (1,008.22 × 10,000) / 1,500 = 6,721 BPS (67.21%)
max_ltv = 7,500 BPS (75%)
→ 6,721 ≤ 7,500 ✅ PASS
```

**HF Check:**
```
HF = (1,500 × 8,000) / 1,008.22 = 12,000,000 / 1,008.22 = 11,901 BPS
Wait — that's below 14,000! Let's recalculate with more collateral.
```

> Bob needs more collateral. Let's use **8,000 XLM** instead.

**Revised with 8,000 XLM:**
```
collateral_value = 8,000 × 0.25 = 2,000 USDC
LTV = (1,008.22 × 10,000) / 2,000 = 5,041 BPS (50.41%) ✅
HF = (2,000 × 8,000) / 1,008.22 = 16,000,000 / 1,008.22 = 15,869 BPS (1.587×) ✅
Status = Active (15,869 ≥ 14,000)
```

**Result:**
- Loan ID: `1`
- Offer Status: `Accepted`
- Loan Status: `Active`
- Bob's XLM: 100,000 → 92,000 (−8,000 locked as collateral)
- Bob's USDC: 500 → 1,500 (+1,000 loan received)
- Vault USDC: 1,000 → 0 (transferred to Bob)
- Vault XLM: 0 → 8,000 (collateral locked)

### Step 3: Time Passes — Bob Repays

**Action (Day 25):** Bob calls `LoanManager.full_repay(loan_id=1)`

**Result:**
```
repay_amount = outstanding_debt = 1,008.22 USDC
Bob's USDC: 1,500 → 491.78 (−1,008.22 sent to Alice)
Alice's USDC: 49,000 → 50,008.22 (+1,008.22 received)
Bob's XLM: 92,000 → 100,000 (+8,000 collateral returned)
Vault XLM: 8,000 → 0
Loan Status: Repaid ■
```

**Net Result:**
| Actor | USDC Change | XLM Change |
|-------|-------------|------------|
| Alice | +8.22 (interest earned) | 0 |
| Bob | −8.22 (interest paid) | 0 |

---

## 4. Scenario B: Price Crash → Liquidation

### Step 1–2: Same as Scenario A

Alice creates offer, Bob accepts with 8,000 XLM.

**Starting State:**
- Loan ID: `1`, Status: `Active`, HF: 15,869 BPS (1.587×)
- Debt: 1,008.22 USDC, Collateral: 8,000 XLM at $0.25

### Step 3: Oracle Price Drops

**Action:** Admin updates XLM/USDC price to 0.15 USDC

```
Oracle.set_price_for_assets(XLM, USDC, "XLM/USDC", 1,500,000, 7, "admin")
```

### Step 4: Refresh Loan State

**Action:** Anyone calls `LoanManager.refresh_loan_state(loan_id=1)`

```
collateral_value = 8,000 × 0.15 = 1,200 USDC
HF = (1,200 × 8,000) / 1,008.22 = 9,600,000 / 1,008.22 = 9,521 BPS (0.952×)
Status → LiquidationPlanning (9,521 < 12,000) 🔴
```

**State Change:** `Active` → `LiquidationPlanning`

### Step 5: Charlie Liquidates

**Action:** Charlie calls `LoanManager.liquidate(loan_id=1, liquidator=Charlie, repay_amount=5,041,095,890)`

```
max_repay = 1,008.22 × 50% = 504.11 USDC
actual_repay = min(504.11, 504.11, 1,008.22) = 504.11 USDC

repay_with_bonus = 504.11 × (10,000 + 500) / 10,000 = 504.11 × 1.05 = 529.32 USDC
seize_collateral = 529.32 / 0.15 = 3,528.77 XLM
```

**Result:**
```
Charlie's USDC: 10,000 → 9,495.89 (−504.11 paid to Alice)
Alice's USDC: 49,000 → 49,504.11 (+504.11 received)
Charlie's XLM: 50,000 → 53,528.77 (+3,528.77 seized)
Vault XLM: 8,000 → 4,471.23

Loan after liquidation:
  outstanding_debt: 1,008.22 − 504.11 = 504.11 USDC
  collateral_amount: 8,000 − 3,528.77 = 4,471.23 XLM
  collateral_value: 4,471.23 × 0.15 = 670.68 USDC
  HF = (670.68 × 8,000) / 504.11 = 5,365,472 / 504.11 = 10,643 BPS (1.064×)
  Status → LiquidationPlanning (still below 12,000) 🔴
```

### Step 6: Second Liquidation

```
max_repay = 504.11 × 50% = 252.05 USDC
repay_with_bonus = 252.05 × 1.05 = 264.66 USDC
seize_collateral = 264.66 / 0.15 = 1,764.38 XLM

After second liquidation:
  outstanding_debt: 504.11 − 252.05 = 252.06 USDC
  collateral: 4,471.23 − 1,764.38 = 2,706.85 XLM
  collateral_value: 2,706.85 × 0.15 = 406.03 USDC
  HF = (406.03 × 8,000) / 252.06 = 12,883 BPS (1.288×)
  Status → Warning (12,000 ≤ 12,883 < 14,000) 🟠
```

**The loan has stabilized!** Two partial liquidations brought the HF back above the liquidation threshold.

**Charlie's Profit:**
```
Total paid: 504.11 + 252.05 = 756.16 USDC
Total seized: 3,528.77 + 1,764.38 = 5,293.15 XLM
Seized value: 5,293.15 × 0.15 = 793.97 USDC
Profit: 793.97 − 756.16 = 37.81 USDC (5% on capital deployed)
```

---

## 5. Scenario C: Borrower Rescue

### Setup

Same as Scenario B, Steps 1–4. Loan is in `LiquidationPlanning` with HF = 9,521 BPS.

### Step 5: Bob Adds Collateral

**Action:** Bob calls `LoanManager.add_collateral(loan_id=1, amount=40,000,000,000)` — adding 4,000 XLM

```
New collateral: 8,000 + 4,000 = 12,000 XLM
collateral_value = 12,000 × 0.15 = 1,800 USDC
HF = (1,800 × 8,000) / 1,008.22 = 14,400,000 / 1,008.22 = 14,284 BPS (1.428×)
Status → Active (14,284 ≥ 14,000) 🟢
```

**Result:** Bob rescued his loan by adding 4,000 XLM.

### Alternative Rescue: Partial Repay

**Action:** Bob calls `LoanManager.partial_repay(loan_id=1, amount=3,000,000,000)` — repaying 300 USDC

```
new_debt = 1,008.22 − 300 = 708.22 USDC
collateral_value = 8,000 × 0.15 = 1,200 USDC
HF = (1,200 × 8,000) / 708.22 = 9,600,000 / 708.22 = 13,556 BPS (1.356×)
Status → Warning (12,000 ≤ 13,556 < 14,000) 🟠
```

Not fully safe, but out of liquidation territory. Bob could repay more or add collateral to reach `Active`.

---

## 6. Scenario D: Expiration → Default → Liquidation

### Setup

Same as Scenario A. Loan is `Active`, due in 30 days.

### Step 3: Due Date Passes (Day 31)

**Action:** Anyone calls `LoanManager.mark_expired(loan_id=1)`

```
current_time > due_time → Expired
Status → Expired
```

Bob receives an overdue repayment notification and can still repay during the 7-day grace period.

### Step 4: Grace Period Expires (Day 38)

**Action:** Anyone calls `LoanManager.mark_defaulted(loan_id=1)`

```
current_time > due_time + (7 × 86,400) → Defaulted
Status → Defaulted
```

### Step 5: Charlie Liquidates the Defaulted Loan

**Action:** Charlie calls `LoanManager.liquidate(loan_id=1, ...)`

The loan is liquidatable because `status == Defaulted`, even if HF is still healthy.

---

## 7. Scenario E: Offer Cancellation

### Step 1: Alice Creates Offer

Same as Scenario A, Step 1. Alice deposits 1,000 USDC to Vault.

### Step 2: Alice Cancels

**Action:** Alice calls `Marketplace.cancel_offer(offer_id=1)`

**Result:**
```
Alice's USDC: 49,000 → 50,000 (+1,000 returned from Vault)
Vault USDC: 1,000 → 0
Offer Status: Cancelled ■
```

No loss, no gain. Alice gets her full deposit back.

---

## 8. State Summary Table

| Step | Offer Status | Loan Status | HF | Alice USDC | Bob USDC | Bob XLM | Vault USDC | Vault XLM |
|------|-------------|-------------|-----|------------|----------|---------|------------|-----------|
| Initial | — | — | — | 50,000 | 500 | 100,000 | 0 | 0 |
| Create Offer | Listed | — | — | 49,000 | 500 | 100,000 | 1,000 | 0 |
| Accept Offer | Accepted | Active | 15,869 | 49,000 | 1,500 | 92,000 | 0 | 8,000 |
| Price Drop | — | LP | 9,521 | 49,000 | 1,500 | 92,000 | 0 | 8,000 |
| 1st Liquidation | — | LP | 10,643 | 49,504 | 1,500 | 92,000 | 0 | 4,471 |
| 2nd Liquidation | — | Warning | 12,883 | 49,756 | 1,500 | 92,000 | 0 | 2,707 |
| Full Repay (A) | Accepted | Repaid | ∞ | 50,008 | 492 | 100,000 | 0 | 0 |

---

## 9. Demo Checklist

| # | Feature | Scenario | Verified |
|---|---------|----------|----------|
| 1 | Create Offer | A, Step 1 | ☐ |
| 2 | Accept Offer | A, Step 2 | ☐ |
| 3 | Full Repay | A, Step 3 | ☐ |
| 4 | Oracle Price Update | B, Step 3 | ☐ |
| 5 | Refresh Loan State | B, Step 4 | ☐ |
| 6 | Partial Liquidation | B, Step 5–6 | ☐ |
| 7 | Add Collateral (Rescue) | C, Step 5 | ☐ |
| 8 | Partial Repay (Rescue) | C, Alternative | ☐ |
| 9 | Mark Expired | D, Step 3 | ☐ |
| 10 | Mark Defaulted | D, Step 4 | ☐ |
| 11 | Liquidate Defaulted | D, Step 5 | ☐ |
| 12 | Cancel Offer | E, Step 2 | ☐ |

---

*Previous: `11_SECURITY_RULES.md` · Next: `13_IMPLEMENTATION_ROADMAP.md`*
