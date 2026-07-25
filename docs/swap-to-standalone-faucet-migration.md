# Swap to Standalone Faucet Migration Document

## 1. Overview
As part of the Nexus Stellar Testnet architecture refinement, the **Swap / Exchange Asset** feature has been deprecated from the primary user experience and replaced with an independent, dedicated **Nexus Stellar Testnet Faucet** (`/faucet`).

The Faucet serves a single focused purpose: providing Stellar Testnet assets (XLM, USDC, Collateral Token) to developers and users for testing Nexus lending, borrowing, collateral deposit, repayment, and liquidation workflows.

---

## 2. Audit of Swap Components & References

### UI Components Updated / Removed from UX:
1. **`frontend/src/components/common/AppHeader.tsx`**:
   - Removed top Swap Assets button.
   - Added small utility link `Testnet Faucet` leading to `/faucet`.
2. **`frontend/src/components/common/AppSidebar.tsx`**:
   - Removed bottom Swap button from sidebar navigation.
3. **`frontend/src/pages/PortfolioPage.tsx`**:
   - Removed header `Swap Assets` button.
   - Replaced with `Get Test Tokens` CTA opening `/faucet`.
4. **`frontend/src/layouts/AppLayout.tsx`**:
   - Removed modal state for `SwapModal`.

### Preserved Code / Legacy Dependencies:
- **`frontend/src/components/common/SwapModal.tsx`**:
  - Maintained as legacy component file to prevent breaking unverified build dependencies, but completely hidden from app UI and navigation.
- **`frontend/src/services/soroban/transaction.ts` (`swapStellarAssets`, `quoteStellarSwap`)**:
  - Contract invocation logic preserved for SDK & test reference.
- **`frontend/src/contexts/LendingContext.tsx` (`swapTokens`)**:
  - Kept in context for backwards compatibility, not exposed via main application UI.

---

## 3. Route Redirects

- Legacy route `/swap` automatically redirects to `/faucet`.
- Any external or internal links targeting `/swap` will land on the standalone Faucet page cleanly.

---

## 4. Summary of Code Changes

| Component / File | Old Behavior | New Behavior |
|---|---|---|
| `/app/portfolio` | Showed Swap Assets button | Displays "Get Test Tokens" CTA linking to `/faucet` |
| App Header | Showed Quick Swap button | Displays subtle `Testnet Faucet` utility link |
| App Sidebar | Showed bottom Swap Assets button | Removed Swap button to keep 4 clean main nav items |
| Routing | No `/faucet` route | Standalone `/faucet` route using `FaucetLayout` |
| `/swap` | Unhandled / legacy | Redirects to `/faucet` |

---

## 5. Next Steps for Full Code Removal
Once all end-to-end integration tests are finalized, the legacy `SwapModal.tsx` and context helpers can be safely purged in future minor releases.
