# 11 — Security Rules

> Access control matrix, threat model, vulnerability mitigations, and security best practices for the Nexus Lending Protocol.

---

## 1. Purpose

This document defines the security model for every layer of the Nexus protocol — smart contracts, backend, and frontend. It provides the access control matrix, identifies known threats, and specifies mitigations. For the contract functions referenced here, see `05_CONTRACT_SPECIFICATION.md`. For the escrow model, see `06_ESCROW_AND_FUNDING_FLOW.md`.

---

## 2. Security Principles

| # | Principle | Description |
|---|-----------|-------------|
| S1 | **Least Privilege** | Every function is restricted to the minimum necessary authorization |
| S2 | **Defense in Depth** | Multiple layers of validation (contract + backend + frontend) |
| S3 | **Atomic Transactions** | All contract calls are atomic — failure rolls back all state |
| S4 | **No Custody Off-Chain** | Backend and frontend never hold user funds or private keys |
| S5 | **Checked Arithmetic** | All math uses overflow-checked operations |
| S6 | **Explicit Authorization** | Every fund-moving operation requires `require_auth()` |

---

## 3. Smart Contract Access Control

### 3.1 Complete Authorization Matrix

| Contract | Function | Auth Required | Who |
|----------|----------|:---:|------|
| **Marketplace** | `initialize()` | — | One-time (panics on second call) |
| | `create_offer()` | ✅ | `lender.require_auth()` |
| | `cancel_offer()` | ✅ | `offer.lender.require_auth()` |
| | `accept_offer()` | ✅ | `borrower.require_auth()` |
| | `get_offer()` | — | Public (view) |
| | `get_offer_count()` | — | Public (view) |
| **Loan Manager** | `initialize()` | — | One-time |
| | `create_loan_from_offer()` | ⚙️ | Called by Marketplace (contract-to-contract) |
| | `get_loan()` | — | Public (view) |
| | `get_loan_count()` | — | Public (view) |
| | `calculate_health_factor()` | — | Public (view) |
| | `calculate_ltv()` | — | Public (view) |
| | `refresh_loan_state()` | — | Public (permissionless) |
| | `add_collateral()` | ✅ | `loan.borrower.require_auth()` |
| | `partial_repay()` | ✅ | `loan.borrower.require_auth()` |
| | `full_repay()` | ✅ | `loan.borrower.require_auth()` |
| | `liquidate()` | ✅ | `liquidator.require_auth()` |
| | `mark_expired()` | — | Public (permissionless, time-gated) |
| | `mark_defaulted()` | — | Public (permissionless, time-gated) |
| **Vault** | `initialize()` | — | One-time |
| | `deposit()` | ✅ | `from.require_auth()` |
| | `withdraw()` | ✅ | `admin.require_auth()` |
| | `lock_collateral()` | ✅✅ | `require_loan_manager()` + `borrower.require_auth()` |
| | `release_collateral()` | ✅ | `require_loan_manager()` |
| | `transfer_loan_asset_to_borrower()` | ✅ | `require_loan_manager()` |
| | `transfer_repayment_to_lender()` | ✅ | `require_loan_manager()` |
| | `collect_repayment_from()` | ✅✅ | `require_loan_manager()` + `payer.require_auth()` |
| | `transfer_collateral_to_liq()` | ✅ | `require_loan_manager()` |
| | `return_loan_asset_to_lender()` | ✅ | `require_marketplace()` |
| | `get_locked()` | — | Public (view) |
| **Oracle** | `initialize()` | — | One-time |
| | `set_price()` | ✅ | `admin.require_auth()` |
| | `set_price_for_assets()` | ✅ | `admin.require_auth()` |
| | `get_price()` | — | Public (view) |
| | `get_price_for_assets()` | — | Public (view) |
| | `get_last_updated()` | — | Public (view) |

### 3.2 Contract-Level Access Control Implementation

```rust
// Vault — Only Loan Manager can call collateral functions
fn require_loan_manager(env: &Env) -> Address {
    let trusted: Address = env.storage().instance()
        .get(&DataKey::LoanManager)
        .unwrap_or_else(|| panic!("loan manager not configured"));
    trusted.require_auth();
    trusted
}

// Vault — Only Marketplace can return loan assets on cancel
fn require_marketplace(env: &Env) -> Address {
    let trusted: Address = env.storage().instance()
        .get(&DataKey::Marketplace)
        .unwrap_or_else(|| panic!("marketplace not configured"));
    trusted.require_auth();
    trusted
}

// Oracle — Only admin can set prices
fn require_admin(env: &Env) -> Address {
    let admin: Address = env.storage().instance()
        .get(&DataKey::Admin)
        .unwrap_or_else(|| panic!("oracle not initialized"));
    admin.require_auth();
    admin
}
```

---

## 4. Threat Model

### 4.1 Smart Contract Threats

| Threat | Severity | Mitigation |
|--------|----------|------------|
| **Arithmetic Overflow** | 🔴 Critical | All math uses `checked_mul`, `checked_add`, `checked_pow`; panic on overflow |
| **Unauthorized Fund Withdrawal** | 🔴 Critical | Vault requires `require_loan_manager()` or `require_marketplace()` for every fund-moving function |
| **Re-Entrancy** | 🟠 High | Soroban's execution model prevents re-entrancy by design (no callback mechanism in cross-contract calls) |
| **Oracle Manipulation** | 🟠 High | Oracle is admin-only; admin key must be secured; see §4.5 for future mitigations |
| **Flash Loan Attack** | 🟡 Medium | Not applicable — Soroban does not support flash loans in the Stellar ecosystem |
| **Unauthorized Liquidation** | 🟡 Medium | `liquidate()` checks HF < 12,000 OR status == Defaulted before proceeding |
| **Offer Front-Running** | 🟡 Medium | Stellar's fee market and fast finality reduce front-running risk |
| **Double Initialization** | 🟡 Medium | All `initialize()` functions panic if called twice |
| **Integer Division Truncation** | 🟢 Low | Integer division rounds down; this slightly favors the protocol (conservative) |
| **Stale Prices** | 🟡 Medium | No on-chain staleness check currently; see §4.5 for recommendations |

### 4.2 Backend Threats

| Threat | Severity | Mitigation |
|--------|----------|------------|
| **Data Injection (SQL)** | 🟠 High | Prisma ORM uses parameterized queries — no raw SQL |
| **Data Tampering** | 🟡 Medium | Backend data is a cache — contracts are source of truth; tampering causes inconsistency but not fund loss |
| **API Abuse** | 🟡 Medium | Rate limiting, input validation on all endpoints |
| **CORS Bypass** | 🟡 Medium | `FRONTEND_URL` whitelist in Express CORS configuration |
| **Environment Variable Leak** | 🟠 High | `.env` files excluded from Git; secrets never logged |

### 4.3 Frontend Threats

| Threat | Severity | Mitigation |
|--------|----------|------------|
| **Phishing / Fake UI** | 🟡 Medium | Users must verify the URL; Freighter shows transaction details before signing |
| **XSS** | 🟡 Medium | React's JSX escaping prevents XSS by default; avoid `dangerouslySetInnerHTML` |
| **Private Key Exposure** | 🔴 Critical | Frontend never accesses or stores private keys — all signing is via Freighter |
| **Transaction Modification** | 🟠 High | Freighter displays transaction details for user verification before signing |

### 4.4 Oracle-Specific Threats

| Threat | Description | Current State | Recommendation |
|--------|-------------|---------------|----------------|
| **Compromised Admin Key** | Attacker sets manipulated prices | Admin-only oracle | Multi-sig admin, hardware wallet |
| **Stale Prices** | Oracle price not updated during volatility | No staleness check | Add `max_staleness_seconds` check in Loan Manager |
| **Price Manipulation** | Admin (or compromised key) sets extreme prices | Trusted admin | Future: Integrate decentralized oracle (Pyth, Band) |
| **Zero-Price Exploit** | Setting price to 0 would make collateral worthless | `price > 0` enforced | Already mitigated |

### 4.5 Oracle Security Recommendations

For production deployment, the following enhancements are recommended:

1. **Staleness Check:** Before using oracle price in HF/LTV calculation:
   ```rust
   let max_staleness = 3600; // 1 hour
   if env.ledger().timestamp() - price.updated_at > max_staleness {
       panic!("oracle price is stale");
   }
   ```

2. **Multi-Source Validation:** Compare prices from multiple sources before accepting

3. **Price Band Guards:** Reject price updates that deviate more than X% from the previous price:
   ```rust
   let max_deviation_bps = 2000; // 20%
   let deviation = abs(new_price - old_price) * BPS_DENOMINATOR / old_price;
   if deviation > max_deviation_bps {
       panic!("price deviation too large");
   }
   ```

4. **Decentralized Oracle Migration:** Replace admin-controlled oracle with Pyth or Band for production

---

## 5. Input Validation Summary

### 5.1 Contract-Level Validation

| Function | Validation | Error |
|----------|-----------|-------|
| `create_offer()` | `loan_amount > 0` | `"loan amount must be positive"` |
| `create_offer()` | `max_ltv ≤ liq_threshold` | `"max ltv exceeds liquidation threshold"` |
| `create_offer()` | `max_ltv > 0 && liq_threshold > 0` | `"risk bps must be positive"` |
| `accept_offer()` | `collateral_amount > 0` | `"collateral amount must be positive"` |
| `accept_offer()` | `offer.status == Listed` | `"offer is not listed"` |
| `create_loan_from_offer()` | `LTV ≤ max_ltv_bps` | `"collateral below max ltv"` |
| `create_loan_from_offer()` | `HF ≥ min_health_factor_bps` | `"health factor below minimum"` |
| `add_collateral()` | `amount > 0` | `"amount must be positive"` |
| `add_collateral()` | Loan is mutable | `"loan is closed"` |
| `partial_repay()` | `amount > 0` | `"amount must be positive"` |
| `liquidate()` | `HF < 12,000 OR Defaulted` | `"loan is not liquidatable"` |
| `liquidate()` | `seize ≤ collateral` | `"insufficient collateral to seize"` |
| `mark_expired()` | `now > due_time` | `"loan not expired"` |
| `mark_defaulted()` | `now > default_time` | `"loan still in grace period"` |
| All Vault functions | `amount > 0` | `"amount must be positive"` |
| `set_price()` | `price > 0` | `"price must be positive"` |

### 5.2 Backend-Level Validation

| Endpoint | Validation |
|----------|-----------|
| `POST /users` | Valid wallet address format |
| `POST /offers` | All required fields present, amounts positive, BPS in valid ranges |
| `PATCH /offers/:id/status` | Valid status transition |
| `POST /oracle/prices` | Price > 0, valid asset pair format |
| `POST /transactions` | Valid txHash format, valid transaction type |

---

## 6. Overflow Protection

All arithmetic in the Loan Manager uses checked operations:

```rust
fn checked_u128_mul(a: u128, b: u128) -> u128 {
    a.checked_mul(b)
        .unwrap_or_else(|| panic!("multiplication overflow"))
}

fn checked_i128_add(a: i128, b: i128) -> i128 {
    a.checked_add(b)
        .unwrap_or_else(|| panic!("addition overflow"))
}

fn checked_pow10(decimals: u32) -> u128 {
    10_u128.checked_pow(decimals)
        .unwrap_or_else(|| panic!("decimal scale overflow"))
}

fn checked_u128_to_i128(value: u128) -> i128 {
    if value > i128::MAX as u128 {
        panic!("i128 overflow");
    }
    value as i128
}
```

**Formulas protected:**
- `principal_with_interest()` — checked multiply and add
- `collateral_value()` — checked multiply
- `calculate_health_factor_for_loan()` — checked multiply, safe division
- `calculate_ltv_for_loan()` — checked multiply, safe division
- `calculate_seize_collateral()` — checked multiply

---

## 7. Initialization Safety

All four contracts prevent re-initialization:

```rust
pub fn initialize(env: Env, ...) {
    if env.storage().instance().has(&DataKey::Admin) {
        panic!("already initialized");
    }
    // ... set initial state
}
```

This prevents an attacker from re-initializing a contract with different admin or contract addresses.

---

## 8. Operational Security Checklist

### 8.1 Pre-Deployment

| Check | Description |
|-------|-------------|
| ☐ | All contracts compiled with `#![no_std]` |
| ☐ | All arithmetic operations use `checked_*` functions |
| ☐ | All fund-moving functions have `require_auth()` |
| ☐ | All `initialize()` functions prevent re-initialization |
| ☐ | Admin key stored securely (hardware wallet recommended) |
| ☐ | Contract addresses verified after deployment |
| ☐ | Cross-contract references verified (Vault knows LM, MKT; LM knows Oracle, Vault; MKT knows LM, Vault) |

### 8.2 Runtime

| Check | Description |
|-------|-------------|
| ☐ | Oracle prices updated at regular intervals |
| ☐ | Backend indexer running and catching up with on-chain state |
| ☐ | Database backups configured |
| ☐ | `.env` files excluded from version control |
| ☐ | API rate limiting enabled |
| ☐ | CORS restricted to frontend domain |

### 8.3 Incident Response

| Scenario | Action |
|----------|--------|
| **Compromised Admin Key** | Deploy new contracts with new admin; migrate data |
| **Oracle Manipulation** | Admin sets correct price; affected loans recalculated |
| **Backend Database Corruption** | Re-index from on-chain events (contracts are source of truth) |
| **Frontend Compromise** | Users verify transactions in Freighter; deploy fixed frontend |

---

## 9. Security Rules Summary

| Rule ID | Rule |
|---------|------|
| SEC-1 | All fund transfers require `require_auth()` from the affected party |
| SEC-2 | Vault only accepts commands from registered Loan Manager or Marketplace |
| SEC-3 | Oracle prices can only be set by the admin |
| SEC-4 | All arithmetic is overflow-checked; panic on overflow (atomic rollback) |
| SEC-5 | Contract initialization is one-time only |
| SEC-6 | Backend never stores private keys or custodies funds |
| SEC-7 | Frontend never accesses private keys; all signing via Freighter |
| SEC-8 | All status transitions are validated before execution |
| SEC-9 | Liquidation is gated by HF check or Defaulted status |
| SEC-10 | Locked collateral accounting prevents over-release |

---

*Previous: `10_FRONTEND_INTEGRATION.md` · Next: `12_DEMO_FLOW.md`*
