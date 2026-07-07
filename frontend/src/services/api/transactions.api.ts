import type { Transaction, TransactionType } from '../../types';
import { apiClient, toNumber } from './client';

interface BackendTransaction {
  id: string;
  txHash: string;
  explorerUrl?: string | null;
  contract?: string | null;
  ledger?: number | null;
  type: string;
  wallet: string;
  offerId?: string | null;
  loanId?: string | null;
  asset?: string | null;
  amount?: string | null;
  status?: string;
  blockTimestamp?: string | null;
  metadata?: {
    details?: string;
  } | null;
  createdAt: string;
}

const normalizeType = (type: string): TransactionType => {
  if (type === 'ORACLE_UPDATE') return 'UPDATE_ORACLE';
  return type as TransactionType;
};

export const mapBackendTransaction = (transaction: BackendTransaction): Transaction => ({
  id: transaction.id,
  timestamp: transaction.createdAt,
  type: normalizeType(transaction.type),
  user: transaction.wallet,
  amount: toNumber(transaction.amount),
  asset: transaction.asset ?? 'USDC',
  details: transaction.metadata?.details ?? `${transaction.type.replace(/_/g, ' ')} transaction`,
  loanId: transaction.loanId ?? undefined,
  offerId: transaction.offerId ?? undefined,
  txHash: transaction.txHash,
  explorerUrl: transaction.explorerUrl ?? undefined,
  contract: transaction.contract ?? undefined,
  ledger: transaction.ledger ?? undefined,
  status: transaction.status === 'SUCCESS' ? 'SUCCESS' : undefined,
  blockTimestamp: transaction.blockTimestamp ?? undefined,
});

export const transactionsApi = {
  async list(): Promise<Transaction[]> {
    const transactions = await apiClient.get<BackendTransaction[]>('/api/transactions');
    return transactions.map(mapBackendTransaction);
  },

  async create(input: Transaction): Promise<Transaction> {
    if (!input.txHash || !input.explorerUrl || !input.ledger || input.status !== 'SUCCESS') {
      throw new Error('Confirmed transaction metadata is required.');
    }
    const transaction = await apiClient.post<BackendTransaction>('/api/transactions', {
      txHash: input.txHash,
      explorerUrl: input.explorerUrl,
      contract: input.contract,
      ledger: input.ledger,
      type: input.type,
      wallet: input.user,
      offerId: input.offerId,
      loanId: input.loanId,
      asset: input.asset,
      amount: String(input.amount),
      status: input.status,
      blockTimestamp: input.blockTimestamp,
      metadata: {
        details: input.details,
      },
    });
    return mapBackendTransaction(transaction);
  },
};
