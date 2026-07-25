# Standalone Nexus Stellar Testnet Faucet Implementation Document

## 1. Overview
The **Nexus Stellar Testnet Faucet** has been implemented as a standalone, independent utility at route `/faucet` with a dedicated `FaucetLayout`.

The Faucet is designed specifically to provide developers and testnet users with free Stellar Testnet assets (XLM, USDC, Collateral Token) to test Nexus peer-to-peer lending, borrowing, collateral deposit, repayment, and liquidation operations.

---

## 2. Navigation Architecture & Route Isolation
- The core Nexus Lending application preserves its 4 main pages:
  - `Marketplace` (`/app/marketplace`)
  - `My Loans` (`/app/my-loans`)
  - `Portfolio` (`/app/portfolio`)
  - `Settings` (`/app/settings`)
- **Faucet is NOT added** to the application sidebar or bottom navigation.
- **Route `/faucet`** uses `FaucetLayout` (standalone header, clean background, logo, testnet badge, and `Back to Nexus` button).
- Legacy route `/swap` automatically redirects to `/faucet`.

---

## 3. Access Points
Users can access the Faucet from:
1. **Application Header**: A small utility link `Testnet Faucet` on `AppHeader` (and in wallet dropdown menu).
2. **Portfolio Page**: A `Get Test Tokens` CTA button in the header and empty portfolio state.
3. **Insufficient Balance Alerts**:
   - Offer Creation / Funding: `You need more test USDC to fund this offer. [Open Faucet]`
   - Borrow / Loan Activation: `You need more test collateral to activate this loan. [Open Faucet]`
   - Loan Repayment: `Your test USDC balance is insufficient. [Open Faucet]`
4. **Direct URL**: Navigating to `/faucet` or `/faucet?asset=USDC&returnTo=/app/marketplace`.

---

## 4. Faucet Page Structure (Solana Faucet Inspired UX)
The standalone page is composed of 6 clean, centered areas:
1. **Minimal Header** (`FaucetHeader`): Logo, `NEXUS FAUCET` title, `Stellar Testnet` badge, and `Back to Nexus` link.
2. **Hero Introduction** (`FaucetHero`): Title, usage summary, and clear Testnet monetary warning banner.
3. **Faucet Request Card** (`FaucetRequestCard`):
   - **Connected Wallet Control** (`ConnectedWalletControl`): One-click Freighter connect to auto-fill public key.
   - **Address Input** (`WalletAddressInput`): Validates Stellar `G...` public keys. Includes anti-leak protection: if a secret key (`S...`) is pasted, an error is shown and the input is immediately cleared without logging or transmitting.
   - **Asset Selector** (`FaucetAssetSelector`): Segmented control for XLM, USDC, and Collateral Token.
   - **Usage Limit Info** (`FaucetUsageLimit`): Displays claim limit and remaining cooldown timer.
   - **Primary Action Button** (`FaucetRequestButton`): Single main CTA with dynamic state (`Connect Wallet`, `Enter Address`, `Request Test USDC`, `Requesting...`, `Available Again Later`).
4. **Request Status** (`FaucetRequestProgress`): Step-by-step progress tracking (`validating`, `request_accepted`, `submitting`, `confirming`).
5. **Success State** (`FaucetSuccessResult`): Shows token amount, updated balance, Explorer transaction hash, and `Return to Nexus` CTA.
6. **Error State** (`FaucetErrorResult`): Friendly message + `Technical Details` accordion displaying error code, raw contract error, request ID, and RPC status.

---

## 5. Backend Architecture & API Endpoints

### Configuration Allowlist (`faucetAssets`)
Centralized asset configuration in `backend/src/modules/faucet/faucet.config.ts`:
- **XLM**: 100 XLM per request, 12h cooldown, used for network transaction fees.
- **USDC**: 1,000 USDC per request, 12h cooldown, used for lending principal & repayments.
- **COLLATERAL**: 500 Collateral tokens per request, 12h cooldown, used for loan collateral deposit.

### REST Endpoints
- `GET /api/faucet/config`: Returns supported testnet assets and limits.
- `GET /api/faucet/eligibility`: Checks whether a wallet address can request an asset or is under cooldown.
- `POST /api/faucet/request`: Submits token funding request with idempotency key.

### Funding Mechanism
- **Native XLM**: Funded via Stellar Testnet Friendbot API (`https://friendbot.stellar.org`).
- **Custom Tokens (USDC / Collateral)**: Processed via backend distribution account service.

### Signer Security
- Private keys and Faucet Signer secrets are stored strictly in backend server environment variables.
- Secret keys are **never** exposed in frontend builds, local storage, public variables, or API responses.

---

## 6. Components Created & Modified

### Created Files:
- `docs/swap-to-standalone-faucet-migration.md`
- `docs/standalone-testnet-faucet-implementation.md`
- `backend/src/modules/faucet/faucet.config.ts`
- `backend/src/modules/faucet/faucet.service.ts`
- `backend/src/modules/faucet/faucet.controller.ts`
- `backend/src/modules/faucet/faucet.routes.ts`
- `frontend/src/services/faucet/faucetConfig.ts`
- `frontend/src/services/faucet/faucetService.ts`
- `frontend/src/layouts/FaucetLayout.tsx`
- `frontend/src/pages/FaucetPage.tsx`
- `frontend/src/components/faucet/FaucetHeader.tsx`
- `frontend/src/components/faucet/FaucetHero.tsx`
- `frontend/src/components/faucet/FaucetRequestCard.tsx`
- `frontend/src/components/faucet/WalletAddressInput.tsx`
- `frontend/src/components/faucet/ConnectedWalletControl.tsx`
- `frontend/src/components/faucet/FaucetAssetSelector.tsx`
- `frontend/src/components/faucet/FaucetUsageLimit.tsx`
- `frontend/src/components/faucet/FaucetRequestButton.tsx`
- `frontend/src/components/faucet/FaucetRequestProgress.tsx`
- `frontend/src/components/faucet/FaucetSuccessResult.tsx`
- `frontend/src/components/faucet/FaucetErrorResult.tsx`
- `frontend/src/components/faucet/FaucetRecentRequests.tsx`
- `frontend/src/components/faucet/TestnetBadge.tsx`
- `frontend/src/components/faucet/BackToNexusLink.tsx`

### Modified Files:
- `backend/src/routes/index.ts`
- `frontend/src/app/routes.tsx`
- `frontend/src/components/common/AppHeader.tsx`
- `frontend/src/components/common/AppSidebar.tsx`
- `frontend/src/layouts/AppLayout.tsx`
- `frontend/src/pages/PortfolioPage.tsx`
- `frontend/src/components/portfolio/PortfolioStates.tsx`
- `frontend/src/components/common/PartialRepaymentModal.tsx`
- `frontend/src/components/common/CreateOfferWizardDrawer.tsx`
- `frontend/src/components/common/BorrowWizardDrawer.tsx`

---

## 7. Verification Results
- **Frontend Oxlint**: 0 warnings, 0 errors.
- **Frontend Vite Production Build**: Successfully compiled dist bundle (`npm run build` exit code 0).
- **Backend TypeScript Build**: Successfully compiled dist output (`npm run build` exit code 0).
