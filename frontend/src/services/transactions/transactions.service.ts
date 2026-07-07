import type { Transaction, TransactionType } from '../../types';

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
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: input.type,
      user: input.user,
      amount: input.amount ?? 0,
      asset: input.asset ?? 'USDC',
      details: input.details,
      loanId: input.loanId,
      offerId: input.offerId,
    };
  },
};
