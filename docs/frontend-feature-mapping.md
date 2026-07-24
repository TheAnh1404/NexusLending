# Nexus Frontend Feature Mapping

## 1. Overview
This document maps every existing feature, action, and smart contract/API call from the legacy 16 pages to the consolidated 4-page structure:
1. **Marketplace** (`/app/marketplace`)
2. **My Loans** (`/app/my-loans`)
3. **Portfolio** (`/app/portfolio`)
4. **Settings** (`/app/settings`)

## 2. Feature Mapping Matrix

| Current Function | Current Location | New Page | New UI Component / Container | User Action / Trigger | Contract / API Call | Must Preserve | Implementation Status |
|---|---|---|---|---|---|---|---|
| View Offers, Search & Filter | `/app/marketplace` | **Marketplace** | `MarketplacePage`, `SearchAndFilterBar`, `OfferCard` | Search, filter by asset/duration/APR, sort | `offersApi.getOffers`, `loanOffers` state | YES | Planned |
| Create Offer | `/app/create-loan` | **Marketplace** | `CreateOfferWizardDrawer` (or Modal) | Click "Create Offer" button | `create_offer`, `fund_offer`, `activate_offer` | YES | Planned |
| View Offer Details | `/app/loans/:id` | **Marketplace** | `OfferDetailDrawer` | Click "View Details" on Offer Card | `offersApi.getOfferById` | YES | Planned |
| Borrow Loan / Accept Offer | `/app/borrow/:id` | **Marketplace** | `BorrowWizardSheet` / Drawer | Click "Borrow" on Offer Card | `accept_offer`, `activate_loan` | YES | Planned |
| Fund / Activate / Cancel Offer | `/app/lender`, `/app/loans/:id` | **Marketplace** | `OfferDetailDrawer` / User Menu | Manage own offers in Marketplace or My Loans | `fund_offer`, `activate_offer`, `cancel_offer` | YES | Planned |
| View Borrowed Positions | `/app/borrower`, `/app/my-loans` | **My Loans** | `MyLoansPage` -> `Borrowing` Tab | Toggle to Borrowing Tab | `loans` state | YES | Planned |
| View Lent Positions | `/app/lender`, `/app/my-loans` | **My Loans** | `MyLoansPage` -> `Lending` Tab | Toggle to Lending Tab | `loans` state | YES | Planned |
| Manage Loan (Repay, Add Collateral) | `/app/loans/:id` | **My Loans** | `ManageLoanDrawer` | Click "Manage" on Loan Card | `repay` (partial/full), `add_collateral` | YES | Planned |
| Liquidate Loan | `/app/liquidation`, `/app/liquidation/:id` | **My Loans** / **Marketplace** | `ManageLoanDrawer` / At Risk Filter | Click "Liquidate Position" | `partial_liquidation` | YES | Planned |
| Health Factor & Collateral Monitor | `/app/loans/:id`, `/app/dashboard` | **My Loans** | `HealthStatus`, `ManageLoanDrawer` | View status badge (Safe/Attention/At Risk) | `recalculateAllHealthFactors` | YES | Planned |
| Asset Balances & Net Position | `/app/dashboard` | **Portfolio** | `PortfolioSummary`, `AssetRow` | View portfolio metrics | `wallet` state, Stellar RPC balances | YES | Planned |
| Swap XLM/USDC Tokens | `/app/dashboard` | **Portfolio** & **Settings** | `SwapModal` | Click "Swap Assets" button | `swapStellarAssets` | YES | Planned |
| Network & Wallet Info | `/app/settings` | **Settings** | `SettingsPage` -> Connected Wallet Section | View wallet address, network indicator | `WalletContext` | YES | Planned |
| Notification Preferences | `/app/settings` | **Settings** | `SettingsPage` -> Notifications Section | Toggle alert preferences | `localStorage` | YES | Planned |
| Transaction History | `/app/transactions` | **Settings** / **Header Drawer** | `SettingsPage` -> Transaction History Tab | View recent blockchain transactions | `transactions` state, Stellar Expert links | YES | Planned |
| Oracle Monitor & Price Update | `/app/oracle` | **Settings** (Dev/Admin section) | `SettingsPage` -> Advanced / Oracle Section | View/Update asset prices | `update_oracle` | YES | Planned |
| Admin Console | `/app/admin` | **Settings** (Dev/Admin section) | `SettingsPage` -> Admin Console Modal / Tab | Perform administrative checks & simulation | Contract read/writes | YES | Planned |
