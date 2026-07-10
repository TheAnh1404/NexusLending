import type { Prisma, TransactionType } from '@prisma/client';

export type VerificationAction =
  | 'create_offer'
  | 'fund_offer'
  | 'activate_offer'
  | 'cancel_offer'
  | 'expire_offer'
  | 'accept_offer'
  | 'activate_loan'
  | 'add_collateral'
  | 'partial_repay'
  | 'full_repay'
  | 'liquidate'
  | 'oracle_update';

export type EntityType = 'offer' | 'loan' | 'oracle' | 'vault' | 'unknown';

export interface VerificationRequest {
  action: VerificationAction;
  txHash: string;
  expectedContractId?: string;
  expectedWallet?: string;
  expectedOfferId?: string;
  expectedLoanId?: string;
  expectedAmount?: Prisma.Decimal.Value;
  expectedAsset?: string;
}

export interface RpcTransaction {
  txHash: string;
  ledger: number;
  status: 'SUCCESS';
  network: string;
  confirmedAt: Date;
  raw: unknown;
}

export interface NormalizedEvent {
  contractId: string;
  ledger: number;
  txHash: string;
  eventIndex: number;
  eventName: string;
  actor?: string;
  offerId?: string;
  loanId?: string;
  amount?: Prisma.Decimal;
  asset?: string;
  timestamp: Date;
  entityType: EntityType;
  entityId?: string;
  network: string;
  explorerUrl: string;
  payload: Prisma.InputJsonValue;
}

export interface VerifiedTransaction {
  action: VerificationAction;
  transaction: RpcTransaction;
  event: NormalizedEvent;
  explorerUrl: string;
  contractId: string;
  actor?: string;
  offerId?: string;
  loanId?: string;
  amount?: Prisma.Decimal;
  asset?: string;
  eventName: string;
  entityType?: EntityType;
  entityId?: string;
  alreadyProcessed: boolean;
}

export interface VerificationTransactionInput {
  txHash?: string;
  explorerUrl?: string;
  ledger?: number;
  status?: string;
  txStatus?: string;
  contractId?: string;
  blockTimestamp?: Date;
  contractReturnValue?: unknown;
}

export interface LedgerTransactionInput {
  offerId?: string | null;
  loanId?: string;
  asset?: string;
  amount?: Prisma.Decimal.Value;
  details: string;
  receipt: VerifiedTransaction | VerificationTransactionInput;
  metadata?: Prisma.InputJsonValue;
  eventName?: string;
  actor?: string;
  entityType?: string;
  entityId?: string;
  network?: string;
}

export interface TransactionActivityData {
  type: TransactionType;
  wallet: string;
  input: LedgerTransactionInput;
}

