# Nexus Frontend Redesign Plan

This plan prioritizes contract correctness before visual polish. No frontend implementation is included in this documentation pass.

## P0 - Must Fix Immediately

| Item | Reason | Affected files | Expected result | Risk | Test case |
| --- | --- | --- | --- | --- | --- |
| Remove `Claim Settled Funds` and claim repayment flow | Current Soroban contracts transfer repayments directly from borrower/liquidator to lender through `Vault.collect_repayment_from`. No public claim method exists. | `frontend/src/pages/LenderDashboardPage.tsx`, `frontend/src/contexts/LendingContext.tsx`, `frontend/src/services/api/loans.api.ts`, `frontend/src/types/index.ts`, optionally backend cleanup in `backend/src/modules/loans/loans.schemas.ts`, `backend/prisma/schema.prisma` | Repaid loans show "Repayment received directly" with repayment tx receipt. No claim button, modal, action, or copy remains. | Removing mock-only behavior may change demo expectations. | Create or load a Repaid loan as lender; verify there is no claim CTA. Verify lender can open the FULL_REPAY tx on Stellar Expert. Search code for `Claim Settled Funds`, `claimRepayment`, `CLAIM_REPAYMENT`. |
| Display real txHash, ledger, contract IDs, and Stellar Expert links | Backend and transaction wrapper already produce confirmed receipt data, but offer/loan mappers drop it and detail pages hide it. | `frontend/src/types/index.ts`, `frontend/src/services/api/offers.api.ts`, `frontend/src/services/api/loans.api.ts`, `frontend/src/pages/LoanDetailPage.tsx`, `frontend/src/pages/MarketplacePage.tsx`, `frontend/src/pages/LenderDashboardPage.tsx`, `frontend/src/pages/BorrowerDashboardPage.tsx`, `frontend/src/pages/DashboardPage.tsx`, `frontend/src/pages/SettingsPage.tsx`, new shared receipt component under `frontend/src/components/common` | Every on-chain action shown in UI has txHash, ledger, contract ID, timestamp, and actual Stellar Expert link. Missing data is labeled as missing, never faked. | Some indexed records may lack receipt data from older local/mock state. UI must handle missing fields gracefully. | Execute or seed a confirmed CREATE_OFFER transaction; verify the same txHash appears on dashboard, offer detail, transaction history, and links to `stellar.expert`. |
| Remove fake contract names and bind Settings to real config | Settings currently shows non-existent `Nexus Core Router WASM` and `Escrow Factory Contract`. | `frontend/src/pages/SettingsPage.tsx`, `frontend/src/services/soroban/config.ts`, `deployments/testnet.json` | Settings shows Marketplace, Loan Manager, Vault, Oracle, XLM asset, and USDC asset from `CONTRACTS` and `ASSET_CONTRACTS`. | USDC contract may be unset; UI must show a clear missing-config warning. | Open Settings and verify IDs match `deployments/testnet.json` or env overrides. No hardcoded `CDD6...93AE`, `CAS7...110B`, or `CDXLM...TESTNET` remain. |
| Remove hardcoded risk on marketplace offers | Offers do not have Health Factor until a borrower provides collateral and a loan is created/activated. | `frontend/src/pages/MarketplacePage.tsx`, `frontend/src/components/common/RiskBadge.tsx` if needed | Marketplace shows offer terms, min HF requirement, and "Risk calculated in borrow simulation" instead of `SAFE`. | Product may lose a visually useful badge; replace it with real terms and funding proof. | Open Marketplace table and cards. Verify no offer row shows `SAFE` unless it is explicitly a simulated borrow result after collateral input. |
| Align borrow flow with `accept_offer` -> `activate_loan` | Current flow accepts an offer and redirects, leaving loan PendingCollateral and funds undrawn. | `frontend/src/pages/BorrowLoanPage.tsx`, `frontend/src/contexts/LendingContext.tsx`, `frontend/src/services/api/loans.api.ts`, `frontend/src/services/soroban/marketplace.contract.ts`, `frontend/src/services/soroban/loanManager.contract.ts` | Borrow page runs two sequential signatures. After accept, UI persists PendingCollateral, then immediately prompts activation. If activation fails, user can resume activation. | Two Freighter prompts can increase drop-off; recovery state is required. | Borrow from an Active offer. Verify first tx calls `accept_offer`, backend creates PendingCollateral, second tx calls `activate_loan`, backend marks loan active, and funds are not presented as received before activation. |
| Ensure blockchain tx succeeds before backend persistence | Mutating backend endpoints require receipts, but UI must not call them when Soroban tx fails or times out. | `frontend/src/contexts/LendingContext.tsx`, `frontend/src/services/soroban/transaction.ts`, all API service methods under `frontend/src/services/api` | No backend state changes occur for rejected Freighter signatures, failed simulations, failed submissions, or timeout without confirmed success. | Timeout handling may be ambiguous if tx confirms later; user needs retry/sync messaging. | Reject Freighter signature for create, fund, accept, activate, repay, liquidate, oracle update. Verify no API mutation request is sent and no local success state appears. |
| Split Offer Detail from Loan Detail | One page currently tries to display both offer terms and loan details, hiding proper lifecycle receipts. | `frontend/src/app/routes.tsx`, `frontend/src/pages/LoanDetailPage.tsx`, new `frontend/src/pages/OfferDetailPage.tsx`, links in `MarketplacePage.tsx`, `LenderDashboardPage.tsx` | Offers use `/app/offers/:id`; actual loans use `/app/loans/:id`. Each page shows the correct contract ID and transaction timeline. | Requires route redirects and link updates. | Click an offer in Marketplace; verify it opens Offer Detail. Click an active loan; verify it opens Loan Detail. No offer ID is rendered as a loan contract. |
| Maintain dedicated transaction history route | Receipts are core Web3 UX and `/app/transactions` is now a first-class page. | `frontend/src/app/routes.tsx`, `frontend/src/layouts/AppLayout.tsx`, `frontend/src/pages/TransactionsPage.tsx`, `frontend/src/services/api/transactions.api.ts` | `/app/transactions` lists confirmed transactions with filters, contract IDs, txHash, ledger, and Stellar Expert links. | Existing local mock transactions may lack txHash; UI must label them as local records. | Open `/app/transactions`; filter by wallet, offer, loan, and type. Verify every live row has a working Stellar Expert link. |

## P1 - High Value After P0

| Item | Reason | Affected files | Expected result | Risk | Test case |
| --- | --- | --- | --- | --- | --- |
| Redesign Create Offer into professional workflow | Lenders must understand create, fund, and activate as separate chain steps. | `frontend/src/pages/CreateLoanPage.tsx` or new `CreateOfferPage.tsx`, `frontend/src/contexts/LendingContext.tsx`, shared receipt components | Stepper shows terms, create draft, fund vault, activate listing, and receipts. | More state management; partially complete offers need recovery. | Create offer, refresh page after Draft, fund later, activate later. Verify state resumes from backend. |
| Improve loan detail timeline | Timeline should be receipt-driven, not inferred from local status. | `frontend/src/pages/LoanDetailPage.tsx`, `frontend/src/services/api/transactions.api.ts`, shared timeline component | Timeline rows map to ACCEPT_OFFER, ACTIVATE_LOAN, ADD_COLLATERAL, REPAY, LIQUIDATE, ORACLE impact where applicable. | Older data may not have all events. | For a loan with multiple actions, verify chronological order, tx links, and status text. |
| Improve liquidation receipts | Liquidators need proof of amount repaid and collateral seized. | `frontend/src/pages/LiquidationDetailPage.tsx`, `frontend/src/contexts/LendingContext.tsx`, `frontend/src/services/api/loans.api.ts` | After liquidation, page shows permanent receipt panel with txHash, ledger, repay amount, seized collateral, remaining debt, remaining collateral. | Backend currently stores details text; collateralReceived may need structured metadata. | Execute liquidation; verify receipt stays visible after success and appears in Transaction History. |
| Add overdue repayment and 7-day default countdown | Borrowers need a repayment warning when the loan term ends, and liquidators should only see time-based liquidations after the 7-day grace period. | `frontend/src/pages/BorrowerDashboardPage.tsx`, `frontend/src/pages/LoanDetailPage.tsx`, `frontend/src/pages/LiquidationCenterPage.tsx`, `frontend/src/contexts/LendingContext.tsx`, backend loan expiry/default job or polling flow | At `due_time`, loans show `Expired`, borrower gets a repay CTA and 7-day countdown. At `due_time + 7 days`, unpaid loans become `Defaulted` and appear as liquidatable regardless of HF. | Requires clock consistency between UI, backend, and ledger timestamp. Expired loans must not be mislabeled as immediately liquidatable unless HF is also below 1.2. | Create or seed an overdue healthy loan. Verify it appears as Expired with repay warning, does not show in Liquidation Center until 7 days pass, then appears as Defaulted/liquidatable. |
| Use real wallet balances | Static balances cause false affordances and failed transactions. | `frontend/src/contexts/LendingContext.tsx`, `frontend/src/contexts/WalletContext.tsx`, `frontend/src/services/wallet`, possibly new balance service | Wallet header, borrow, fund, repay, and liquidate affordability checks use real XLM and USDC balances. | Soroban token balance reads require correct token contracts and decimal handling. | Connect a wallet with low USDC; verify fund/repay/liquidate buttons disable with accurate balance. |
| Better oracle impact UI | Oracle updates can move loans across risk zones; current UI mixes mock chart and live action. | `frontend/src/pages/OracleMonitorPage.tsx`, `frontend/src/services/api/oracle.api.ts`, `frontend/src/contexts/LendingContext.tsx` | Admin price update shows current decimals/source, stale status, tx receipt, and before/after loan risk table. | Admin detection may be unavailable unless configured. | Update XLM price as admin; verify tx receipt, recalculation count, and affected loan status changes. |
| Add offer funding proof | Active marketplace listings should prove funds are locked. | `frontend/src/pages/MarketplacePage.tsx`, `OfferDetailPage.tsx`, `frontend/src/services/soroban/vault.contract.ts`, backend offers model if indexed value is added | Active offers show locked amount or last funding tx proof. | Direct Vault read helper may need proper simulation transaction construction. | View Active offer; verify locked amount >= principal or funding tx receipt is displayed. |
| Improve Settings configuration health | Reviewers need to verify deployed contract IDs and missing env values. | `frontend/src/pages/SettingsPage.tsx`, `frontend/src/services/soroban/config.ts` | Settings shows config source, missing USDC contract warning, RPC URL, backend health, and copy/open links. | Explorer contract URL format must be network-specific. | Clear USDC env var and open Settings; verify warning is visible and no fake fallback address appears. |

## P2 - Polish And Expansion

| Item | Reason | Affected files | Expected result | Risk | Test case |
| --- | --- | --- | --- | --- | --- |
| Landing visual polish | Once core flows are correct, the public page can better communicate protocol trust. | `frontend/src/pages/LandingPage.tsx`, `frontend/src/components/landing/*` | Landing combines polished visuals with live protocol stats and contract links. | Visual work can distract from transaction correctness if done early. | Load landing with API online/offline and verify live stats degrade gracefully. |
| Analytics polish | Charts should be useful only when data is real and labeled. | `frontend/src/pages/DashboardPage.tsx`, backend analytics if added | Historical charts use indexed data or are labeled as unavailable. | Requires backend aggregation endpoint for real history. | With no history endpoint, chart shows empty state instead of fabricated trend. |
| Animation | Microinteractions can make tx stages clearer. | Shared components and page CSS | Transaction stages animate without layout shift or hiding critical data. | Over-animation can reduce clarity. | Run create/fund/activate; verify stage indicators are readable and stable. |
| Health Factor simulator | Borrowers and lenders can model collateral and price changes before actions. | `BorrowLoanPage.tsx`, `LoanDetailPage.tsx`, shared simulator component | Simulator shows HF, LTV, liquidation price, and action impact using current oracle. | Simulator values may diverge from contract decimals if not carefully normalized. | Compare simulator output against backend/contract calculation for a known loan. |
| Receipt component library | Reduce repeated receipt UI and enforce consistency. | New `frontend/src/components/common/TransactionReceipt*.tsx`, affected pages | All pages render receipt metadata consistently. | Requires broad page updates. | Snapshot review: every receipt panel has txHash, ledger, contract, timestamp, Expert link. |

## Implementation Order

1. Add receipt fields to frontend `LoanOffer` and `Loan` types and API mappers.
2. Build shared receipt row/panel components.
3. Remove claim repayment UI and context action.
4. Fix Settings contract registry.
5. Remove hardcoded Marketplace offer risk.
6. Maintain Transaction History route and receipt filters.
7. Split Offer Detail from Loan Detail.
8. Rework Borrow Flow into accept -> activate with recovery.
9. Add overdue repayment notification, 7-day grace countdown, and default-to-liquidation visibility.
10. Rework Create Offer stepper.
11. Add real balances and stronger oracle/admin UX.

## Validation Commands

Run from `frontend/` after implementation:

```bash
npm run lint
npm run build
```

Manual validation:

- Connect Freighter on Stellar Testnet.
- Create offer and confirm Draft receipt.
- Fund offer and confirm Funding receipt.
- Activate offer and confirm Marketplace listing.
- Borrow offer and confirm both accept and activate receipts.
- Add collateral, partial repay, full repay, and confirm each receipt.
- Execute liquidation on eligible loan and confirm receipt.
- Update oracle as admin and confirm receipt plus health recalculation.
- Open Settings and Transaction History to verify real contract IDs and Stellar Expert links.
