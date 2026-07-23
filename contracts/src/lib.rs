//! # Nexus Soroban Smart Contracts Workspace
//!
//! Nexus is a P2P isolated lending protocol built on the Stellar Soroban smart contract ecosystem.
//! This root crate documents and unifies the contract suite:
//!
//! - **Loan Manager Contract**: Manages loan terms, loan status state machine, health factor calculations, repayments, and liquidations.
//! - **Marketplace Contract**: Handles lender offer creation, escrow funding, matching borrowers, and offer activation.
//! - **Vault Contract**: Holds isolated collateral and principal escrows per loan agreement.
//! - **Oracle Contract**: Stores timestamped price feeds for collateral/borrow assets (XLM/USDC).
//! - **Shared Crate**: Defines protocol error codes, shared types, structs, events, and constants.

pub use nexus_contracts_shared as shared;
pub use nexus_loan_manager_contract as loan_manager;
pub use nexus_marketplace_contract as marketplace;
pub use nexus_oracle_contract as oracle;
pub use nexus_vault_contract as vault;

/// Protocol Version Identifier
pub const PROTOCOL_VERSION: &str = "1.0.0";

/// Core Contract Functions Signature Cross-Reference:
///
/// | Smart Contract  | Rust Function Name                        | Description                                      |
/// | --------------- | ----------------------------------------- | ------------------------------------------------ |
/// | Marketplace     | `create_offer(e, lender, terms)`          | Lender registers a new fixed APR loan offer      |
/// | Marketplace     | `fund_offer(e, offer_id, amount)`         | Locks principal tokens into Vault Escrow          |
/// | Marketplace     | `activate_offer(e, offer_id)`             | Marks funded offer as Active for matching        |
/// | Marketplace     | `accept_offer(e, offer_id, borrower)`     | Matches borrower and creates loan contract       |
/// | Loan Manager    | `activate_loan(e, loan_id)`               | Deposits collateral and disburses principal      |
/// | Loan Manager    | `full_repay(e, loan_id)`                  | Repays full debt and releases locked collateral  |
/// | Loan Manager    | `partial_repay(e, loan_id, amount)`       | Repays partial debt to boost Health Factor       |
/// | Loan Manager    | `liquidate(e, loan_id, repay_amount)`     | Liquidates undercollateralized loan (HF < 1.20)  |
/// | Oracle          | `set_price(e, asset, price, timestamp)`   | Updates asset oracle price feed                  |
/// | Vault           | `deposit_escrow(e, owner, asset, amount)` | Custody storage for escrowed assets              |

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_protocol_version() {
        assert_eq!(PROTOCOL_VERSION, "1.0.0");
    }
}
