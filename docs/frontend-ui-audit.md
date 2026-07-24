# Nexus Frontend UI & Architecture Audit

## 1. Overview
This document provides a comprehensive audit of the Nexus frontend codebase prior to UI/UX restructuring.

## 2. Existing Pages & Routes
- **`/` - LandingPage**: Public landing page with protocol overview and entry CTA.
- **`/connect` - ConnectPage**: Wallet connection entry screen (Freighter wallet setup).
- **`/app` - DashboardPage**: Overview dashboard displaying protocol analytics, active loans, risk zones, maturity calendars, and wallet activity.
- **`/app/marketplace` - MarketplacePage**: Listing of available loan offers with filtering by asset, collateral, APR, and duration.
- **`/app/create-loan` - CreateLoanPage**: Multi-step wizard to create and publish a loan offer (`create_offer`, `fund_offer`, `activate_offer`).
- **`/app/loans/:id` - LoanDetailPage**: Detailed view of a specific loan offer or active loan agreement.
- **`/app/borrow/:id` - BorrowLoanPage**: Workflow for borrowers to accept an offer and deposit collateral (`accept_offer`, `activate_loan`).
- **`/app/borrower` - BorrowerDashboardPage**: Dedicated dashboard for borrower positions, collateral health, and repayments.
- **`/app/lender` - LenderDashboardPage**: Dedicated dashboard for lender offers, funded escrows, and active loans.
- **`/app/liquidation` - LiquidationCenterPage**: Overview of loans subject to partial liquidation.
- **`/app/liquidation/:id` - LiquidationDetailPage**: Action page to perform partial liquidation (`partial_liquidation`).
- **`/app/oracle` - OracleMonitorPage**: Admin view for viewing and updating oracle asset prices (`update_oracle`).
- **`/app/my-loans` - MyLoansPage**: Table-based overview of user's active borrowing and lending positions.
- **`/app/transactions` - TransactionsPage**: Detailed transaction history and activity log with raw Soroban transaction metadata.
- **`/app/settings` - SettingsPage**: Network preferences, notification settings, and system environment info.
- **`/app/admin` - AdminPage**: Comprehensive administrator workspace for oracle triggers, system health, risk analysis, and contract address management.

## 3. Core Contexts & Services
- **`WalletContext`**: Manages Freighter Wallet connection, address state, network detection (Stellar Testnet / Mainnet), and event listeners.
- **`LendingContext`**: Manages protocol state (`offers`, `loans`, `oraclePrices`, `transactions`, `activities`, `wallet`), Soroban contract execution wrappers (`createOffer`, `fundOffer`, `activateOffer`, `cancelOffer`, `acceptOffer`, `activateLoan`, `addCollateral`, `repayLoan`, `updateOraclePrice`, `liquidateLoan`, `swapTokens`, `refreshData`).
- **`soroban/` services**: `marketplace.contract`, `loanManager.contract`, `oracle.contract`, `transaction` helpers.
- **`api/` services**: `offers.api`, `loans.api`, `oracle.api`, `transactions.api`, `analytics.api`.

## 4. Key Smart Contract Functions
1. `create_offer`: Creates a draft loan offer.
2. `fund_offer`: Funds escrow with principal.
3. `activate_offer`: Publishes offer to marketplace.
4. `cancel_offer`: Cancels an active or draft offer.
5. `accept_offer`: Borrower accepts offer & sets collateral.
6. `activate_loan`: Activates loan after collateral transfer.
7. `repay`: Repays principal + interest (partial or full).
8. `add_collateral`: Deposits additional collateral.
9. `partial_liquidation`: Liquidates at-risk loan position up to 50%.
10. `update_oracle`: Updates oracle asset prices.

## 5. UI/UX Friction Points Identified
- Too many top-level navigation items (16 distinct pages/routes causing fragmentation).
- Raw technical jargon displayed upfront (e.g. `accept_offer()`, `PendingCollateral`, raw contract IDs, exact ledger numbers).
- Offer Cards overload users with non-essential metrics (Liquidation Threshold, Max LTV, min HF, raw timestamps).
- Separate pages for creation, borrowing, liquidations, and loan details disrupt fluid user workflows.
- Analytics/charts shown on primary user paths even when data is sparse or zero.
- Table views on mobile lead to horizontal overflow and poor responsiveness.
