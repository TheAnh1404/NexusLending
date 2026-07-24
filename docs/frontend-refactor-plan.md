# Nexus Frontend Refactoring Plan

## 1. Goal & Principles
Refactor the Nexus frontend into a simple, modern, task-focused Web3 user interface with **4 main navigation pages**:
1. **Marketplace** (`/app/marketplace`)
2. **My Loans** (`/app/my-loans`)
3. **Portfolio** (`/app/portfolio`)
4. **Settings** (`/app/settings`)

### Critical Constraints
- Zero modification to business logic, smart contracts, backend APIs, response structures, contract function names, parameters, contract IDs, or Soroban services.
- Keep exact transaction signing flows (Freighter wallet signatures, multi-step contract calls).
- Zero mock data insertion.
- 3-level information hierarchy (Actionable -> Decision Support -> Technical Details / Advanced Details).
- Clean, modern Ant Design + CSS design system with HSL/curated colors, responsive desktop sidebar / topbar & mobile bottom navigation bar.

## 2. Refactoring Phases

### Phase 1: Shared Design System & UI Components
- Create re-usable shared components in `src/components/common`:
  - `AppShell` (AppHeader, DesktopNavigation, MobileBottomNavigation, WalletButton, NetworkBadge)
  - `AdvancedDetails` (Collapsible section for 3rd level technical data: contract IDs, ledger numbers, exact HF, LTV, Oracle timestamp, tx hashes)
  - `TransactionProgress` & `TransactionResult` (Shared user-friendly transaction state component with step labels, progress indicators, and expandable technical error drawer)
  - `OfferCard` & `OfferDetailDrawer` (Simplified offer cards + right drawer on desktop / full sheet on mobile)
  - `LoanCard` & `ManageLoanDrawer` (Simplified loan cards + manage drawer for repayment, adding collateral, liquidating, etc.)
  - `CreateOfferWizardDrawer` (Wizard for creating/funding/activating loan offers)
  - `BorrowWizardDrawer` (4-step visual wizard: Review -> Deposit Collateral -> Confirm -> Completed)
  - `StatusBadge` & `HealthStatus` (Friendly loan health indicators: Safe [>1.4], Attention [1.2-1.4], At Risk [<1.2])

### Phase 2: Route Restructuring & App Shell Integration
- Update `src/app/routes.tsx`:
  - Main app navigation routes under `/app`:
    - `/app` -> Redirects to `/app/marketplace`
    - `/app/marketplace` -> `MarketplacePage`
    - `/app/my-loans` -> `MyLoansPage`
    - `/app/portfolio` -> `PortfolioPage`
    - `/app/settings` -> `SettingsPage`
  - Legacy route compatibility:
    - `/app/create-loan`, `/app/borrow/:id`, `/app/loans/:id`, `/app/borrower`, `/app/lender`, `/app/liquidation`, `/app/liquidation/:id`, `/app/oracle`, `/app/transactions`, `/app/admin` redirect or load within the context of the 4 main pages via query params / state.
- Update `src/layouts/AppLayout.tsx`:
  - Desktop sidebar/header with 4 main items + WalletButton + NetworkBadge.
  - Mobile bottom navigation bar with 4 main items.

### Phase 3: Page Implementation & Flow Consolidation
1. **MarketplacePage**:
   - Header with summary stats (Available Offers, Active Loans, Average APR - if data exists).
   - Search & Filter bar (Asset, Duration, Sort by APR).
   - Offer grid with simplified `OfferCard`s.
   - Drawer integration for `OfferDetailDrawer`, `BorrowWizardDrawer`, and `CreateOfferWizardDrawer`.
2. **MyLoansPage**:
   - Two primary tabs: `Borrowing` & `Lending`.
   - Secondary filter pills: `All`, `Active`, `Pending`, `At Risk`, `Completed`, `Defaulted`, `Liquidated`.
   - Responsive card list view with friendly Health status (`Safe`, `Attention`, `At Risk`).
   - Integrated `ManageLoanDrawer` for partial/full repayment, adding collateral, withdrawing collateral (if allowed), refreshing health, and triggering liquidation.
3. **PortfolioPage**:
   - Summary cards: Net Position, Available Balance, Total Lent, Locked Collateral.
   - Asset table/cards with Wallet Balance, Available, Locked, Lent.
   - Position breakdown & quick swap trigger (`SwapModal`).
4. **SettingsPage**:
   - Structured sections:
     - Connected Wallet & Network Status
     - Notification Settings
     - Transaction History & Activity Log
     - Contract References & Developer / Admin Tools (Oracle Monitor, Admin Console, Contract Addresses)
     - Disconnect Wallet

### Phase 4: Styling, Mobile Responsiveness, and Accessibility
- Enforce clean styling in `src/index.css` using theme variables.
- Ensure all drawers adapt to full-screen drawers/sheets on mobile devices (<768px).
- Verify sticky CTAs on mobile flows.
- Verify focus states, accessibility labels, and keyboard navigation.

### Phase 5: Verification & Quality Assurance
- Test `npm run lint` and `npm run build` inside `frontend/`.
- Verify TypeScript compilation without errors.
- Confirm all contract function invocations remain untouched.
- Create final report `docs/frontend-refactor-report.md`.
