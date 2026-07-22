import { LoanStatus, Prisma, TransactionType } from '@prisma/client';

import { prisma } from '../../prisma/client';
import { MAX_FIXED_APR_BPS } from '../../utils/finance';
import { buildRiskPatch } from '../loans/loans.service';
import { createLedgerTransaction } from '../transactions/chainReceipt';
import { contractReaderService } from '../verification';
import type { NormalizedEvent, VerifiedTransaction } from '../verification';

const transactionTypeForEvent: Record<string, TransactionType> = {
  offer_created: 'CREATE_OFFER',
  offer_funded: 'FUND_OFFER',
  offer_activated: 'ACTIVATE_OFFER',
  offer_cancelled: 'CANCEL_OFFER',
  offer_expired: 'EXPIRE_OFFER',
  offer_matched: 'ACCEPT_OFFER',
  loan_created: 'ACCEPT_OFFER',
  loan_activated: 'ACTIVATE_LOAN',
  collateral_added: 'ADD_COLLATERAL',
  partial_repaid: 'PARTIAL_REPAY',
  loan_repaid: 'FULL_REPAY',
  loan_expired: 'HEALTH_RECALCULATION',
  loan_defaulted: 'HEALTH_RECALCULATION',
  loan_liquidated: 'LIQUIDATE',
  price_updated: 'UPDATE_ORACLE',
};

const loanStatusForEvent: Record<string, LoanStatus> = {
  loan_expired: 'Expired',
  loan_defaulted: 'Defaulted',
  loan_repaid: 'Repaid',
};

const statusFromOnChain = (status: string | undefined): LoanStatus | undefined => {
  if (!status) return undefined;
  const match = [
    'PendingCollateral',
    'Active',
    'Warning',
    'LiquidationPlanning',
    'Repaid',
    'Closed',
    'Expired',
    'Defaulted',
    'Liquidated',
  ].find((item) => status.includes(item));
  return match as LoanStatus | undefined;
};

const dateFromLedgerSeconds = (seconds: number): Date | undefined =>
  seconds > 0 ? new Date(seconds * 1000) : undefined;

const verifiedFromEvent = (event: NormalizedEvent): VerifiedTransaction => ({
  action: 'oracle_update',
  transaction: {
    txHash: event.txHash,
    ledger: event.ledger,
    status: 'SUCCESS',
    network: event.network,
    confirmedAt: event.timestamp,
    raw: event.payload,
  },
  event,
  explorerUrl: event.explorerUrl,
  contractId: event.contractId,
  actor: event.actor,
  offerId: event.offerId,
  loanId: event.loanId,
  amount: event.amount,
  asset: event.asset,
  eventName: event.eventName,
  entityType: event.entityType,
  entityId: event.entityId,
  alreadyProcessed: false,
});

const upsertEventActivity = async (
  tx: Prisma.TransactionClient,
  event: NormalizedEvent,
  wallet: string,
  details: string,
  options: {
    offerId?: string | null;
    loanId?: string;
    asset?: string;
    amount?: Prisma.Decimal;
  } = {}
) => {
  const type = transactionTypeForEvent[event.eventName];
  if (!type) return;

  const data = createLedgerTransaction(type, wallet, {
    offerId: options.offerId,
    loanId: options.loanId,
    asset: options.asset,
    amount: options.amount,
    receipt: verifiedFromEvent(event),
    details,
    metadata: {
      indexedFromEvent: true,
      eventName: event.eventName,
      eventIndex: event.eventIndex,
    },
  });

  await tx.transaction.upsert({
    where: { txHash: data.txHash },
    create: data,
    update: data,
  });
};

const markIndexed = async (tx: Prisma.TransactionClient, event: NormalizedEvent) => {
  await tx.indexedEvent.upsert({
    where: {
      txHash_eventIndex: {
        txHash: event.txHash,
        eventIndex: event.eventIndex,
      },
    },
    create: {
      txHash: event.txHash,
      eventIndex: event.eventIndex,
      ledger: event.ledger,
      contractId: event.contractId,
      eventName: event.eventName,
      actor: event.actor,
      entityType: event.entityType,
      entityId: event.entityId,
      amount: event.amount,
      asset: event.asset,
      network: event.network,
      explorerUrl: event.explorerUrl,
      payload: event.payload,
    },
    update: { processedAt: new Date() },
  });
};

export class EventSyncService {
  async sync(event: NormalizedEvent): Promise<'processed' | 'duplicate' | 'ignored'> {
    const existing = await prisma.indexedEvent.findUnique({
      where: {
        txHash_eventIndex: {
          txHash: event.txHash,
          eventIndex: event.eventIndex,
        },
      },
    });
    if (existing) return 'duplicate';

    if (!transactionTypeForEvent[event.eventName]) {
      await prisma.$transaction(async (tx) => {
        await markIndexed(tx, event);
      });
      return 'ignored';
    }

    await prisma.$transaction(async (tx) => {
      await markIndexed(tx, event);

      if (event.offerId && ['offer_funded', 'offer_activated', 'offer_cancelled', 'offer_expired'].includes(event.eventName)) {
        const status = event.eventName === 'offer_funded'
          ? 'Funding'
          : event.eventName === 'offer_activated'
            ? 'Active'
            : event.eventName === 'offer_cancelled'
              ? 'Cancelled'
              : 'Expired';
        const offer = await tx.loanOffer.update({
          where: { contractOfferId: BigInt(event.offerId) },
          data: {
            status,
            txHash: event.txHash,
            explorerUrl: event.explorerUrl,
            ledger: event.ledger,
            blockTimestamp: event.timestamp,
          },
        }).catch(() => null);
        if (offer) {
          await upsertEventActivity(tx, event, offer.lenderWallet, `${event.eventName} confirmed for offer ${offer.id}.`, {
            offerId: offer.id,
            asset: offer.loanAsset,
            amount: event.amount,
          });
        }
        return;
      }

      if (event.eventName === 'offer_matched' && event.offerId && event.loanId) {
        const offer = await tx.loanOffer.findUnique({
          where: { contractOfferId: BigInt(event.offerId) },
        });
        if (!offer) return;
        if (offer.fixedAprBps > MAX_FIXED_APR_BPS) return;

        const onChainLoan = await contractReaderService.readLoan(event.loanId, event.actor ?? offer.lenderWallet);
        const outstandingDebt = new Prisma.Decimal(onChainLoan.outstandingDebt);
        const collateralAmount = new Prisma.Decimal(onChainLoan.collateralAmount);
        const riskPatch = await buildRiskPatch({
          contractLoanId: event.loanId,
          outstandingDebt,
        }, onChainLoan.borrower);
        const { status: _ignoredStatus, ...riskMetrics } = riskPatch;

        const loan = await tx.loan.upsert({
          where: { contractLoanId: BigInt(event.loanId) },
          create: {
            contractLoanId: BigInt(event.loanId),
            offerId: offer.id,
            contractOfferId: offer.contractOfferId,
            lenderWallet: offer.lenderWallet,
            borrowerWallet: onChainLoan.borrower,
            loanAsset: offer.loanAsset,
            principal: new Prisma.Decimal(onChainLoan.principal),
            outstandingDebt,
            fixedAprBps: offer.fixedAprBps,
            collateralAsset: offer.collateralAsset,
            collateralAmount,
            maxLtvBps: offer.maxLtvBps,
            liquidationThresholdBps: offer.liquidationThresholdBps,
            liquidationBonusBps: offer.liquidationBonusBps,
            minHealthFactorBps: offer.minHealthFactorBps,
            gracePeriodDays: offer.gracePeriodDays,
            status: 'PendingCollateral',
            txHash: event.txHash,
            explorerUrl: event.explorerUrl,
            ledger: event.ledger,
            blockTimestamp: event.timestamp,
            ...riskMetrics,
          },
          update: {
            borrowerWallet: onChainLoan.borrower,
            outstandingDebt,
            collateralAmount,
            txHash: event.txHash,
            explorerUrl: event.explorerUrl,
            ledger: event.ledger,
            blockTimestamp: event.timestamp,
            ...riskMetrics,
          },
        });
        await tx.loanOffer.update({
          where: { id: offer.id },
          data: {
            status: 'Matched',
            txHash: event.txHash,
            explorerUrl: event.explorerUrl,
            ledger: event.ledger,
            blockTimestamp: event.timestamp,
          },
        });
        await upsertEventActivity(tx, event, onChainLoan.borrower, `Accepted offer ${offer.id}; loan ${loan.id} is PendingCollateral.`, {
          offerId: offer.id,
          loanId: loan.id,
          asset: offer.collateralAsset,
          amount: collateralAmount,
        });
        return;
      }

      if (event.loanId && ['loan_activated', 'collateral_added', 'partial_repaid', 'loan_repaid', 'loan_expired', 'loan_defaulted', 'loan_liquidated'].includes(event.eventName)) {
        const loan = await tx.loan.findUnique({
          where: { contractLoanId: BigInt(event.loanId) },
          include: { offer: true },
        });
        if (!loan) return;

        let data: Prisma.LoanUncheckedUpdateInput = {
          txHash: event.txHash,
          explorerUrl: event.explorerUrl,
          ledger: event.ledger,
          blockTimestamp: event.timestamp,
        };

        if (event.eventName === 'loan_repaid') {
          data = {
            ...data,
            outstandingDebt: new Prisma.Decimal(0),
            collateralAmount: new Prisma.Decimal(0),
            healthFactor: new Prisma.Decimal(99.99),
            ltv: new Prisma.Decimal(0),
            riskZone: 'SAFE',
            status: 'Repaid',
            closedAt: event.timestamp,
          };
        } else if (event.eventName === 'loan_expired' || event.eventName === 'loan_defaulted') {
          data = {
            ...data,
            status: loanStatusForEvent[event.eventName],
            riskZone: event.eventName === 'loan_defaulted' ? 'LIQUIDATION_PLANNING' : loan.riskZone,
          };
        } else {
          const onChainLoan = await contractReaderService.readLoan(event.loanId, event.actor ?? loan.borrowerWallet);
          const outstandingDebt = new Prisma.Decimal(onChainLoan.outstandingDebt);
          const collateralAmount = new Prisma.Decimal(onChainLoan.collateralAmount);
          const closedStatus = loanStatusForEvent[event.eventName];
          const onChainStatus = statusFromOnChain(onChainLoan.status);
          const riskPatch = closedStatus
            ? {
                status: closedStatus,
                closedAt: ['Repaid', 'Liquidated'].includes(closedStatus) ? new Date() : undefined,
                healthFactor: closedStatus === 'Repaid' ? new Prisma.Decimal(99.99) : loan.healthFactor,
                ltv: closedStatus === 'Repaid' ? new Prisma.Decimal(0) : loan.ltv,
                riskZone: closedStatus === 'Liquidated' ? 'LIQUIDATION_PLANNING' as const : loan.riskZone,
              }
            : await buildRiskPatch({
                ...loan,
                outstandingDebt,
                dueTime: dateFromLedgerSeconds(onChainLoan.dueTime) ?? loan.dueTime,
              }, onChainLoan.borrower);

          data = {
            ...data,
            outstandingDebt,
            collateralAmount,
            startTime: dateFromLedgerSeconds(onChainLoan.startTime),
            dueTime: dateFromLedgerSeconds(onChainLoan.dueTime),
            ...riskPatch,
            ...(onChainStatus ? { status: onChainStatus } : {}),
          };
        }

        const updated = await tx.loan.update({
          where: { id: loan.id },
          data,
        });
        await upsertEventActivity(tx, event, event.actor ?? loan.borrowerWallet, `${event.eventName} confirmed for loan ${loan.id}.`, {
          offerId: loan.offerId,
          loanId: loan.id,
          asset: event.eventName === 'collateral_added' ? loan.collateralAsset : loan.loanAsset,
          amount: event.amount,
        });
        void updated;
        return;
      }

      if (event.eventName === 'price_updated') {
        await tx.oraclePrice.upsert({
          where: { assetPair: 'XLM/USDC' },
          create: {
            assetPair: 'XLM/USDC',
            baseAsset: 'XLM',
            quoteAsset: 'USDC',
            price: event.amount ?? new Prisma.Decimal(0),
            decimals: 7,
            source: 'Soroban Oracle Event',
            updatedAt: event.timestamp,
          },
          update: {
            price: event.amount ?? new Prisma.Decimal(0),
            decimals: 7,
            source: 'Soroban Oracle Event',
            updatedAt: event.timestamp,
          },
        });
        await upsertEventActivity(tx, event, event.actor ?? 'oracle-admin', 'Oracle price update confirmed from Soroban event.', {
          asset: 'XLM',
          amount: event.amount,
        });
      }
    });

    return 'processed';
  }
}

export const eventSyncService = new EventSyncService();
