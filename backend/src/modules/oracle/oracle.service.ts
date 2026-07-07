import { Prisma } from '@prisma/client';

import { prisma } from '../../prisma/client';
import { loansService } from '../loans/loans.service';
import { createLedgerTransaction, requireConfirmedReceipt } from '../transactions/chainReceipt';
import type { UpsertOraclePriceInput } from './oracle.schemas';

export const oracleService = {
  async list() {
    return prisma.oraclePrice.findMany({ orderBy: { updatedAt: 'desc' } });
  },

  async upsert(input: UpsertOraclePriceInput) {
    const receipt = requireConfirmedReceipt(input);

    return prisma.$transaction(async (tx) => {
      const price = await tx.oraclePrice.upsert({
        where: { assetPair: input.assetPair },
        update: {
          baseAsset: input.baseAsset,
          quoteAsset: input.quoteAsset,
          price: new Prisma.Decimal(input.price),
          decimals: input.decimals,
          source: input.source,
          updatedAt: input.updatedAt ?? new Date()
        },
        create: {
          assetPair: input.assetPair,
          baseAsset: input.baseAsset,
          quoteAsset: input.quoteAsset,
          price: new Prisma.Decimal(input.price),
          decimals: input.decimals,
          source: input.source,
          updatedAt: input.updatedAt ?? new Date()
        }
      });

      await tx.transaction.create({
        data: createLedgerTransaction('UPDATE_ORACLE', input.wallet, {
          asset: input.baseAsset ?? input.assetPair,
          amount: new Prisma.Decimal(input.price),
          receipt,
          details: `Updated ${input.assetPair} oracle price to ${input.price}.`,
          metadata: {
            contractFunction: input.baseAsset && input.quoteAsset ? 'set_price_for_assets' : 'set_price',
            assetPair: input.assetPair
          }
        })
      });

      return price;
    });
  },

  async recalculateHealth() {
    return loansService.recalculateHealth();
  }
};
