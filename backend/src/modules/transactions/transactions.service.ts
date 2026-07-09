import { Prisma } from '@prisma/client';

import { prisma } from '../../prisma/client';
import type { CreateTransactionInput } from './transactions.schemas';

interface TransactionListQuery {
  wallet?: string;
  relatedWallet?: string;
  type?: string;
  loanId?: string;
  offerId?: string;
}

const normalizeWallet = (wallet?: string): string | undefined => {
  const normalized = wallet?.trim().toUpperCase();
  return normalized || undefined;
};

export const transactionsService = {
  async list(query: TransactionListQuery) {
    const where: Prisma.TransactionWhereInput = {
      type: query.type as never,
      loanId: query.loanId,
      offerId: query.offerId
    };
    const relatedWallet = normalizeWallet(query.relatedWallet);

    if (relatedWallet) {
      const [relatedLoans, relatedOffers] = await Promise.all([
        prisma.loan.findMany({
          where: {
            OR: [
              { borrowerWallet: relatedWallet },
              { lenderWallet: relatedWallet }
            ]
          },
          select: { id: true, offerId: true }
        }),
        prisma.loanOffer.findMany({
          where: { lenderWallet: relatedWallet },
          select: { id: true }
        })
      ]);

      const relatedLoanIds = relatedLoans.map((loan) => loan.id);
      const relatedOfferIds = new Set<string>(relatedOffers.map((offer) => offer.id));
      relatedLoans.forEach((loan) => {
        if (loan.offerId) relatedOfferIds.add(loan.offerId);
      });

      where.OR = [
        { wallet: relatedWallet },
        ...(relatedLoanIds.length > 0 ? [{ loanId: { in: relatedLoanIds } }] : []),
        ...(relatedOfferIds.size > 0 ? [{ offerId: { in: Array.from(relatedOfferIds) } }] : [])
      ];

      return prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' }
      });
    }

    return prisma.transaction.findMany({
      where: {
        ...where,
        wallet: normalizeWallet(query.wallet)
      },
      orderBy: { createdAt: 'desc' }
    });
  },

  async create(input: CreateTransactionInput) {
    const data: Prisma.TransactionUncheckedCreateInput = {
      ...input,
      amount: input.amount ? new Prisma.Decimal(input.amount) : undefined,
      blockTimestamp: input.blockTimestamp,
      metadata: input.metadata as Prisma.InputJsonValue | undefined
    };
    return prisma.transaction.create({ data });
  }
};
