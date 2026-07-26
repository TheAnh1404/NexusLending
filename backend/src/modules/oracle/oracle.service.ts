import { Prisma } from '@prisma/client';

import { env } from '../../config/env.js';
import { prisma } from '../../prisma/client.js';
import { loansService } from '../loans/loans.service.js';
import { createLedgerTransaction } from '../transactions/chainReceipt.js';
import { verificationService } from '../verification/index.js';
import type { UpsertOraclePriceInput } from './oracle.schemas.js';

export const oracleService = {
  async list() {
    return prisma.oraclePrice.findMany({ orderBy: { updatedAt: 'desc' } });
  },

  async upsert(input: UpsertOraclePriceInput) {
    const verified = await verificationService.verifyAction({
      action: 'oracle_update',
      txHash: input.txHash,
      expectedContractId: env.oracleContractId,
      expectedWallet: input.wallet
    });
    const priceValue = verified.amount ?? new Prisma.Decimal(input.price);

    return prisma.$transaction(async (tx) => {
      const price = await tx.oraclePrice.upsert({
        where: { assetPair: input.assetPair },
        update: {
          baseAsset: input.baseAsset,
          quoteAsset: input.quoteAsset,
          price: priceValue,
          decimals: input.decimals,
          source: input.source,
          updatedAt: verified.transaction.confirmedAt
        },
        create: {
          assetPair: input.assetPair,
          baseAsset: input.baseAsset,
          quoteAsset: input.quoteAsset,
          price: priceValue,
          decimals: input.decimals,
          source: input.source,
          updatedAt: verified.transaction.confirmedAt
        }
      });

      await tx.indexedEvent.upsert({
        where: {
          txHash_eventIndex: {
            txHash: verified.event.txHash,
            eventIndex: verified.event.eventIndex
          }
        },
        create: {
          txHash: verified.event.txHash,
          eventIndex: verified.event.eventIndex,
          ledger: verified.event.ledger,
          contractId: verified.event.contractId,
          eventName: verified.event.eventName,
          actor: verified.event.actor,
          entityType: verified.event.entityType,
          entityId: verified.event.entityId,
          amount: verified.event.amount,
          asset: verified.event.asset,
          network: verified.event.network,
          explorerUrl: verified.event.explorerUrl,
          payload: verified.event.payload
        },
        update: { processedAt: new Date() }
      });

      const transaction = createLedgerTransaction('UPDATE_ORACLE', input.wallet, {
          asset: input.baseAsset ?? input.assetPair,
          amount: priceValue,
          receipt: verified,
          details: `Updated ${input.assetPair} oracle price to ${priceValue.toString()}.`,
          metadata: {
            contractFunction: input.baseAsset && input.quoteAsset ? 'set_price_for_assets' : 'set_price',
            assetPair: input.assetPair
          }
      });
      await tx.transaction.upsert({
        where: { txHash: transaction.txHash },
        create: transaction,
        update: transaction
      });

      return price;
    });
  },

  async recalculateHealth() {
    return loansService.recalculateHealth();
  }
};
