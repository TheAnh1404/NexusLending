import { Prisma } from '@prisma/client';

import { prisma } from '../../prisma/client';
import type { CreateTransactionInput } from './transactions.schemas';

export const transactionsService = {
  async list(query: { wallet?: string; type?: string; loanId?: string; offerId?: string }) {
    return prisma.transaction.findMany({
      where: {
        wallet: query.wallet,
        type: query.type as never,
        loanId: query.loanId,
        offerId: query.offerId
      },
      orderBy: { createdAt: 'desc' }
    });
  },

  async create(input: CreateTransactionInput) {
    const data: Prisma.TransactionUncheckedCreateInput = {
      ...input,
      amount: input.amount ? new Prisma.Decimal(input.amount) : undefined,
      metadata: input.metadata as Prisma.InputJsonValue | undefined
    };
    return prisma.transaction.create({ data });
  }
};

