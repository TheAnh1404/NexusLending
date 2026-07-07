# Nexus Lending Protocol — Frontend Product Review

This document contains a comprehensive product audit, technical critique, and UX/Web3 analysis of the **Nexus Lending Protocol** frontend. The evaluation is conducted from the perspective of a Senior Product Manager, Senior UX Designer, Senior Web3 Architect, and Hackathon Judge, comparing the frontend implementation against the underlying Rust Soroban smart contracts, business specifications, and decentralized user expectations.

---

## Executive Scorecard

| Category | Score | Status |
| :--- | :---: | :--- |
| **1. Overall Product Score** | **56/100** | ⚠️ **Mediocre / Inconsistent** |
| **2. UI Score** | **85/100** | 🟢 **Premium / Clean** |
| **3. UX Score** | **52/100** | 🟡 **Needs Work** |
| **4. Web3 Experience Score** | **40/100** | 🔴 **Major Gaps** |
| **5. Business Consistency Score** | **45/100** | 🔴 **Broken Logic** |
| **6. Smart Contract Mapping Score** | **55/100** | 🟡 **Needs Work** |
| **7. Hackathon Demo Score** | **78/100** | 🟢 **Good for Scripted Demos** |

### High-Level Summary
The Nexus Lending Protocol frontend is a visually polished interface (Score: 85) that utilizes modern UI tokens, clean layouts, and nice charting. However, it suffers from a major identity crisis: **it masquerades as a fully functional Web3 application while containing critical architectural shortcuts, mock overrides, and business logic inconsistencies.**

- **The Good:** Excellent dark-slate visual theme,Outfit/Inter typography, responsive layouts, a highly interactive "Isolated Vault Simulator" slider on the Loan Detail page, and solid visualization charts.
- **The Bad:** It hides transaction telemetry (hashes, block ledgers, contract IDs) from pages like Loan Details. It also hardcodes account balances to static values (`250000 XLM` and `50000 USDC`) upon wallet connection, preventing users from seeing real assets.
- **The Ugly:** **The Lender Dashboard contains a "Claim Settled Funds" button that is completely non-existent in the smart contracts.** In API mode, clicking this button triggers a direct frontend error notification because the contracts transfer funds directly to the lender during repayment. In mock mode, it pretends funds are held in a separate escrow. This is a severe product failure.

---

## Page-by-Page Product Audit

### 1. Landing Page
*   **Purpose:** Introduce users to the Nexus P2P isolated lending protocol, explaining how the TVL and health factor systems work.
*   **Strengths:** Clear separation of concepts (Problem, Solution, Escrow, Health Factor) in individual components.
*   **Weaknesses:** Entirely static. It does not show live protocol statistics (such as TVL, active matches, or average yield rates) queried from the indexer or contracts, making it feel like a static marketing template.
*   **Business Logic Issues:** None directly on the page, but fails to set the context that every loan is a strict 1:1 transaction.
*   **UX Problems:** The Call-to-Action (CTA) redirects instantly to wallet connection without giving the user a quick view of what markets are currently open.
*   **Visual Problems:** Very text-heavy. Needs visual representations of real-time market data.
*   **Blockchain Problems:** No read operations are performed on-chain to display actual stats.
*   **Recommended Improvements:** Query the backend API or Stellar RPC to display live protocol telemetry (real TVL, active lenders, current average APR) directly on the landing hero section.
*   **Priority:** Medium

### 2. Connect Wallet Page
*   **Purpose:** Authenticate the user's browser-based Freighter extension and set up the active session.
*   **Strengths:** Validates if Freighter is installed and warns the user if their extension is not set to Stellar Testnet. Good explanation of Freighter's secure key custody.
*   **Weaknesses:**
    *   **Inconsistency:** The design overhaul document claims that the page features a "Premium Web3 Role Selection" card grid for Borrowers, Lenders, and Liquidators. **The actual code contains no such component.** It is a simple "Connect Wallet" button.
    *   **Hardcoded Assets:** Upon connection, the frontend overrides the user's real balance, setting it to a mock state of `250000 XLM` and `50000 USDC`. This hides the true blockchain state.
*   **Business Logic Issues:** In Web3, users do not "choose roles" at login; a wallet address can perform borrowing, lending, and liquidating actions simultaneously. Having a mock role profile is incorrect.
*   **UX Problems:** Redirects instantly to `/app` once connected, without giving the user a chance to inspect their account details or change their network first.
*   **Visual Problems:** None. Clean card design.
*   **Blockchain Problems:** Balance variables are static mock numbers. It does not perform standard Horizon balance lookups for XLM or Soroban token client queries for the USDC asset contract balance.
*   **Recommended Improvements:** Integrate a standard Stellar SDK request to fetch actual XLM and USDC balances from the connected key. Remove references to "roles" at connection, as keys are multi-role by definition.
*   **Priority:** High

### 3. Dashboard Page (Protocol Telemetry)
*   **Purpose:** Display protocol-wide statistics, TVL growth, status distributions, risk profiles, and recent system activities.
*   **Strengths:** Visually stunning charts. The Health Factor Risk Zone bar chart and Market Allocation pie chart provide good macro overviews.
*   **Weaknesses:**
    *   **Data Inconsistency:** The header shows "Avg Health" based on the *current user's* loans, while the dashboard statistics display "Average Health Factor" based on *all* loans in the system. This causes cognitive mismatch.
    *   **Faked History:** The TVL Growth area chart is generated from a mock history array that multiplies the current TVL by hardcoded scale factors (`0.8`, `0.85`, etc.), which is fake telemetry.
*   **Business Logic Issues:** Shows "TVL" as collateral locked + USDC in offers. But if the oracle XLM price drops, the TVL decreases, which is calculated correctly on-fly, but historical tracking is mock-only.
*   **UX Problems:** The "Recent System Transactions" table displays a user address as `G...` but does not allow clicking it to view the account history on Stellar Expert.
*   **Visual Problems:** The dashboard mixes "protocol health" and "user portfolio metrics" without clear visual separation.
*   **Blockchain Problems:** Transaction log items do not link to their respective `txHash` on-chain.
*   **Recommended Improvements:** Create a clear visual boundary between "My Portfolio Status" and "Protocol Telemetry". Feed the TVL history chart from a proper database time-series index.
*   **Priority:** Medium

### 4. Marketplace Page
*   **Purpose:** List active lending offers for borrowers to explore and accept.
*   **Strengths:** Practical filters (asset, collateral, Sort APR, sliders for maximum APR and duration).
*   **Weaknesses:**
    *   **Misleading Information:** The marketplace table lists a "Risk Rating" column that is hardcoded to a green "SAFE" badge for all items. Offers do not have an active Health Factor (HF only exists once a loan is accepted, collateral is locked, and evaluated against the oracle). Labeling a list of untaken offers as "SAFE" is structurally incorrect.
    *   **Rigid Collateral Input:** Fails to let borrowers know they can deposit *more* than the minimum required collateral to starting-leverage their positions safely.
*   **Business Logic Issues:** None, it correctly filters offers to status `Active` (preventing draft, funding, matched, or cancelled offers from appearing).
*   **UX Problems:** Clicking "Borrow" goes to a new page, but the card view does not display the lender's key or direct details.
*   **Visual Problems:** None. Table and Grid view toggles function properly.
*   **Blockchain Problems:** Hardcoded risk tags.
*   **Recommended Improvements:** Remove the "Risk Rating" column from the untaken offers list. Instead, show a "Minimum Health Factor Expected" value or a "Liquidation Margin" projection.
*   **Priority:** High

### 5. Create Loan Offer Page
*   **Purpose:** Allow lenders to define loan terms and deploy capital offers.
*   **Strengths:** Good side-by-side "Lending Yield & Risk Preview" panel showing projected yield and required collateral based on the live oracle price of XLM.
*   **Weaknesses:**
    *   **Terminology Complexity:** It presents a steep learning curve with terms like "Min Health Factor", "Grace Period", "LTV Limit", and "Liquidation Threshold" in a single long form.
    *   **Discrepancy:** The design audit document describes a "Guided Stepper wizard" (`Loan Details` -> `Risk Config` -> `Deploy Offer` -> `Lock Escrow` -> `Publish`). **The actual form is a single massive card, not a stepper.**
*   **Business Logic Issues:** The deployment requires three separate on-chain actions: `create_offer` (Draft), `fund_offer` (Funding), and `activate_offer` (Active). The UI presents these sequentially after the offer is created, but does not explain *why* or what contract calls are occurring.
*   **UX Problems:** Fails to pre-warn the user that they will need to authorize three distinct Freighter transaction signatures to list an offer.
*   **Visual Problems:** The form is very dense and can intimidate standard DeFi lenders.
*   **Blockchain Problems:** If the user has insufficient USDC, they can still press "Deploy Loan Offer", only to have Freighter fail or the contract panic on-chain.
*   **Recommended Improvements:** Redesign the terms configuration into a true step-by-step wizard. Add a clear explanation of the three-transaction workflow before the user begins, or combine them if possible in future smart contract revisions.
*   **Priority:** Medium

### 6. Borrow Loan Page (Borrow Flow)
*   **Purpose:** Allow a borrower to lock XLM collateral and accept a lender's active USDC offer.
*   **Strengths:** Interactive panel displaying a Health Factor Gauge, simulated LTV ratio, and Estimated Liquidation Price.
*   **Weaknesses:**
    *   **Major Flow Discrepancy:** In the Soroban contracts, borrowing is a two-step process: `accept_offer` (creates loan in `PendingCollateral` state) and `activate_loan` (locks collateral and transfers USDC). Clicking "Confirm" on this page **only executes `accept_offer`** and then navigates the user to the Borrower Dashboard! The loan is left in `PendingCollateral` state, and the user hasn't received their borrowed USDC. They must manually find the loan in their dashboard and click a separate "Activate Loan" button to sign a second transaction.
    *   This is highly counter-intuitive. The borrow page has a big button saying "Verify & Borrow" and a modal saying "Confirm Freighter Signature", but it stops halfway through the process.
*   **Business Logic Issues:** The flow splits a single intent ("I want to borrow this") into two disconnected steps across different pages.
*   **UX Problems:** High friction. Navigating a user to a dashboard to activate a loan they just accepted is bad UX.
*   **Visual Problems:** None. The gauge and risk alerts are visually excellent.
*   **Blockchain Problems:** The two-stage transaction is not linked in a single workflow.
*   **Recommended Improvements:** Automate the transition. Once `accept_offer` succeeds, keep the user on the page (or a specialized loading step) and immediately trigger the Freighter prompt for `activate_loan` in sequence.
*   **Priority:** High

### 7. Loan Detail Page
*   **Purpose:** Detailed specification view of a loan contract.
*   **Strengths:** Outstanding "Isolated Vault Simulator" allowing users to drag the price of XLM and see in real-time how their Health Factor fluctuates and when liquidation triggers.
*   **Weaknesses:**
    *   **Hides Web3 Telemetry:** **It does not display the transaction hash (`txHash`), contract ID, or block ledger anywhere.** A DeFi detail page must show these transparently.
    *   **No Explorer Links:** The "Stellar Expert" integration mentioned in the transaction audit is completely missing on this page. There are no links to view the loan or offer on a block explorer.
*   **Business Logic Issues:** Displays a static checklist for the timeline without matching it against database receipt values.
*   **UX Problems:** The contract ID shown is a simple index (e.g. `1`), not the on-chain Soroban contract hash or identifier.
*   **Visual Problems:** None. The timeline and description grid are clean.
*   **Blockchain Problems:** Complete absence of blockchain metadata rendering, even though the database schema tracks `txHash` and `explorerUrl`.
*   **Recommended Improvements:** Map the database `txHash` and `explorerUrl` fields to the frontend `Loan` and `LoanOffer` types, and display a clickable "View on Stellar Expert" link next to the Contract ID and in each timeline step.
*   **Priority:** High

### 8. Borrower Dashboard
*   **Purpose:** Main workspace for borrowers to manage active loans, add collateral, or repay debt.
*   **Strengths:** Convenient action modals ("Add Collateral Modal", "Repay Debt Modal") and clear status badges.
*   **Weaknesses:**
    *   **Lack of Risk Warnings:** For loans in `Expired` or `Defaulted` status, the dashboard does not clearly warn the user that a defaulted loan is **immediately eligible for liquidation regardless of Health Factor** (Rule DEF-4). A user might see a green Health Factor gauge and think their loan is safe, even if it is defaulted.
*   **Business Logic Issues:** Recalculates LTV and Health Factor correctly, but grace period expirations are not flagged with urgency.
*   **UX Problems:** Modals do not link back to the specific transactions that modified the state.
*   **Visual Problems:** None.
*   **Blockchain Problems:** "Activate Loan" button executes the transaction directly without a confirmation modal explaining that XLM will be locked and USDC drawn.
*   **Recommended Improvements:** Add a high-visibility warning banner for loans that are `Expired` or `Defaulted`, explicitly stating: *"This loan is past its due date. It is eligible for liquidation regardless of its Health Factor. Repay immediately to protect your collateral."*
*   **Priority:** High

### 9. Lender Dashboard
*   **Purpose:** Allow lenders to monitor active offers, outstanding principal, expected yields, and claim settled loans.
*   **Strengths:** Clean grid separating "Loan Offers" (unmatched) and "Lending Contracts Ledger" (matched active loans).
*   **Weaknesses:**
    *   **Broken Business/Smart Contract Logic:** **The dashboard features a "Claim Settled Funds" button for `Repaid` loans.** In the actual Soroban smart contracts, repayments are transferred **directly** from the borrower to the lender's wallet during `partial_repay`/`full_repay` via `collect_repayment_from`. There is no contract method to claim funds.
    *   When a user clicks "Claim Settled Funds" in live API mode, the context method `claimRepayment` returns a hard frontend error: *"Claim repayment is not available because the current Soroban contracts transfer repayment during repay."*
    *   This means in a live environment, this button will fail every single time, presenting a broken interface.
*   **Business Logic Issues:** Mock mode diverges from the smart contracts. In mock mode, the funds are withheld from the lender's balance until they click "Claim Settled Funds" (creating a fictional escrow claim phase).
*   **UX Problems:** Highly confusing. A lender will be left wondering why they must click a button that throws an error, or why they need to claim funds that are already in their wallet.
*   **Visual Problems:** None.
*   **Blockchain Problems:** Tries to invoke a non-existent on-chain action.
*   **Recommended Improvements:** **Completely remove the "Claim Settled Funds" action** from the Lender Dashboard and the `claimRepayment` method. Automatically transition a loan's status to `Closed` (or keep it as `Repaid`) and credit the lender's balance immediately when the borrower pays, aligning the frontend and mock mode directly with the smart contracts.
*   **Priority:** High (Critical)

### 10. Liquidation Center
*   **Purpose:** Let liquidators find stressed loans (HF < 1.2 or Defaulted) and initiate liquidations.
*   **Strengths:** Displays clear statistics (Total Debt at Risk, Est. Arbitrage Profit) and lists close factor metrics.
*   **Weaknesses:**
    *   **Ambiguous Eligibility:** The table does not display *why* a loan is liquidatable (e.g. whether it has breached the 1.2 HF threshold or whether it has defaulted due to expiration).
*   **Business Logic Issues:** Assumes a standard 50% close factor, which matches the contract (`CLOSE_FACTOR_BPS = 5000`), but does not explain it clearly to a general user.
*   **UX Problems:** Both buttons in the table ("Plan Liquidation" and "Liquidate") navigate to the exact same page, which is redundant.
*   **Visual Problems:** None.
*   **Blockchain Problems:** None.
*   **Recommended Improvements:** Add a "Reason for Liquidation" column in the ledger table (e.g., `"Health Factor < 1.20"` or `"Defaulted"`). Consolidate table action buttons.
*   **Priority:** Medium

### 11. Liquidation Detail Page
*   **Purpose:** Plan and execute a partial liquidation on a stressed loan.
*   **Strengths:** Informative calculations showing exact USDC repayment vs. XLM collateral received, and calculating the estimated Health Factor of the loan *after* partial liquidation.
*   **Weaknesses:**
    *   **Lack of Transaction Confirmation:** Once a liquidation is executed, the user is redirected immediately back to the Liquidation Center without displaying a receipt, transaction hash, or a confirmation of the collateral earned.
*   **Business Logic Issues:** Correctly limits repayment to the 50% close factor.
*   **UX Problems:** No input helper to quickly set the repayment amount to the maximum possible value (50%).
*   **Visual Problems:** None.
*   **Blockchain Problems:** Hides transaction hash receipt.
*   **Recommended Improvements:** Add a "Max" button next to the Repay Amount input. After execution, show a detailed "Liquidation Success Receipt" modal displaying the transaction hash, ledger index, and the exact amount of XLM transferred to the liquidator's wallet.
*   **Priority:** Medium

### 12. Oracle Monitor Page (Admin Control Panel)
*   **Purpose:** Simulate and apply price updates to the Oracle smart contract.
*   **Strengths:** Includes a nice recalculation preview showing how the new price will affect all active loans (old HF vs. new HF, risk changes, etc.) before the update is submitted.
*   **Weaknesses:**
    *   **Hardcoded Decimals:** In API mode, it submits the transaction with a hardcoded `decimals: 7` parameter. If the asset price pair uses a different decimal structure, the calculations will break.
*   **Business Logic Issues:** None, but exposes admin functionality in the main user application without role gating.
*   **UX Problems:** Cluttered layout.
*   **Visual Problems:** The recalculation preview table is quite dense.
*   **Blockchain Problems:** Lacks verification of the transaction receipt on-chain for the price update.
*   **Recommended Improvements:** Dynamic decimal resolution from the contract metadata instead of a hardcoded `7`. Expose the transaction hash of the price update.
*   **Priority:** Medium

### 13. Settings Page (System Status)
*   **Purpose:** Display user profile, wallet details, network configuration, and smart contract specifications.
*   **Strengths:** Display Horizon and Soroban RPC statuses visually.
*   **Weaknesses:**
    *   **Fictional Contracts & Hardcoded Addresses:** **The "Soroban Smart Contract Addresses" card displays fake contract names and hardcoded mock addresses.** It lists "Nexus Core Router WASM" (`CDD6...93AE`) and "Escrow Factory Contract" (`CAS7...110B`). The actual deployed contracts are `MarketplaceContract`, `LoanManagerContract`, `VaultContract`, and `OracleContract`.
    *   **Ignores Active Configuration:** It displays static strings instead of loading the active contract IDs from the application's configuration (`CONTRACTS` object in `frontend/src/services/soroban/config.ts`).
*   **Business Logic Issues:** Misleading references to non-existent contracts.
*   **UX Problems:** Users cannot click the contract addresses to view them on Stellar Expert.
*   **Visual Problems:** None.
*   **Blockchain Problems:** Renders fake block data.
*   **Recommended Improvements:** Replace the fictional contract names with the actual deployed contracts (`Marketplace`, `Loan Manager`, `Vault`, `Oracle`). Bind the display fields directly to the `CONTRACTS` and `ASSET_CONTRACTS` constants, and make them click-to-copy and link to Stellar Expert.
*   **Priority:** High

---

## Top 30 Recommended Improvements (Prioritized)

| # | Page / Module | Category | Critique & Description | Priority |
| :--- | :--- | :--- | :--- | :---: |
| **1** | Lender Dashboard | **Business Logic** | **Remove the phantom "Claim Settled Funds" action.** Repayments go directly to the lender's wallet via `collect_repayment_from` in the contract. Remove the button and the backend call completely; credit the lender instantly upon repayment. | **High (Critical)** |
| **2** | Loan Detail | **Web3 / UX** | **Expose transaction hashes and ledger numbers.** Display the `txHash` and ledger of the loan's creation and subsequent actions. | **High** |
| **3** | Loan Detail | **Web3 / UX** | **Add Stellar Expert links.** Make all transaction hashes clickable links leading to `https://stellar.expert/explorer/testnet/tx/{txHash}`. | **High** |
| **4** | Connect Wallet | **Web3 / UX** | **Fetch real wallet balances.** Query the Horizon API and Soroban token contracts to show the user's actual XLM and USDC balances instead of hardcoding `250000 XLM` and `50000 USDC`. | **High** |
| **5** | Borrow Flow | **UX / Flow** | **Automate the accept-to-activation flow.** Instead of accepting an offer (PendingCollateral) and redirecting the borrower to a dashboard to activate it, trigger the `activate_loan` Freighter prompt immediately in sequence. | **High** |
| **6** | Settings | **Business Logic** | **Fix fictional contract names.** Replace "Nexus Core Router" and "Escrow Factory" with the real deployed contracts: `Marketplace`, `Loan Manager`, `Vault`, and `Oracle`. | **High** |
| **7** | Settings | **Web3 / UX** | **Bind actual contract addresses.** Display the active environment contract IDs (`CONTRACTS` and `ASSET_CONTRACTS`) instead of hardcoded mock addresses like `CDD6...93AE`. | **High** |
| **8** | Borrower Dashboard | **UX / Risk** | **Add high-visibility Default Warnings.** Explicitly warn users when a loan is `Expired` or `Defaulted` that it can be liquidated immediately, even if the Health Factor gauge is green. | **High** |
| **9** | Connect Wallet | **UX / Consistency** | **Resolve role-selection discrepancy.** The design documentation claims role cards exist, but the code has none. Align the page with the doc, or remove the role profile description from the audit. | **High** |
| **10** | Marketplace | **Business Logic** | **Remove hardcoded "Risk Rating: SAFE" from offers.** Offers do not have an active Health Factor yet. Replace it with "Min HF Target" or "Liquidation LTV". | **High** |
| **11** | App Layout | **UX / Consistency** | **Standardize Health Factor terms.** Clarify that the header shows the *user's* average health factor, while the dashboard shows the *protocol's* average health factor. | **Medium** |
| **12** | Create Offer | **UX / Flow** | **Implement a true terms-stepper wizard.** Reorganize the dense single-form offer parameters into the step-by-step wizard described in the design spec. | **Medium** |
| **13** | Create Offer | **UX / Flow** | **Explain the three-transaction workflow.** Inform the lender beforehand that listing an offer requires three separate signatures (`create`, `fund`, `activate`). | **Medium** |
| **14** | Borrow Flow | **DeFi UX** | **Allow custom collateral amounts.** Let borrowers type in their desired XLM collateral amount above the minimum to allow them to starting-leverage at a safer Health Factor. | **Medium** |
| **15** | Dashboard | **Business Logic** | **Replace mock TVL history data.** Query or calculate TVL values over time from database entries instead of multiplying current TVL by static ratios. | **Medium** |
| **16** | Liquidation Center | **UX / Flow** | **Consolidate table buttons.** Remove redundant buttons ("Plan Liquidation" and "Liquidate") that lead to the exact same detail view. | **Medium** |
| **17** | Liquidation Detail | **UX / Flow** | **Add "Max" repay helper.** Include a clickable "Max" button next to the USDC repay amount input to quickly set it to the 50% close factor limit. | **Medium** |
| **18** | Liquidation Detail | **DeFi UX** | **Provide an execution receipt.** Show a receipt modal after liquidation confirming the exact amount of USDC repaid and XLM collateral seized. | **Medium** |
| **19** | Liquidation Center | **DeFi UX** | **Expose liquidation eligibility reasons.** Display whether a loan is liquidatable because `HF < 1.2` or because it is `Defaulted`. | **Medium** |
| **20** | Oracle Monitor | **Business Logic** | **Dynamic decimal validation.** Resolve the decimals of the price pair from contract metadata instead of hardcoding `7` in the update transaction. | **Medium** |
| **21** | Settings | **Web3 / UX** | **Make contract addresses copyable.** Add copy-to-clipboard icons next to all deployed smart contract addresses on the settings page. | **Medium** |
| **22** | Dashboard | **UX / Flow** | **Link table addresses.** Make user addresses in the "Recent Transactions" table link to Stellar Expert. | **Medium** |
| **23** | Borrower Dashboard | **UX / Flow** | **Add confirmation modal to Quick Activation.** When a borrower clicks "Activate Loan", show a confirmation modal detailing the XLM about to be locked and USDC drawn. | **Medium** |
| **24** | Settings | **UX / Flow** | **Display actual Horizon RPC.** Bind the "Horizon RPC URL" and "Soroban RPC URL" text fields to the actual `RPC_URL` configured in the environment. | **Low** |
| **25** | Borrower Dashboard | **DeFi UX** | **Maturity Countdown.** Add a "Days Remaining" countdown next to the due date of active loans to make time-risk clearer. | **Low** |
| **26** | Connect Wallet | **UX / Flow** | **Provide network switch guidance.** If the user is on the wrong network, show a visual guide on how to switch their Freighter network settings. | **Low** |
| **27** | Create Offer | **DeFi UX** | **Add APR templates.** Include simple presets (e.g., "Conservative (5% APR)", "Balanced (8% APR)", "Aggressive (12% APR)") to guide lenders. | **Low** |
| **28** | Dashboard | **Visual** | **Distinguish personal and global stats.** Rename the page or widgets to clarify when metrics represent the entire protocol versus the logged-in user. | **Low** |
| **29** | - | **Developer UX** | **Implement a Mock/API toggle.** Place a high-visibility toggle switch in the UI header to easily switch between local Mock data and live Testnet API data. | **Low** |
| **30** | Landing Page | **Visual / UX** | **Add interactive walkthrough.** Build a micro-simulator directly on the landing page showing how isolated vault parameters protect funds. | **Low** |

---

## Hackathon Judge Evaluation
If this project is presented to a hackathon judge, it will perform well on a **surface-level walk-through** because the pages look very professional, the charts render properly, and the Isolated Vault Simulator is highly interactive.

However, a technical judge will find major flaws within **2 minutes** if they look deeper:
1. **The Fictional "Claim Repayment" step:** When testing the lender's flow, clicking "Claim Settled Funds" will throw a direct red error notification in API mode.
2. **Hidden Blockchain Receipts:** The detail page doesn't show any transaction hashes, ledgers, or links to Stellar Expert. For a Stellar/Soroban hackathon, hiding the actual blockchain transaction flow is a major negative.
3. **Hardcoded Balances:** Connecting Freighter doesn't show the user's real balance, making the integration feel half-baked or simulated.
4. **Stepped Wizard Claim:** The Create Offer page does not match the wizard stepper described in the project documentation.

**Verdict:** The protocol's frontend is a beautiful mockup shell that requires immediate refactoring of its core Web3 bindings, mapping of database receipt fields to details pages, and alignment of lender repayment states to match the actual Soroban contracts.
