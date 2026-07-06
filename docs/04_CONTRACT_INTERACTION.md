# 04 — Contract Interaction

> Cross-contract call graph, sequence diagrams for every major flow, and authorization requirements for the Nexus Lending Protocol.

---

## 1. Purpose

This document describes how the four Nexus smart contracts interact with each other. It provides the complete cross-contract call graph, detailed sequence diagrams for every major user flow, and authorization requirements per call. For function-level API details, see `05_CONTRACT_SPECIFICATION.md`. For the escrow-specific token flow, see `06_ESCROW_AND_FUNDING_FLOW.md`.

---

## 2. Cross-Contract Call Graph

```mermaid
graph LR
    subgraph "External Callers"
        LENDER["Lender"]
        BORROWER["Borrower"]
        LIQUIDATOR["Liquidator"]
        ADMIN["Admin"]
        ANYONE["Anyone"]
    end

    subgraph "Contracts"
        MKT["Marketplace"]
        LM["Loan Manager"]
        VLT["Vault"]
        ORC["Oracle"]
    end

    LENDER -->|"create_offer<br/>cancel_offer"| MKT
    BORROWER -->|"accept_offer"| MKT
    BORROWER -->|"add_collateral<br/>partial_repay<br/>full_repay"| LM
    LIQUIDATOR -->|"liquidate"| LM
    ANYONE -->|"mark_expired<br/>mark_defaulted<br/>refresh_loan_state"| LM
    ADMIN -->|"set_price<br/>set_price_for_assets"| ORC

    MKT -->|"① deposit()"| VLT
    MKT -->|"② return_loan_asset_to_lender()"| VLT
    MKT -->|"③ create_loan_from_offer()"| LM

    LM -->|"④ get_price_for_assets()"| ORC
    LM -->|"⑤ lock_collateral()"| VLT
    LM -->|"⑥ transfer_loan_asset_to_borrower()"| VLT
    LM -->|"⑦ collect_repayment_from()"| VLT
    LM -->|"⑧ release_collateral()"| VLT
    LM -->|"⑨ transfer_collateral_to_liq()"| VLT
```

---

## 3. Authorization Matrix

| # | Cross-Contract Call | Caller | Vault Check | User Auth Required |
|---|---------------------|--------|-------------|-------------------|
| ① | `deposit()` | Marketplace | `from.require_auth()` | Lender signs |
| ② | `return_loan_asset_to_lender()` | Marketplace | `require_marketplace()` | — |
| ③ | `create_loan_from_offer()` | Marketplace | — | — (Marketplace is caller) |
| ④ | `get_price_for_assets()` | Loan Manager | — | — (view function) |
| ⑤ | `lock_collateral()` | Loan Manager | `require_loan_manager()` | Borrower signs |
| ⑥ | `transfer_loan_asset_to_borrower()` | Loan Manager | `require_loan_manager()` | — |
| ⑦ | `collect_repayment_from()` | Loan Manager | `require_loan_manager()` | Payer signs |
| ⑧ | `release_collateral()` | Loan Manager | `require_loan_manager()` | — |
| ⑨ | `transfer_collateral_to_liq()` | Loan Manager | `require_loan_manager()` | — |

---

## 4. Sequence Diagrams

### 4.1 Create Offer

**Actors:** Lender, Marketplace, Vault

```mermaid
sequenceDiagram
    actor Lender
    participant MKT as Marketplace
    participant VLT as Vault
    participant TOKEN as Loan Asset Token

    Lender->>MKT: create_offer(lender, loan_asset, amount, ...)
    Note over MKT: Validate: amount > 0,<br/>max_ltv ≤ liq_threshold,<br/>both > 0
    Note over MKT: Assign offer_id (sequential)
    Note over MKT: Default min_hf if 0
    MKT->>VLT: deposit(asset, lender, amount)
    Note over VLT: require lender.require_auth()
    VLT->>TOKEN: transfer(lender → vault, amount)
    VLT-->>MKT: (ok)
    Note over MKT: Store offer with status = Listed
    Note over MKT: Emit ("offer_new", offer_id, lender) → amount
    MKT-->>Lender: offer_id
```

### 4.2 Cancel Offer

**Actors:** Lender, Marketplace, Vault

```mermaid
sequenceDiagram
    actor Lender
    participant MKT as Marketplace
    participant VLT as Vault
    participant TOKEN as Loan Asset Token

    Lender->>MKT: cancel_offer(offer_id)
    Note over MKT: Load offer<br/>Require lender.require_auth()<br/>Require status == Listed
    MKT->>VLT: return_loan_asset_to_lender(offer_id, lender, asset, amount)
    Note over VLT: require_marketplace()
    VLT->>TOKEN: transfer(vault → lender, amount)
    VLT-->>MKT: (ok)
    Note over MKT: Set status = Cancelled<br/>Emit ("offer_can", offer_id) → amount
    MKT-->>Lender: (ok)
```

### 4.3 Accept Offer (Create Loan)

**Actors:** Borrower, Marketplace, Loan Manager, Vault, Oracle

```mermaid
sequenceDiagram
    actor Borrower
    participant MKT as Marketplace
    participant LM as Loan Manager
    participant ORC as Oracle
    participant VLT as Vault
    participant CTOK as Collateral Token
    participant LTOK as Loan Asset Token

    Borrower->>MKT: accept_offer(offer_id, borrower, collateral_amount)
    Note over MKT: Require borrower.require_auth()<br/>Require collateral > 0<br/>Require status == Listed

    MKT->>LM: create_loan_from_offer(offer, borrower, collateral_amount)
    Note over LM: Compute outstanding_debt<br/>(principal + interest)
    Note over LM: Compute due_time

    LM->>ORC: get_price_for_assets(collateral_asset, loan_asset)
    ORC-->>LM: PriceData

    Note over LM: Calculate LTV<br/>Check LTV ≤ max_ltv_bps
    Note over LM: Calculate HF<br/>Check HF ≥ min_health_factor_bps
    Note over LM: Determine initial status via status_for_hf()

    LM->>VLT: lock_collateral(loan_id, borrower, collateral_asset, collateral_amount)
    Note over VLT: require_loan_manager()<br/>borrower.require_auth()
    VLT->>CTOK: transfer(borrower → vault, collateral_amount)
    VLT-->>LM: (ok)

    LM->>VLT: transfer_loan_asset_to_borrower(loan_id, borrower, loan_asset, principal)
    Note over VLT: require_loan_manager()
    VLT->>LTOK: transfer(vault → borrower, principal)
    VLT-->>LM: (ok)

    Note over LM: Store loan<br/>Emit ("loan_new", loan_id) → outstanding_debt
    LM-->>MKT: loan_id

    Note over MKT: Set offer status = Accepted<br/>Emit ("offer_acc", offer_id, borrower) → loan_id
    MKT-->>Borrower: loan_id
```

### 4.4 Add Collateral (Borrower Rescue)

**Actors:** Borrower, Loan Manager, Vault

```mermaid
sequenceDiagram
    actor Borrower
    participant LM as Loan Manager
    participant ORC as Oracle
    participant VLT as Vault
    participant CTOK as Collateral Token

    Borrower->>LM: add_collateral(loan_id, amount)
    Note over LM: Require amount > 0<br/>Load loan<br/>require_mutable()<br/>borrower.require_auth()
    Note over LM: Increase loan.collateral_amount

    LM->>VLT: lock_collateral(loan_id, borrower, collateral_asset, amount)
    VLT->>CTOK: transfer(borrower → vault, amount)
    VLT-->>LM: (ok)

    LM->>ORC: get_price_for_assets(collateral, loan_asset)
    ORC-->>LM: PriceData
    Note over LM: Recalculate HF<br/>Update status via update_status()

    Note over LM: Store updated loan<br/>Emit ("col_add", loan_id) → amount
    LM-->>Borrower: (ok)
```

### 4.5 Partial Repayment

**Actors:** Borrower, Loan Manager, Vault

```mermaid
sequenceDiagram
    actor Borrower
    participant LM as Loan Manager
    participant ORC as Oracle
    participant VLT as Vault
    participant LTOK as Loan Asset Token

    Borrower->>LM: partial_repay(loan_id, amount)
    Note over LM: Require amount > 0<br/>Load loan<br/>require_mutable()<br/>borrower.require_auth()
    Note over LM: repay = min(amount, outstanding_debt)

    LM->>VLT: collect_repayment_from(loan_id, borrower, lender, loan_asset, repay)
    Note over VLT: require_loan_manager()<br/>borrower.require_auth()
    VLT->>LTOK: transfer(borrower → lender, repay)
    VLT-->>LM: (ok)

    Note over LM: Decrease outstanding_debt

    alt outstanding_debt == 0
        LM->>VLT: release_collateral(loan_id, borrower, collateral_asset, collateral_amount)
        VLT-->>LM: (ok)
        Note over LM: Status = Repaid
    else outstanding_debt > 0
        LM->>ORC: get_price_for_assets(...)
        ORC-->>LM: PriceData
        Note over LM: Recalculate HF<br/>Update status
    end

    Note over LM: Store loan<br/>Emit ("part_pay", loan_id) → repay
    LM-->>Borrower: (ok)
```

### 4.6 Full Repayment

**Actors:** Borrower, Loan Manager, Vault

```mermaid
sequenceDiagram
    actor Borrower
    participant LM as Loan Manager
    participant VLT as Vault
    participant LTOK as Loan Asset Token
    participant CTOK as Collateral Token

    Borrower->>LM: full_repay(loan_id)
    Note over LM: Load loan<br/>require_mutable()<br/>borrower.require_auth()
    Note over LM: repay = outstanding_debt

    alt repay > 0
        LM->>VLT: collect_repayment_from(loan_id, borrower, lender, loan_asset, repay)
        VLT->>LTOK: transfer(borrower → lender, repay)
        VLT-->>LM: (ok)
    end

    Note over LM: outstanding_debt = 0

    LM->>VLT: release_collateral(loan_id, borrower, collateral_asset, collateral_amount)
    VLT->>CTOK: transfer(vault → borrower, collateral_amount)
    VLT-->>LM: (ok)

    Note over LM: Status = Repaid<br/>Store loan<br/>Emit ("repaid", loan_id) → repay
    LM-->>Borrower: (ok)
```

### 4.7 Liquidation

**Actors:** Liquidator, Loan Manager, Vault, Oracle

```mermaid
sequenceDiagram
    actor Liquidator
    participant LM as Loan Manager
    participant ORC as Oracle
    participant VLT as Vault
    participant LTOK as Loan Asset Token
    participant CTOK as Collateral Token

    Liquidator->>LM: liquidate(loan_id, liquidator, repay_amount)
    Note over LM: Require repay > 0<br/>Load loan<br/>liquidator.require_auth()

    LM->>ORC: get_price_for_assets(collateral, loan_asset)
    ORC-->>LM: PriceData
    Note over LM: Calculate HF<br/>Check: HF < 12,000 OR status == Defaulted

    Note over LM: max_repay = debt × 50%<br/>actual_repay = min(requested, max_repay, debt)
    Note over LM: seize_collateral = repay × (1 + bonus) / price

    LM->>VLT: collect_repayment_from(loan_id, liquidator, lender, loan_asset, repay)
    Note over VLT: require_loan_manager()<br/>liquidator.require_auth()
    VLT->>LTOK: transfer(liquidator → lender, repay)
    VLT-->>LM: (ok)

    LM->>VLT: transfer_collateral_to_liq(loan_id, liquidator, collateral_asset, seize)
    VLT->>CTOK: transfer(vault → liquidator, seize)
    VLT-->>LM: (ok)

    Note over LM: Decrease outstanding_debt<br/>Decrease collateral_amount

    alt outstanding_debt == 0
        Note over LM: Status = Liquidated
        alt collateral_amount > 0
            LM->>VLT: release_collateral(remaining to borrower)
        end
    else outstanding_debt > 0
        Note over LM: Recalculate HF<br/>Update status
    end

    Note over LM: Store loan<br/>Emit ("liq", loan_id, liquidator) → repay
    LM-->>Liquidator: (ok)
```

### 4.8 Mark Expired / Defaulted

**Actors:** Anyone, Loan Manager

```mermaid
sequenceDiagram
    actor Anyone
    participant LM as Loan Manager

    Anyone->>LM: mark_expired(loan_id)
    Note over LM: Load loan<br/>Check: current_time > due_time
    Note over LM: Set status = Expired<br/>Store loan<br/>Emit ("state", loan_id) → Expired
    LM-->>Anyone: (ok)

    Note over LM: Later...

    Anyone->>LM: mark_defaulted(loan_id)
    Note over LM: Load loan<br/>Check: current_time > due_time + grace_period
    Note over LM: Set status = Defaulted<br/>Store loan<br/>Emit ("state", loan_id) → Defaulted
    LM-->>Anyone: (ok)
```

### 4.9 Refresh Loan State

**Actors:** Anyone, Loan Manager, Oracle

```mermaid
sequenceDiagram
    actor Anyone
    participant LM as Loan Manager
    participant ORC as Oracle

    Anyone->>LM: refresh_loan_state(loan_id)
    Note over LM: Load loan

    LM->>ORC: get_price_for_assets(collateral, loan_asset)
    ORC-->>LM: PriceData

    Note over LM: Check time-based status first<br/>(Defaulted > Expired > HF-based)<br/>Recalculate HF → status_for_hf()

    Note over LM: Store loan<br/>Emit ("state", loan_id) → new_status
    LM-->>Anyone: LoanStatus
```

---

## 5. Call Chain Summary

| User Action | Entry Point | Call Chain |
|-------------|-------------|------------|
| Create Offer | `Marketplace.create_offer()` | MKT → VLT.deposit() |
| Cancel Offer | `Marketplace.cancel_offer()` | MKT → VLT.return_loan_asset_to_lender() |
| Accept Offer | `Marketplace.accept_offer()` | MKT → LM.create_loan_from_offer() → ORC.get_price_for_assets() → VLT.lock_collateral() → VLT.transfer_loan_asset_to_borrower() |
| Add Collateral | `LoanManager.add_collateral()` | LM → VLT.lock_collateral() → ORC.get_price_for_assets() |
| Partial Repay | `LoanManager.partial_repay()` | LM → VLT.collect_repayment_from() → [VLT.release_collateral()] → [ORC.get_price_for_assets()] |
| Full Repay | `LoanManager.full_repay()` | LM → VLT.collect_repayment_from() → VLT.release_collateral() |
| Liquidate | `LoanManager.liquidate()` | LM → ORC.get_price_for_assets() → VLT.collect_repayment_from() → VLT.transfer_collateral_to_liq() → [VLT.release_collateral()] |
| Mark Expired | `LoanManager.mark_expired()` | LM (no cross-contract calls) |
| Mark Defaulted | `LoanManager.mark_defaulted()` | LM (no cross-contract calls) |
| Refresh State | `LoanManager.refresh_loan_state()` | LM → ORC.get_price_for_assets() |
| Set Price | `Oracle.set_price_for_assets()` | ORC (no cross-contract calls) |

---

## 6. Event Flow Summary

```
                    Marketplace Events          Loan Manager Events         Vault Events
                    ──────────────────          ───────────────────         ────────────
create_offer    →   offer_new                                               deposit
cancel_offer    →   offer_can                                               offer_ret
accept_offer    →   offer_acc                   loan_new                    locked, loan_out
add_collateral  →                               col_add                     locked
partial_repay   →                               part_pay                    repay_in [, released]
full_repay      →                               repaid                      repay_in, released
liquidate       →                               liq                         repay_in, liq_col [, released]
mark_expired    →                               state
mark_defaulted  →                               state
refresh_state   →                               state
set_price       →                                                           
                                                                            Oracle: price_upd
```

---

*Previous: `03_SMART_CONTRACT_ARCHITECTURE.md` · Next: `05_CONTRACT_SPECIFICATION.md`*
