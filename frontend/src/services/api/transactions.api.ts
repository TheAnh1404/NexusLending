import type { Transaction, TransactionType } from '../../types';
import { apiClient, toNumber } from './client';

interface BackendTransaction {
  id: string;
  txHash: string;
  explorerUrl?: string | null;
  type: string;
  wallet: string;
  offerId?: string | null;
  loanId?: string | null;
  asset?: string | null;
  amount?: string | null;
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
});

export const transactionsApi = {
  async list(): Promise<Transaction[]> {
    const transactions = await apiClient.get<BackendTransaction[]>('/api/transactions');
    return transactions.map(mapBackendTransaction);
  },

  async create(input: Transaction): Promise<Transaction> {
    const transaction = await apiClient.post<BackendTransaction>('/api/transactions', {
      txHash: input.txHash ?? `frontend_${input.type.toLowerCase()}_${Date.now()}`,
      type: input.type,
      wallet: input.user,
      offerId: input.offerId,
      loanId: input.loanId,
      asset: input.asset,
      amount: String(input.amount),
      metadata: {
        details: input.details,
      },
    });
    return mapBackendTransaction(transaction);
  },
};
