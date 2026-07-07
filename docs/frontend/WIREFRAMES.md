# Nexus Frontend Wireframes

ASCII wireframes show target layout and required information placement. `txHash`, ledger, contract ID, and Stellar Expert links must be shown only when real confirmed data exists.

## 1. Landing

```text
+--------------------------------------------------------------------------------+
| Public Header: Nexus | Marketplace | Docs | Security | [Connect Wallet]         |
+--------------------------------------------------------------------------------+
| HERO                                                                           |
| Nexus Lending Protocol                                                        |
| Fixed-rate collateralized P2P lending on Stellar Soroban                       |
| No pools. One lender. One borrower. Escrow-backed offers.                     |
| [Connect Wallet] [View Marketplace]                                            |
|                                                                                |
| Live Protocol Telemetry                                                        |
| +----------------+ +----------------+ +----------------+ +----------------+   |
| | Active Offers  | | Active Loans   | | Collateral     | | XLM Oracle     |   |
| | from API/chain | | from indexer   | | locked value   | | price + age    |   |
| +----------------+ +----------------+ +----------------+ +----------------+   |
+--------------------------------------------------------------------------------+
| How It Works                                                                   |
| Lender creates offer -> funds Vault -> activates listing -> borrower accepts   |
| -> borrower activates loan -> repay/rescue/liquidate based on HF               |
+--------------------------------------------------------------------------------+
| Recent Confirmed Transactions                                                  |
| Type | txHash        | Ledger | Contract | Stellar Expert                      |
| ---- | ------------- | ------ | -------- | ----------------------------------- |
| ...  | abcd...1234   | 123456 | CCJU...  | [View on Stellar Expert]            |
+--------------------------------------------------------------------------------+
```

## 2. Dashboard

```text
+--------------------------------------------------------------------------------+
| Sidebar                 | Header: Breadcrumbs | Testnet | Wallet | Tx Status   |
| Dashboard               +------------------------------------------------------+
| Marketplace             | Nexus Protocol Telemetry                  [Oracle]   |
| Create Offer            | +-----------+ +-----------+ +-----------+ +-------+  |
| My Loans                | | TVL*      | | Borrowed  | | Collateral| | Avg HF|  |
| Lending                 | +-----------+ +-----------+ +-----------+ +-------+  |
| Borrowing               | *TVL = locked collateral + funded offer principal    |
| Liquidation Center      |                                                      |
| Oracle Monitor          | +-----------------------+ +-----------------------+  |
| Transactions            | | Status Allocation     | | Health Factor Zones   |  |
| Settings                | | Active/Funding/etc.   | | Safe/Warning/LP       |  |
|                         | +-----------------------+ +-----------------------+  |
|                         |                                                      |
|                         | Recent Confirmed Transactions                       |
|                         | Type | Wallet | txHash | Ledger | Contract | Link   |
|                         | ...  | G...   | ...    | ...    | CC...    | Expert |
+--------------------------------------------------------------------------------+
```

## 3. Marketplace

```text
+--------------------------------------------------------------------------------+
| Lending Marketplace                                      [Create Offer]        |
| Browse active funded offers only. Offers do not have Health Factor yet.        |
+--------------------------------------------------------------------------------+
| Filters: Search Offer/Lender | Loan Asset | Collateral | APR | Duration | View |
+--------------------------------------------------------------------------------+
| Offer Card                                                                      |
| +--------------------------------+  +--------------------------------+         |
| | Offer #12 / contractOfferId    |  | Offer #13 / contractOfferId    |         |
| | Principal: 5,000 USDC          |  | Principal: 10,000 USDC         |         |
| | APR: 8.0% fixed | 60 days      |  | APR: 9.5% fixed | 90 days      |         |
| | Max LTV: 60%                  |  | Max LTV: 55%                  |         |
| | Min HF required: 1.40          |  | Min HF required: 1.50          |         |
| | Funding proof                  |  | Funding proof                  |         |
| | txHash: abcd...1234 [copy]     |  | txHash: Not indexed yet        |         |
| | Ledger: 123456                 |  | Ledger: -                      |         |
| | [View on Stellar Expert]       |  | [No confirmed tx recorded]     |         |
| | Risk: calculated in borrow sim |  | Risk: calculated in borrow sim |         |
| | [Offer Details] [Borrow]       |  | [Offer Details] [Borrow]       |         |
| +--------------------------------+  +--------------------------------+         |
+--------------------------------------------------------------------------------+
```

## 4. Create Offer

```text
+--------------------------------------------------------------------------------+
| Create Offer                                                                    |
| Define terms, then complete three confirmed Soroban transactions.              |
+--------------------------------------------------------------------------------+
| Stepper: [1 Terms] -> [2 Create Draft] -> [3 Fund Vault] -> [4 Activate]       |
+--------------------------------------------------------------------------------+
| Terms Form                                 | Live Preview                       |
| +----------------------------------------+ | +--------------------------------+ |
| | Loan asset: USDC                       | | Principal: 5,000 USDC          | |
| | Amount: [          ]                   | | Fixed APR: 8.0%                | |
| | APR: [     ] Duration: [     ]         | | Interest: +65.75 USDC         | |
| | Collateral: XLM                        | | Required collateral estimate   | |
| | Max LTV: [ ] Liquidation threshold [ ] | | Min HF required: 1.40          | |
| | Liquidation bonus [ ] Grace [ ]        | | Oracle: XLM/USDC 0.125        | |
| | Min HF [1.40]                          | +--------------------------------+ |
| | [Create Draft Offer]                   |                                    |
| +----------------------------------------+                                    |
+--------------------------------------------------------------------------------+
| Transaction Receipts                                                             |
| +----------------+ +----------------+ +----------------+                      |
| | create_offer   | | fund_offer     | | activate_offer |                      |
| | status SUCCESS | | status pending | | status locked  |                      |
| | txHash ...     | | txHash -       | | txHash -       |                      |
| | Ledger ...     | | Ledger -       | | Ledger -       |                      |
| | Contract CCJU  | | Contract CCJU  | | Contract CCJU  |                      |
| | [Expert]       | |                | |                |                      |
| +----------------+ +----------------+ +----------------+                      |
+--------------------------------------------------------------------------------+
```

## 5. Borrow Flow

```text
+--------------------------------------------------------------------------------+
| Borrow From Offer #12                                                           |
| Two required chain steps: accept_offer, then activate_loan.                    |
+--------------------------------------------------------------------------------+
| Offer Terms                         | Collateral Input                         |
| +---------------------------------+ | +--------------------------------------+ |
| | Principal: 5,000 USDC           | | Wallet XLM: real balance             | |
| | APR: 8.0% fixed                 | | Collateral amount: [ 70000 ] XLM     | |
| | Duration: 60 days               | | Min required: 66667 XLM              | |
| | Lender: GABC...XYZ              | | [Preview HF/LTV]                     | |
| | contractOfferId: 12             | +--------------------------------------+ |
| +---------------------------------+ | Health / Risk                          |
|                                     | +--------------------------------------+ |
|                                     | | HF Gauge: 1.52 SAFE                  | |
|                                     | | LTV: 52.4% | Max LTV: 60%           | |
|                                     | | Liquidation price: 0.096 USDC       | |
|                                     | +--------------------------------------+ |
+--------------------------------------------------------------------------------+
| Transaction Flow                                                                |
| Step 1 accept_offer        txHash: abcd...1234 Ledger: 123456 [Expert]         |
| Step 2 activate_loan       txHash: pending      Ledger: -      [Sign Next]     |
| [Accept Offer] [Activate Loan] [Resume Activation if PendingCollateral]        |
+--------------------------------------------------------------------------------+
```

## 6. Loan Detail

```text
+--------------------------------------------------------------------------------+
| Loan Detail #42                           Status: Active | HF 1.48 SAFE        |
| contractLoanId: 42 | Loan Manager: CCFR... | [View Latest Tx on Expert]       |
+--------------------------------------------------------------------------------+
| Core Loan State                         | Health And Risk                      |
| +-------------------------------------+ | +----------------------------------+ |
| | Borrower: GBOR...                   | | HF Gauge                          | |
| | Lender: GLEN...                     | | Current HF: 1.48                  | |
| | Principal: 5,000 USDC               | | LTV: 54.1%                        | |
| | Outstanding debt: 5,065.75 USDC     | | Threshold: 75%                    | |
| | Collateral: 70,000 XLM              | | Oracle: XLM/USDC 0.125            | |
| | Due date: 2026-09-05                | +----------------------------------+ |
| +-------------------------------------+                                      |
+--------------------------------------------------------------------------------+
| Actions (wallet and status gated)                                               |
| Borrower: [Add Collateral] [Partial Repay] [Full Repay]                         |
| Liquidator when HF < 1.2 or Defaulted: [Liquidate]                              |
| PendingCollateral borrower only: [Activate Loan]                                |
+--------------------------------------------------------------------------------+
| Receipt Timeline                                                                |
| Event              txHash       Ledger  Contract   Stellar Expert              |
| ACCEPT_OFFER       abcd...1234  123456  CCJU...    [View]                      |
| ACTIVATE_LOAN      bcde...2345  123470  CCFR...    [View]                      |
| ADD_COLLATERAL     Not indexed yet                                             |
| PARTIAL_REPAY      -                                                             |
+--------------------------------------------------------------------------------+
```

## 7. Lender Dashboard

```text
+--------------------------------------------------------------------------------+
| Lending                                                              [Create]   |
| Monitor offers and loans. Repayments arrive directly during repay tx.           |
+--------------------------------------------------------------------------------+
| Stats: Active Principal | Expected Interest | Active Offers | Settled Received |
+--------------------------------------------------------------------------------+
| Loan Offers                                                                      |
| Offer | Status  | Principal | Latest txHash | Ledger | Actions                |
| #12   | Draft   | 5,000     | abcd...1234   | 123456 | [Fund] [Cancel]       |
| #13   | Funding | 10,000    | bcde...2345   | 123470 | [Activate] [Cancel]   |
| #14   | Active  | 3,000     | cdef...3456   | 123490 | [Details] [Cancel]    |
+--------------------------------------------------------------------------------+
| Lent Loans                                                                       |
| Loan | Borrower | Debt | HF | Status | Latest Receipt | Actions               |
| #42  | G...     | 5k   |1.4 | Active | ACTIVATE_LOAN  | [Loan Detail]         |
| #43  | G...     | 0    |N/A | Repaid | FULL_REPAY [Expert] | Repayment received |
|                                                                            |
| Forbidden: no "Claim Settled Funds" button.                                  |
+--------------------------------------------------------------------------------+
```

## 8. Borrower Dashboard

```text
+--------------------------------------------------------------------------------+
| Borrowing                                                                        |
| Manage PendingCollateral, active debt, rescue, and repayments.                  |
+--------------------------------------------------------------------------------+
| Stats: Open Loans | Outstanding Debt | Collateral Value | Average HF | Next Due |
+--------------------------------------------------------------------------------+
| PendingCollateral Queue                                                          |
| Loan #41 | Offer #12 | Collateral planned 70,000 XLM | [Activate Loan]        |
| Accept txHash: abcd...1234 [Expert]                                             |
+--------------------------------------------------------------------------------+
| Active Borrowed Loans                                                            |
| +-------------------------------------+ +-------------------------------------+ |
| | Loan #42 Active                     | | Loan #44 Warning                    | |
| | Debt 5,065.75 USDC                  | | Debt 2,020.00 USDC                  | |
| | Collateral 70,000 XLM               | | Collateral 20,000 XLM               | |
| | HF Gauge 1.48 SAFE                  | | HF Gauge 1.28 WARNING               | |
| | Latest txHash bcde...2345 [Expert]  | | Latest txHash cdef...3456 [Expert]  | |
| | [Add Collateral] [Repay] [Detail]   | | [Add Collateral] [Repay] [Detail]   | |
| +-------------------------------------+ +-------------------------------------+ |
+--------------------------------------------------------------------------------+
```

## 9. Liquidation Center

```text
+--------------------------------------------------------------------------------+
| Liquidation Center                                                              |
| Eligible when HF < 1.2 or status is Defaulted. Close factor max is 50%.         |
+--------------------------------------------------------------------------------+
| Stats: Liquidatable | Debt At Risk | Est Bonus | Avg Stressed HF | Oracle Age   |
+--------------------------------------------------------------------------------+
| Stressed Positions                                                              |
| Loan | Borrower | Debt | Collateral | HF | Max Repay | Bonus | Latest tx | Act |
| #55  | G...     | 9k   | 80k XLM    |1.0 | 4.5k      | 5%    | ...[Exp] | Plan|
| #56  | G...     | 2k   | 12k XLM    |Defaulted     | 1k | 5% | ...[Exp] | Plan|
+--------------------------------------------------------------------------------+
```

## 10. Oracle Monitor

```text
+--------------------------------------------------------------------------------+
| Oracle Monitor                                                                  |
| Current Pair: XLM/USDC | Oracle Contract: CC422... | Admin: connected?         |
+--------------------------------------------------------------------------------+
| Price Status                         | Admin Update                             |
| +----------------------------------+ | +--------------------------------------+ |
| | Current price: 0.1250000 USDC    | | New price: [ 0.1100000 ]             | |
| | Decimals: 7                      | | Decimals: [7] Source: [Nexus Admin]  | |
| | Last updated: 2026-07-07 ...     | | [Update Oracle Price]               | |
| | Stale: No                        | +--------------------------------------+ |
| +----------------------------------+                                        |
+--------------------------------------------------------------------------------+
| Transaction Receipt                                                             |
| set_price_for_assets | txHash abcd...1234 | Ledger 123456 | [Expert]          |
+--------------------------------------------------------------------------------+
| Affected Loans Preview                                                          |
| Loan | Old HF | New HF | Old Risk | New Risk | Status after backend recalc     |
| #42  | 1.48   | 1.21   | SAFE     | WARNING  | Warning                         |
| #44  | 1.28   | 1.05   | WARNING  | LP       | LiquidationPlanning             |
+--------------------------------------------------------------------------------+
```

## 11. Settings

```text
+--------------------------------------------------------------------------------+
| Settings                                                                        |
| Wallet, network, real deployed contracts, preferences.                         |
+--------------------------------------------------------------------------------+
| Wallet                                 | Network                                |
| +------------------------------------+ | +------------------------------------+ |
| | Address: GABC... [copy] [Expert]   | | Network: Stellar Testnet            | |
| | XLM balance: real/loading          | | Soroban RPC: configured URL         | |
| | USDC balance: real/loading         | | Backend API: healthy/unhealthy      | |
| | [Disconnect]                       | | Contract config source: env/deploy  | |
| +------------------------------------+ +------------------------------------+ |
+--------------------------------------------------------------------------------+
| Contract Registry                                                               |
| Name          Contract ID                                      Explorer         |
| Marketplace   CCJU3F3JVRIFGVHH... [copy]                      [Expert]         |
| Loan Manager  CCFRNV7GOPQLCGEB... [copy]                      [Expert]         |
| Vault         CBKXH5LDMFZSNRUB... [copy]                      [Expert]         |
| Oracle        CC422QRYLZGQO4DL... [copy]                      [Expert]         |
| XLM Asset     native contract ID... [copy]                    [Expert]         |
| USDC Asset    configured contract ID or missing warning        [Expert]         |
+--------------------------------------------------------------------------------+
| Recent Transactions                                                             |
| Type | txHash | Ledger | Contract | Stellar Expert                              |
| ...  | ...    | ...    | ...      | [View]                                      |
| [Open Full Transaction History]                                                 |
+--------------------------------------------------------------------------------+
```
