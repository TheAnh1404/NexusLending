import type { Transaction, TransactionType } from '../../types';
import { buildMockTxHash } from '../../utils/format';

interface CreateTransactionInput {
  type: TransactionType;
  user: string;
  amount?: number;
  asset?: string;
  details: string;
  loanId?: string;
  offerId?: string;
}

export const transactionsService = {
  create(input: CreateTransactionInput): Transaction {
    return {
      id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      type: input.type,
      user: input.user,
      amount: input.amount ?? 0,
      asset: input.asset ?? 'USDC',
      details: input.details,
      loanId: input.loanId,
      offerId: input.offerId,
      txHash: buildMockTxHash(input.type.toLowerCase()),
    };
  },
};

