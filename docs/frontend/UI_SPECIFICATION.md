# Nexus Frontend UI Specification

This specification is contract-driven. The current Rust contracts, backend receipt rules, and Soroban frontend service are the source of truth. Existing product docs contain some older names such as `Listed` and `Accepted`; the current deployed contract code uses `Draft`, `Funding`, `Active`, and `Matched` for offers, and `PendingCollateral` for loans created by `accept_offer` before `activate_loan`.

## Global Source Of Truth

### Protocol Rules

- Nexus is a fixed-rate collateralized P2P marketplace, not a liquidity pool.
- One offer is funded by one lender.
- One accepted offer creates one loan between one lender and one borrower.
- An offer must be funded and activated before it is visible in the marketplace.
- The blockchain is the source of truth. The backend is an indexer, database, and REST API only.
- Backend persistence for mutations must happen only after a confirmed Soroban transaction.
- No UI may fabricate a `txHash`, ledger, contract ID, balance, or Stellar Expert link.
- Lender, borrower, and liquidator are actions a wallet can perform. They are not login roles.
- Repayment is transferred directly from payer to lender by `Vault.collect_repayment_from`; there is no claim-repayment contract method.

### Contract Functions

Marketplace:

- `create_offer(lender, loan_asset, loan_amount, fixed_apr_bps, duration_days, collateral_asset, max_ltv_bps, liquidation_threshold_bps, liquidation_bonus_bps, grace_period_days, min_health_factor_bps) -> offer_id`
- `fund_offer(offer_id)`
- `activate_offer(offer_id)`
- `cancel_offer(offer_id)`
- `expire_offer(offer_id)`
- `accept_offer(offer_id, borrower, collateral_amount) -> loan_id`
- `get_offer(offer_id)`, `get_offer_count()`

Loan Manager:

- `create_pending_loan_from_offer(offer, borrower, collateral_amount) -> loan_id` called by Marketplace
- `activate_loan(loan_id)`
- `get_loan(loan_id)`, `get_loan_count()`
- `calculate_health_factor(loan_id)`, `calculate_ltv(loan_id)`
- `refresh_loan_state(loan_id)`
- `add_collateral(loan_id, amount)`
- `partial_repay(loan_id, amount)`
- `full_repay(loan_id)`
- `mark_expired(loan_id)`, `mark_defaulted(loan_id)`
- `liquidate(loan_id, liquidator, repay_amount)`

Vault:

- User-facing flows call Vault indirectly through Marketplace or Loan Manager.
- UI may read `get_offer_locked_amount(offer_id)` and `get_loan_collateral_amount(loan_id)`.
- Vault transfer functions are not standalone UI actions.

Oracle:

- `set_price(asset_pair, price, decimals, source)`
- `set_price_for_assets(base_asset, quote_asset, asset_pair, price, decimals, source)`
- `get_price(asset_pair)`, `get_price_for_assets(base_asset, quote_asset)`
- `get_last_updated(asset_pair)`, `is_price_stale(asset_pair)`

### Backend APIs

- `GET /api/health`
- `GET /api/offers`, `GET /api/offers?marketplaceOnly=true`, `GET /api/offers/:id`
- `POST /api/offers`
- `POST /api/offers/:id/fund`
- `POST /api/offers/:id/activate`
- `POST /api/offers/:id/cancel`
- `POST /api/offers/:id/expire`
- `POST /api/offers/:id/accept`
- `GET /api/loans`, `GET /api/loans/liquidatable`, `GET /api/loans/:id`
- `POST /api/loans/:id/activate`
- `PATCH /api/loans/:id` for `ADD_COLLATERAL`, `PARTIAL_REPAY`, `FULL_REPAY`, `LIQUIDATE`
- `GET /api/oracle/prices`
- `POST /api/oracle/prices`
- `POST /api/oracle/recalculate-health`
- `GET /api/transactions`

Every mutating API requires a confirmed receipt:

- `txHash`: 64-character Stellar transaction hash
- `explorerUrl`: Stellar Expert URL ending in `/tx/{txHash}`
- `ledger`: positive integer
- `txStatus`: `SUCCESS`
- `contractId`: invoked Soroban contract ID when available
- `blockTimestamp`
- `contractReturnValue` when a contract returns an offer or loan ID

### Required Chain Metadata Display

Any page that shows an offer, loan, oracle update, or transaction must display:

- On-chain ID: `contractOfferId` or `contractLoanId` when present
- Invoked contract ID
- `txHash`, shortened with copy affordance
- Ledger number
- Block timestamp
- `View on Stellar Expert` link from the actual `explorerUrl`

If any value is missing, the UI must show "Not indexed yet" or "No confirmed transaction recorded" and must not substitute fake data.

## Page Specifications

## Landing

1. Page purpose: Explain Nexus as a fixed-rate collateralized P2P lending marketplace and route users to connect or view live market data.
2. Target user: Public visitors, lenders, borrowers, liquidators, reviewers.
3. Contract functions mapped: Read-only summaries may use `Marketplace.get_offer_count`, `LoanManager.get_loan_count`, `Oracle.get_price`, and `Oracle.get_last_updated`.
4. Backend APIs mapped: `GET /api/offers`, `GET /api/loans`, `GET /api/oracle/prices`, `GET /api/transactions`.
5. Required blockchain transactions: None.
6. Required txHash / Stellar Expert display: Only if a live recent transaction feed is shown; each feed item must link to its actual Stellar Expert URL.
7. Business rules: Must state no pools, no variable pool APY, one lender per offer, one borrower per loan, and escrow-based custody.
8. UI components: Hero, live protocol telemetry, P2P flow diagram, contract registry teaser, oracle price card, CTA to connect.
9. Empty state: Show zeroed telemetry with "No indexed protocol activity yet."
10. Loading state: Skeleton metrics and disabled live feed.
11. Error state: "Live indexer unavailable" with retry; keep educational content visible.
12. Success state: Live offer, loan, oracle, and transaction counts loaded.
13. Actions allowed: Connect wallet, open marketplace after wallet connection, open docs.
14. Actions forbidden: Fake TVL, fake transaction links, pool APY language, login-role selection.
15. Current frontend issues: Mostly static marketing and no live chain telemetry.
16. Required redesign: Add live indexed stats, clarify P2P fixed-rate model, and avoid liquidity-pool wording.

## Connect Wallet

1. Page purpose: Connect Freighter and verify the selected Stellar network.
2. Target user: Any wallet holder.
3. Contract functions mapped: None.
4. Backend APIs mapped: Optional `GET /api/health` for app readiness.
5. Required blockchain transactions: None.
6. Required txHash / Stellar Expert display: None.
7. Business rules: A connected wallet can lend, borrow, and liquidate; role is not selected at login.
8. UI components: Freighter availability card, network badge, wallet address, real XLM and USDC balances, Testnet warning.
9. Empty state: Freighter unavailable or no connected wallet.
10. Loading state: Checking extension and network.
11. Error state: Extension unavailable, user rejected request, wrong network.
12. Success state: Connected wallet, Testnet confirmed, real balances loaded.
13. Actions allowed: Connect, refresh wallet, launch app, disconnect if already connected.
14. Actions forbidden: Persisting a user role, assigning lender/borrower/liquidator identity, showing static balances.
15. Current frontend issues: `LendingContext.connectWallet` assigns `250000 XLM` and `50000 USDC`; no real balance lookup.
16. Required redesign: Bind balances to Horizon/Soroban token balance reads and keep role copy action-based.

## Dashboard

1. Page purpose: Show protocol telemetry and recent chain activity.
2. Target user: Connected wallets and reviewers.
3. Contract functions mapped: Read-only counts, oracle prices, loan health calculations as needed.
4. Backend APIs mapped: `GET /api/offers`, `GET /api/loans`, `GET /api/oracle/prices`, `GET /api/transactions`.
5. Required blockchain transactions: None from dashboard.
6. Required txHash / Stellar Expert display: Recent transaction table must include `txHash`, ledger, contract, status, and Stellar Expert link.
7. Business rules: TVL must be defined as locked collateral plus locked funded offer principal, not pooled liquidity.
8. UI components: Telemetry cards, oracle widget, status allocation chart, Health Factor distribution, transaction table.
9. Empty state: No offers, no loans, no transactions with clear zero-state cards.
10. Loading state: Skeleton metric cards and table rows.
11. Error state: Indexer/API unavailable; retry and preserve wallet header.
12. Success state: Metrics reflect indexed backend data.
13. Actions allowed: Navigate to marketplace, create offer, transaction detail.
14. Actions forbidden: Mutating loan or offer state directly from dashboard.
15. Current frontend issues: TVL history is mock-derived; legacy `CLAIM_REPAYMENT` remains in shared enums for compatibility but must not appear as a live action.
16. Required redesign: Make telemetry verifiable, label indexed data age, and make every transaction inspectable.

## Marketplace

1. Page purpose: List borrowable offers that are actually funded and active.
2. Target user: Borrowers browsing fixed-rate offers.
3. Contract functions mapped: `get_offer`, `get_offer_count`; optional Vault `get_offer_locked_amount`; Oracle `get_price_for_assets`.
4. Backend APIs mapped: `GET /api/offers?marketplaceOnly=true`.
5. Required blockchain transactions: None until user starts borrow flow.
6. Required txHash / Stellar Expert display: Offer cards must show creation/funding/activation receipts when indexed, plus `contractOfferId` and Marketplace contract ID.
7. Business rules: Only `Active` offers appear; `Draft` and `Funding` are lender setup states; `Matched` is no longer borrowable; offers do not have live Health Factor.
8. UI components: Filters, offer cards/table, status badge, terms, min Health Factor requirement, funding proof, borrow CTA.
9. Empty state: No active funded offers.
10. Loading state: Offer skeleton cards.
11. Error state: Cannot load marketplace offers.
12. Success state: Active offers render with contract-backed funding/status.
13. Actions allowed: View offer detail, start borrow flow, create offer.
14. Actions forbidden: Borrow from own offer, borrow non-Active offer, display `SAFE` risk badge on offers.
15. Current frontend issues: Table hardcodes `RiskBadge zone="SAFE"`; cards show "Escrow Secured" without locked amount or tx proof.
16. Required redesign: Replace offer risk with "Borrower HF simulated after collateral input" and surface funding receipts.

## Create Offer

1. Page purpose: Let a lender create terms, lock principal, and publish a funded offer.
2. Target user: Lenders.
3. Contract functions mapped: `Marketplace.create_offer`, `Marketplace.fund_offer`, `Marketplace.activate_offer`, optionally `Marketplace.cancel_offer`.
4. Backend APIs mapped: `POST /api/offers`, `POST /api/offers/:id/fund`, `POST /api/offers/:id/activate`, `POST /api/offers/:id/cancel`.
5. Required blockchain transactions: Three required transactions: create Draft offer, fund offer, activate offer.
6. Required txHash / Stellar Expert display: Each wizard step must show its confirmed txHash, ledger, contract ID, and Stellar Expert link before enabling the next backend-dependent step.
7. Business rules: Positive loan amount, APR, and duration; `max_ltv_bps <= liquidation_threshold_bps`; `min_health_factor_bps >= 14000`; funded offer is not marketplace-listed until `activate_offer` succeeds.
8. UI components: Stepper, terms form, risk parameter editor, balance/allowance check, tx status panel, receipt cards, owner cancel action.
9. Empty state: Initial blank form with sensible defaults.
10. Loading state: Transaction stages: preparing, wallet, submitting, confirming.
11. Error state: Form validation, Freighter rejection, simulation failure, on-chain panic, backend receipt rejection.
12. Success state: `Draft`, then `Funding`, then `Active` with links to detail and marketplace.
13. Actions allowed: Create, fund, activate, cancel while status is `Draft`, `Funding`, or `Active`.
14. Actions forbidden: Backend persistence before tx success, min HF below 1.4, fake offer expiration if not represented in contract storage, listing unfunded offers.
15. Current frontend issues: `expirationDays` exists in UI but not in contract input; risk label is heuristic; wallet balance check uses static balances.
16. Required redesign: Use a professional three-transaction wizard with persistent receipts and clear "not listed yet" status.

## Offer Detail

1. Page purpose: Inspect a single offer before funding, activation, cancellation, or borrowing.
2. Target user: Lender owner, borrower, reviewer.
3. Contract functions mapped: `get_offer`, Vault `get_offer_locked_amount`, Marketplace actions based on owner/status.
4. Backend APIs mapped: `GET /api/offers/:id`, `GET /api/transactions?offerId=:id`, action endpoints for owner.
5. Required blockchain transactions: Owner actions may call fund, activate, cancel; borrower starts accept flow on Active offers.
6. Required txHash / Stellar Expert display: Display a receipt timeline for create, fund, activate, cancel, expire, matched.
7. Business rules: Borrow CTA only for Active offers and non-lender wallet; funding amount must match offer principal.
8. UI components: Offer header, status badge, term table, funding proof, chain receipts, owner action panel, borrow simulation entry.
9. Empty state: Offer not found or not indexed.
10. Loading state: Loading offer and transactions.
11. Error state: Offer unavailable or action failed.
12. Success state: Offer state and chain receipts loaded.
13. Actions allowed: Owner fund/activate/cancel, borrower begin borrow on Active offer, copy/open tx links.
14. Actions forbidden: Treating an offer as a loan, showing loan HF before a borrower supplies collateral.
15. Current frontend issues: No dedicated route; `LoanDetailPage` tries to serve both offer and loan specs.
16. Required redesign: Add a dedicated offer detail route and reserve Loan Detail for actual loans.

## Borrow Flow

1. Page purpose: Accept an Active offer and activate the resulting loan so collateral is locked and funds are received.
2. Target user: Borrowers.
3. Contract functions mapped: `Marketplace.accept_offer` followed by `LoanManager.activate_loan`.
4. Backend APIs mapped: `POST /api/offers/:id/accept`, then `POST /api/loans/:id/activate`.
5. Required blockchain transactions: Two sequential confirmations: `accept_offer` returns `contractLoanId`; `activate_loan` locks collateral and transfers principal.
6. Required txHash / Stellar Expert display: Show separate receipts for accept and activate. If activation fails after accept, show the PendingCollateral loan and a resume activation CTA.
7. Business rules: Offer must be Active; borrower cannot equal lender; collateral amount must be positive; initial LTV must be within max LTV; initial HF must meet min HF; funds are not received until `activate_loan` succeeds.
8. UI components: Offer summary, collateral input, HF/LTV simulator, liquidation price, two-step tx panel, receipt panel.
9. Empty state: Offer missing, no longer Active, or already Matched.
10. Loading state: Stage per transaction and backend sync.
11. Error state: Insufficient real balance, contract simulation failure, accept success plus activate failure recovery.
12. Success state: Loan Active/Warning/LiquidationPlanning as returned by contract, receipt shown, link to Loan Detail.
13. Actions allowed: Accept, activate, retry activation, cancel before signing.
14. Actions forbidden: Redirecting after accept as if funds were drawn, fake backend loan creation, accepting own offer.
15. Current frontend issues: `BorrowLoanPage` calls only `acceptOffer` and navigates to Borrower Dashboard, leaving the loan PendingCollateral.
16. Required redesign: Keep user in an explicit accept -> activate flow with receipts and recovery.

## My Loans

1. Page purpose: Show a wallet's borrower, lender, and closed loan positions.
2. Target user: Any connected wallet.
3. Contract functions mapped: Read-only `get_loan`, `calculate_health_factor`, `calculate_ltv` when available.
4. Backend APIs mapped: `GET /api/loans?borrowerWallet=...`, `GET /api/loans?lenderWallet=...`, `GET /api/transactions?wallet=...`.
5. Required blockchain transactions: None from list view.
6. Required txHash / Stellar Expert display: Each row should show latest txHash link or "No confirmed transaction recorded"; detail page carries full receipts.
7. Business rules: A wallet can appear on both borrowed and lent tabs; closed loans have no active HF actions.
8. UI components: Tabs by position state, search, risk filter, status badges, latest receipt column.
9. Empty state: No positions for selected tab.
10. Loading state: Table skeleton.
11. Error state: Could not load wallet positions.
12. Success state: Positions grouped by action history.
13. Actions allowed: View detail, filter, copy IDs.
14. Actions forbidden: Claim repayment, hide PendingCollateral loans, assign login roles.
15. Current frontend issues: No receipt metadata, no transaction links, title implies loan-only while offers are separate.
16. Required redesign: Rename to Positions or My Loans, add latest chain receipt and include PendingCollateral resume affordance.

## Loan Detail

1. Page purpose: Inspect and act on one actual loan.
2. Target user: Borrower, lender, liquidator, reviewer.
3. Contract functions mapped: `get_loan`, `calculate_health_factor`, `calculate_ltv`, `refresh_loan_state`, `activate_loan`, `add_collateral`, `partial_repay`, `full_repay`, `liquidate`.
4. Backend APIs mapped: `GET /api/loans/:id`, `GET /api/transactions?loanId=:id`, `POST /api/loans/:id/activate`, `PATCH /api/loans/:id`.
5. Required blockchain transactions: Activation, add collateral, partial repay, full repay, liquidation.
6. Required txHash / Stellar Expert display: Must show accept, activation, collateral, repayment, liquidation receipts with txHash, ledger, contract ID, timestamp, Stellar Expert link.
7. Business rules: PendingCollateral has not locked collateral or transferred funds; only borrower can activate/add collateral/repay; any wallet can liquidate only when HF < 1.2 or Defaulted; closed loans are read-only.
8. UI components: Status header, IDs and contract registry panel, HF gauge, LTV, debt/collateral cards, action panel, receipt timeline, oracle panel.
9. Empty state: Loan not found.
10. Loading state: Loading loan and receipts.
11. Error state: Action rejected or chain/API data unavailable.
12. Success state: On-chain status and receipt timeline synced.
13. Actions allowed: Borrower activation/rescue/repay, liquidator liquidation, copy/open receipts.
14. Actions forbidden: Claim repayment, liquidate healthy loans, show offer-only data as a loan.
15. Current frontend issues: Hides txHash, ledger, contract IDs, and Stellar Expert links; timeline is status-derived rather than receipt-derived.
16. Required redesign: Make chain receipts first-class and separate offer detail from loan detail.

## Borrower Dashboard

1. Page purpose: Manage loans where the connected wallet is borrower.
2. Target user: Borrowers.
3. Contract functions mapped: `activate_loan`, `add_collateral`, `partial_repay`, `full_repay`, read health/LTV.
4. Backend APIs mapped: `GET /api/loans?borrowerWallet=...`, `POST /api/loans/:id/activate`, `PATCH /api/loans/:id`, `GET /api/transactions?wallet=...`.
5. Required blockchain transactions: Activation, add collateral, repay.
6. Required txHash / Stellar Expert display: Each card should show latest loan receipt and link to full receipt timeline.
7. Business rules: PendingCollateral only permits activation; active mutable states permit add collateral and repay; closed states have no action.
8. UI components: Debt cards, PendingCollateral queue, HF gauges, due dates, rescue action modals, receipt snippets.
9. Empty state: No borrowed positions with CTA to marketplace.
10. Loading state: Loan card skeletons.
11. Error state: Cannot load borrower loans or action failed.
12. Success state: Post-action card updates from indexed backend.
13. Actions allowed: Activate pending, add collateral, partial/full repay, view detail.
14. Actions forbidden: Repay before activation, add collateral to closed loans, use static wallet balances.
15. Current frontend issues: Functional actions exist but no chain receipt display and balance checks use static balances.
16. Required redesign: Add PendingCollateral recovery, real balances, and action receipts.

## Lender Dashboard

1. Page purpose: Manage offers and monitor loans where the wallet is lender.
2. Target user: Lenders.
3. Contract functions mapped: `create_offer`, `fund_offer`, `activate_offer`, `cancel_offer`, read loan state.
4. Backend APIs mapped: `GET /api/offers?lenderWallet=...`, `GET /api/loans?lenderWallet=...`, offer action endpoints, transaction filters.
5. Required blockchain transactions: Funding, activation, cancellation from dashboard; repayment receipts are created by borrower repay transactions.
6. Required txHash / Stellar Expert display: Offer and loan rows must show latest receipt and link to full history.
7. Business rules: Repayment goes directly to lender during `partial_repay` or `full_repay`; no claim action exists.
8. UI components: Offer setup table, active loan table, settled loan table, yield summary, receipt columns.
9. Empty state: No lending positions with create offer CTA.
10. Loading state: Tables and stats skeleton.
11. Error state: Offer action rejected or data unavailable.
12. Success state: Offers and loans reflect indexed statuses.
13. Actions allowed: Create offer, fund Draft, activate Funding, cancel Draft/Funding/Active, view details.
14. Actions forbidden: `Claim Settled Funds`, "Execute Claim Call", any escrow claim copy.
15. Current frontend issues: Includes a claim modal and calls `claimRepayment`, which is explicitly unsupported in live mode.
16. Required redesign: Remove claim UI and replace with "Repayment received directly" receipt/history.

## Liquidation Center

1. Page purpose: List loans eligible for liquidation.
2. Target user: Liquidators and reviewers.
3. Contract functions mapped: `calculate_health_factor`, `refresh_loan_state`, `liquidate`.
4. Backend APIs mapped: `GET /api/loans/liquidatable`, `GET /api/oracle/prices`.
5. Required blockchain transactions: None from list view.
6. Required txHash / Stellar Expert display: Show latest relevant txHash per loan when indexed; detail page shows execution receipt.
7. Business rules: Eligible when HF < 1.2 or status is Defaulted; close factor is 50% of outstanding debt per liquidation call.
8. UI components: Eligible loans table, HF and debt summaries, oracle freshness, max repay, estimated collateral.
9. Empty state: No liquidatable loans.
10. Loading state: Table skeleton.
11. Error state: Could not load liquidatable loans or stale oracle.
12. Success state: Only eligible loans shown.
13. Actions allowed: Open liquidation detail, copy IDs.
14. Actions forbidden: Liquidate healthy or PendingCollateral loans, imply guaranteed profit without price/receipt caveat.
15. Current frontend issues: Good eligibility filtering but no chain receipts or oracle freshness warning.
16. Required redesign: Add receipt/latest tx columns and clearer close-factor explanation.

## Liquidation Detail

1. Page purpose: Execute partial liquidation with clear math and a verifiable receipt.
2. Target user: Liquidators.
3. Contract functions mapped: `LoanManager.liquidate(loan_id, liquidator, repay_amount)`.
4. Backend APIs mapped: `PATCH /api/loans/:id` with `action=LIQUIDATE`, `GET /api/transactions?loanId=:id`.
5. Required blockchain transactions: One `liquidate` transaction.
6. Required txHash / Stellar Expert display: After success, show receipt with txHash, ledger, contract ID, Stellar Expert link, repay amount, collateral seized, and remaining debt/collateral.
7. Business rules: Repay amount must be positive and no more than 50% of outstanding debt; liquidator pays loan asset directly to lender; Vault transfers seized collateral to liquidator.
8. UI components: Loan summary, liquidation calculator, close factor input, HF after liquidation, confirmation modal, receipt modal/panel.
9. Empty state: Loan not found or no longer eligible.
10. Loading state: Transaction stages and backend sync.
11. Error state: Ineligible loan, amount over close factor, insufficient real balance, chain/API failure.
12. Success state: Receipt displayed before navigation away.
13. Actions allowed: Execute liquidation, copy receipt, open Stellar Expert.
14. Actions forbidden: Immediate redirect without receipt, fake collateral received, liquidation over close factor.
15. Current frontend issues: Redirects back to center after execution and does not display txHash or liquidation receipt.
16. Required redesign: Keep user on receipt state after liquidation and add permanent transaction history entry.

## Oracle Monitor

1. Page purpose: Monitor oracle prices and, for admin wallets, update price data.
2. Target user: Admin operator, reviewers, risk monitors.
3. Contract functions mapped: `set_price_for_assets`, `set_price`, `get_price`, `get_price_for_assets`, `is_price_stale`.
4. Backend APIs mapped: `GET /api/oracle/prices`, `POST /api/oracle/prices`, `POST /api/oracle/recalculate-health`, `GET /api/transactions?type=UPDATE_ORACLE`.
5. Required blockchain transactions: Admin price update transaction.
6. Required txHash / Stellar Expert display: Price update receipt and affected loan recalculation summary must show txHash, ledger, Oracle contract ID, and Stellar Expert link.
7. Business rules: Contract enforces admin auth; price must be positive; decimals <= 18; health recalculation is indexed backend state after oracle update.
8. UI components: Current price card, staleness indicator, update form, affected loans preview, update receipt, oracle tx history.
9. Empty state: No oracle prices indexed.
10. Loading state: Price and affected-loan skeleton.
11. Error state: Non-admin wallet, simulation failure, stale/missing pair, backend recalc failure.
12. Success state: Confirmed oracle tx, updated indexed price, recalculated affected loans.
13. Actions allowed: Admin update price, recalculate indexed health, open tx link.
14. Actions forbidden: Letting any wallet appear authorized, hardcoding decimals without display/validation, fake price history as live data.
15. Current frontend issues: Uses hardcoded decimals `7`, generated mock chart data, and no tx receipt display.
16. Required redesign: Add admin gating, dynamic decimal/source display, receipt panel, and stale-price warning.

## Settings

1. Page purpose: Show wallet, network, contract registry, and app configuration.
2. Target user: Connected wallet and reviewers.
3. Contract functions mapped: None required; optional read-only contract health probes.
4. Backend APIs mapped: `GET /api/health`; optionally transactions for recent user activity.
5. Required blockchain transactions: None.
6. Required txHash / Stellar Expert display: Settings transaction preview must link real txHash values; contract IDs should link to Stellar Expert contract pages when URL format is available.
7. Business rules: Display only real deployed contracts and asset contracts from runtime config.
8. UI components: Wallet card, real balances, network/RPC card, contract registry, asset registry, notification preferences, recent tx links.
9. Empty state: No wallet or no transactions.
10. Loading state: Wallet/config health checks.
11. Error state: Missing contract env var, wrong network, API unavailable.
12. Success state: Real config and wallet data displayed.
13. Actions allowed: Disconnect, copy address/contract ID, open explorer links.
14. Actions forbidden: Fictional contract names, fake shortened addresses, fake fees.
15. Current frontend issues: Shows `Nexus Core Router WASM`, `Escrow Factory Contract`, and `CDXLM...TESTNET`, none of which reflect `CONTRACTS` and `ASSET_CONTRACTS`.
16. Required redesign: Bind to `frontend/src/services/soroban/config.ts` and `deployments/testnet.json`.

## Transaction History

1. Page purpose: Provide a dedicated ledger of confirmed app actions.
2. Target user: Any connected wallet, reviewers, support/debugging.
3. Contract functions mapped: None directly; rows map to prior contract calls.
4. Backend APIs mapped: `GET /api/transactions` with filters for wallet, type, offerId, loanId.
5. Required blockchain transactions: None from history page.
6. Required txHash / Stellar Expert display: Every row requires txHash, Stellar Expert link, ledger, contract ID, status, timestamp, amount, asset, offer/loan references.
7. Business rules: Only confirmed successful chain transactions should be persisted for mutating flows.
8. UI components: Filterable table, transaction detail drawer, copy buttons, Stellar Expert links.
9. Empty state: No confirmed transactions for selected filters.
10. Loading state: Table skeleton.
11. Error state: Cannot load transactions.
12. Success state: Confirmed receipts loaded and linkable.
13. Actions allowed: Filter, copy, open Stellar Expert, navigate to related offer/loan.
14. Actions forbidden: Manual creation of fake transactions from UI, showing "Not recorded" as a valid receipt.
15. Current frontend issues: No dedicated route; Settings shows hash text without explorer links and includes fake fee text.
16. Required redesign: Add `/app/transactions` and reuse receipt components across detail pages.
