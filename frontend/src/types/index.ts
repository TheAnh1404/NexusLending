export type UserRole = 'LENDER' | 'BORROWER' | 'LIQUIDATOR';

export type OfferStatus =
  | 'Draft'
  | 'Funding'
  | 'Active'
  | 'Matched'
  | 'Cancelled'
  | 'Expired';

export type LoanStatus =
  | 'PendingCollateral'
  | 'Active'
  | 'Warning'
  | 'LiquidationPlanning'
  | 'Repaid'
  | 'Closed'
  | 'Expired'
  | 'Defaulted'
  | 'Liquidated';

export type RiskZone = 'SAFE' | 'WARNING' | 'LIQUIDATION_PLANNING';

export type TransactionType =
  | 'CONNECT_WALLET'
  | 'CREATE_OFFER'
  | 'FUND_OFFER'
  | 'ACTIVATE_OFFER'
  | 'CANCEL_OFFER'
  | 'EXPIRE_OFFER'
  | 'ACCEPT_OFFER'
  | 'ACTIVATE_LOAN'
  | 'BORROW_LOAN'
  | 'BORROW'
  | 'ADD_COLLATERAL'
  | 'PARTIAL_REPAY'
  | 'FULL_REPAY'
  | 'REPAY'
  | 'UPDATE_ORACLE'
  | 'LIQUIDATE'
  | 'CLAIM_REPAYMENT';

export interface WalletState {
  connected: boolean;
  address: string | null;
  role: UserRole | null;
  balanceXLM: number;
  balanceUSDC: number;
}

export interface LoanOffer {
  id: string;
  contractOfferId?: bigint;
  lender: string;
  amount: number;
  asset: string;
  apr: number;
  duration: number; // in days
  collateralAsset: string;
  maxLTV: number; // in %
  liquidationThreshold: number; // in %
  liquidationBonus: number; // in %
  gracePeriod: number; // in days
  minHealthFactor: number;
  description: string;
  createTime: string;
  status?: OfferStatus;
  acceptedLoanId?: string;
}

export interface Loan {
  id: string;
  contractLoanId?: bigint;
  offerId: string;
  borrower: string;
  lender: string;
  amount: number;
  asset: string;
  apr: number;
  duration: number; // in days
  collateralAsset: string;
  collateralAmount: number;
  outstandingDebt: number; // principal + interest remaining
  maxLTV: number;
  liquidationThreshold: number;
  liquidationBonus: number;
  healthFactor: number;
  status: LoanStatus;
  borrowTime: string;
  dueDate: string;
  minHealthFactor?: number;
  gracePeriod?: number;
  claimedByLender?: boolean;
  closedAt?: string;
}

export interface OraclePrice {
  asset: string;
  price: number;
  lastUpdated: string;
  change24h: number;
  source: string;
}

export interface Transaction {
  id: string;
  timestamp: string;
  type: TransactionType;
  user: string;
  amount: number;
  asset: string;
  details: string;
  loanId?: string;
  offerId?: string;
  txHash?: string;
  explorerUrl?: string;
  contract?: string;
  ledger?: number;
  status?: 'SUCCESS';
  blockTimestamp?: string;
}
