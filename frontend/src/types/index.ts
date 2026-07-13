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

export interface RiskExposureBucket {
  riskZone: RiskZone;
  label: string;
  loanCount: number;
  debtAmount: number;
  collateralValue: number;
  debtSharePct: number;
  avgHealthFactor: number | null;
}

export interface RiskExposureLoan {
  id: string;
  contractLoanId?: string | null;
  reference: string;
  borrowerWallet: string;
  lenderWallet: string;
  status: LoanStatus;
  riskZone: RiskZone;
  healthFactor: number;
  outstandingDebt: number;
  loanAsset: string;
  collateralAmount: number;
  collateralAsset: string;
  collateralValue: number;
  dueTime?: string | null;
}

export type MaturityBucketKey = 'defaulted' | 'grace' | 'due_7d' | 'due_30d' | 'later';

export interface MaturityBucket {
  key: MaturityBucketKey;
  label: string;
  loanCount: number;
  debtAmount: number;
}

export interface MaturityCalendarItem {
  id: string;
  contractLoanId?: string | null;
  reference: string;
  borrowerWallet: string;
  lenderWallet: string;
  status: LoanStatus;
  riskZone: RiskZone;
  healthFactor: number;
  outstandingDebt: number;
  loanAsset: string;
  dueTime: string;
  graceDeadline: string;
  daysUntilDue: number;
  daysPastDue: number;
  bucket: MaturityBucketKey;
  bucketLabel: string;
  recommendedAction: string;
}

export interface DashboardAnalytics {
  generatedAt: string;
  source: 'database';
  hasData: boolean;
  oracleUpdatedAt?: string | null;
  riskExposure: {
    totalDebt: number;
    atRiskDebt: number;
    activeLoanCount: number;
    avgHealthFactor: number;
    buckets: RiskExposureBucket[];
    topRiskLoans: RiskExposureLoan[];
  };
  repaymentCalendar: {
    buckets: MaturityBucket[];
    items: MaturityCalendarItem[];
  };
}
