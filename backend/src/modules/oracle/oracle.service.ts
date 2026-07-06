import { Prisma } from '@prisma/client';

import { prisma } from '../../prisma/client';
import { loansService } from '../loans/loans.service';
import { sorobanService } from '../soroban/soroban.service';
import type { UpsertOraclePriceInput } from './oracle.schemas';

const createMockTxHash = (type: string): string =>
  `mock_${type.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const oracleService = {
  async list() {
    return prisma.oraclePrice.findMany({ orderBy: { updatedAt: 'desc' } });
  },

  async upsert(input: UpsertOraclePriceInput) {
    const sorobanTx = sorobanService.updateOraclePriceTx({
      assetPair: input.assetPair,
      baseAsset: input.baseAsset,
      quoteAsset: input.quoteAsset,
      price: input.price,
      decimals: input.decimals,
      source: input.source
    });

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
        data: {
          txHash: sorobanTx.txHash ?? createMockTxHash('UPDATE_ORACLE'),
          explorerUrl: sorobanTx.explorerUrl,
          type: 'UPDATE_ORACLE',
          wallet: input.wallet ?? 'ORACLE_ADMIN',
          asset: input.baseAsset ?? input.assetPair,
          amount: new Prisma.Decimal(input.price),
          metadata: {
            details: `Updated ${input.assetPair} oracle price to ${input.price}.`,
            contractFunction: sorobanTx.functionName,
            mocked: sorobanTx.mocked
          }
        }
      });

      return price;
    });
  },

  async recalculateHealth() {
    return loansService.recalculateHealth();
  }
};
