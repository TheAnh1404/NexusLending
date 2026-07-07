# Nexus Frontend Information Architecture

This architecture treats lender, borrower, and liquidator as wallet actions, not login roles. A single connected wallet can create offers, accept offers, repay loans, and liquidate unhealthy loans.

## Final Route Structure

### Public Routes

| Route | Page | Purpose |
| --- | --- | --- |
| `/` | Landing | Public explanation, live protocol summary, connect CTA |
| `/connect` | Connect Wallet | Freighter connection, Testnet validation, real balances |

### App Routes

| Route | Page | Purpose |
| --- | --- | --- |
| `/app` | Dashboard | Protocol telemetry and recent confirmed transactions |
| `/app/marketplace` | Marketplace | Browse active funded offers |
| `/app/offers/create` | Create Offer | Lender create -> fund -> activate workflow |
| `/app/offers/:id` | Offer Detail | Offer terms, status, funding proof, receipts |
| `/app/offers/:id/borrow` | Borrow Flow | Borrower accept_offer -> activate_loan workflow |
| `/app/loans` | My Loans / Positions | Wallet positions across borrowing and lending |
| `/app/loans/:id` | Loan Detail | Actual loan status, actions, and receipts |
| `/app/borrower` | Borrower Dashboard | Borrower action dashboard for open loans |
| `/app/lender` | Lender Dashboard | Lender action dashboard for offers and lent loans |
| `/app/liquidation` | Liquidation Center | Liquidatable loans and opportunity list |
| `/app/liquidation/:id` | Liquidation Detail | Liquidation calculator and execution receipt |
| `/app/oracle` | Oracle Monitor | Oracle prices, admin updates, impact preview |
| `/app/transactions` | Transaction History | Confirmed receipt ledger and explorer links |
| `/app/settings` | Settings | Wallet, network, real contract registry, preferences |

### Redirects For Backward Compatibility

| Existing Route | Redirect To | Reason |
| --- | --- | --- |
| `/app/create-loan` | `/app/offers/create` | The user creates an offer, not a loan |
| `/app/borrow/:id` | `/app/offers/:id/borrow` | Borrowing starts from an offer |
| `/app/my-loans` | `/app/loans` | Shorter route and clearer position model |
| `/app/loans/:id` when `id` is an offer ID | `/app/offers/:id` | Offer and loan details must be separate |

## Pages To Keep

- Landing
- Connect Wallet
- Dashboard
- Marketplace
- Borrow Flow
- My Loans / Positions
- Loan Detail
- Borrower Dashboard
- Lender Dashboard
- Liquidation Center
- Liquidation Detail
- Oracle Monitor
- Settings

## Pages To Add

- Offer Detail: separates offer inspection from loan inspection.
- Transaction History: dedicated receipt ledger with filters and Stellar Expert links.

## Pages To Remove

- No full page needs deletion, but these UI surfaces must be removed:
  - "Claim Settled Funds" button
  - "Claim Settled Loan Escrow" modal
  - "Execute Claim Call" flow
  - Fictional contract registry entries in Settings

## Pages To Merge

- Settings transaction ledger preview should become a compact "Recent transactions" card and link to `/app/transactions`.
- Dashboard recent activity and Transaction History should share the same receipt row component.

## Pages To Rename

| Current Name | Final Name | Reason |
| --- | --- | --- |
| Create Loan Offer | Create Offer | A loan is created only after a borrower accepts an offer |
| My Loans Ledger | My Loans / Positions | A wallet can be lender and borrower; the page is a position ledger |
| Borrower Dashboard | Borrowing | Action-based, not a login role |
| Lender Portfolio | Lending | Action-based, not a login role |
| System Status | Settings | Includes wallet, network, contract registry, and preferences |

## Navigation Sidebar

Suggested grouping:

### Overview

- Dashboard - `/app`
- Marketplace - `/app/marketplace`
- Transactions - `/app/transactions`

### Lending

- Create Offer - `/app/offers/create`
- Lending - `/app/lender`

### Borrowing

- My Loans - `/app/loans`
- Borrowing - `/app/borrower`

### Risk

- Liquidation Center - `/app/liquidation`
- Oracle Monitor - `/app/oracle`

### System

- Settings - `/app/settings`

Sidebar rules:

- Do not show role selection.
- Show action nouns: Lending, Borrowing, Liquidation.
- Keep Marketplace globally accessible because any connected wallet can browse.
- Keep Oracle Monitor visible for transparency, but gate update actions to admin wallet.

## Header Structure

Header components:

- Breadcrumbs from route segments, with explicit labels for offer and loan detail pages.
- Network badge: Testnet, Public, or wrong network.
- Wallet address with copy affordance and Stellar Expert account link.
- Real XLM and USDC balances, not static mock numbers.
- Global transaction status indicator for active Soroban flow stages:
  - Preparing
  - Waiting for wallet signature
  - Submitting
  - Confirming
  - Confirmed
- Notification bell with recent confirmed transactions and warnings.
- Disconnect button.

Header rules:

- Do not show a selected user role.
- Do not hide wrong-network warnings.
- Do not show fake balances while real balance lookup is pending; show loading or unavailable state.

## User Journeys

### Connect Wallet

1. User opens `/connect`.
2. UI checks Freighter availability.
3. User connects wallet.
4. UI verifies Stellar Testnet.
5. UI loads real XLM and USDC balances.
6. User enters `/app`.

### Lend: Create And Publish Offer

1. Wallet opens `/app/offers/create`.
2. Lender enters offer terms.
3. UI validates positive amount, APR, duration, max LTV <= liquidation threshold, min HF >= 1.4.
4. Lender signs `Marketplace.create_offer`.
5. UI receives `contractOfferId`, txHash, ledger, and Stellar Expert link.
6. UI posts `POST /api/offers` only after tx success.
7. Lender signs `Marketplace.fund_offer`.
8. UI posts `POST /api/offers/:id/fund` after tx success.
9. Lender signs `Marketplace.activate_offer`.
10. UI posts `POST /api/offers/:id/activate` after tx success.
11. Offer appears in Marketplace as Active.

### Lend: Cancel Offer

1. Lender opens offer detail or lending dashboard.
2. UI allows cancel only for Draft, Funding, or Active offers owned by wallet.
3. Lender signs `Marketplace.cancel_offer`.
4. Backend persists Cancelled only after confirmed receipt.
5. If funds were locked, Vault unlocks lender funds through Marketplace.

### Borrow: Accept And Activate

1. Borrower opens Marketplace.
2. Borrower opens Active offer detail.
3. Borrower enters collateral amount.
4. UI simulates HF and LTV with current oracle price.
5. Borrower signs `Marketplace.accept_offer`.
6. UI receives `contractLoanId` and posts `POST /api/offers/:id/accept`.
7. UI stays in Borrow Flow and shows PendingCollateral.
8. Borrower signs `LoanManager.activate_loan`.
9. Backend persists activation through `POST /api/loans/:id/activate`.
10. Loan detail shows collateral lock, funds transfer, and both transaction receipts.

If step 8 fails, the user must see a resumable PendingCollateral state and an "Activate Loan" action.

### Borrower Rescue

1. Borrower sees Warning or LiquidationPlanning loan on Borrowing dashboard.
2. Borrower opens add collateral or repay action.
3. UI previews HF after action.
4. Borrower signs `LoanManager.add_collateral`, `partial_repay`, or `full_repay`.
5. Backend persists only after confirmed receipt.
6. Loan status and receipt timeline update.

### Lender Receives Repayment

1. Borrower signs `partial_repay` or `full_repay`.
2. Vault `collect_repayment_from` transfers repayment directly from borrower to lender.
3. Backend indexes repayment receipt.
4. Lender Dashboard shows repayment received with txHash and Stellar Expert link.
5. There is no claim step.

### Liquidate

1. Wallet opens Liquidation Center.
2. UI lists loans where HF < 1.2 or status is Defaulted.
3. Liquidator opens Liquidation Detail.
4. UI enforces max repay = 50% of outstanding debt.
5. Liquidator signs `LoanManager.liquidate`.
6. Vault collects repayment from liquidator to lender and sends seized collateral to liquidator.
7. UI shows receipt before navigation away.
8. Backend persists loan and transaction only after confirmed receipt.

### Admin Updates Oracle

1. Admin wallet opens Oracle Monitor.
2. UI shows current price, decimals, source, and stale status.
3. Admin enters new price.
4. Admin signs `Oracle.set_price_for_assets`.
5. Backend upserts oracle price only after confirmed receipt.
6. Backend recalculates indexed loan health.
7. UI shows affected loans and oracle tx receipt.

## Data Ownership By Layer

| Data | Source Of Truth | UI Usage |
| --- | --- | --- |
| Offer status | Marketplace contract | Display and action gates |
| Loan status | Loan Manager contract | Display and action gates |
| Locked lender funds | Vault contract | Funding proof |
| Locked collateral | Vault contract and Loan Manager loan record | Loan detail and liquidation math |
| Oracle prices | Oracle contract | HF/LTV calculations |
| txHash, ledger, explorer URL | Soroban RPC confirmed transaction | Receipt display and backend persistence |
| Indexed lists | Backend database | Fast rendering and filtering |
| Wallet balances | Horizon/Soroban token contract reads | Action affordability and wallet UI |

## Primary IA Corrections

- Split Offer Detail and Loan Detail.
- Rename Create Loan to Create Offer.
- Add Transaction History as a first-class page.
- Remove claim repayment from all navigation and actions.
- Replace role-based copy with action-based navigation.
- Expose contract IDs and receipts everywhere an on-chain action appears.
