import { LoanStatus, Prisma, RiskZone } from '@prisma/client';

import { env } from '../../config/env';
import { prisma } from '../../prisma/client';
import { ApiError } from '../../utils/apiError';
import {
  MAX_FIXED_APR_BPS,
  calculateHealthFactor,
  calculateLTV,
  getRiskZone
} from '../../utils/finance';
import { createLedgerTransaction } from '../transactions/chainReceipt';
import { contractReaderService, verificationService } from '../verification';
import type { OnChainLoan, VerifiedTransaction } from '../verification';
import type { ActivateLoanInput, CreateLoanInput, UpdateLoanInput } from './loans.schemas';

const activeStatuses: LoanStatus[] = [
  'Active',
  'Warning',
  'LiquidationPlanning',
  'Expired',
  'Defaulted'
];

export const DEFAULT_GRACE_PERIOD_DAYS = 7;
const DAY_MS = 86_400_000;

const statusForRiskZone = (riskZone: RiskZone): LoanStatus => {
  if (riskZone === 'SAFE') return 'Active';
  if (riskZone === 'WARNING') return 'Warning';
  return 'LiquidationPlanning';
};

const timeBasedStatusForLoan = (loan: {
  dueTime?: Date | null;
  outstandingDebt?: Prisma.Decimal | string | number;
}): LoanStatus | null => {
  if (!loan.dueTime) return null;
  if (loan.outstandingDebt !== undefined && decimal(loan.outstandingDebt).lte(0)) return null;

  const now = Date.now();
  const dueTime = loan.dueTime.getTime();
  const defaultTime = dueTime + DEFAULT_GRACE_PERIOD_DAYS * DAY_MS;
  if (now > defaultTime) return 'Defaulted';
  if (now > dueTime) return 'Expired';
  return null;
};

const decimal = (value: Prisma.Decimal.Value): Prisma.Decimal => new Prisma.Decimal(value);

const durationDays = (start?: Date | null, due?: Date | null): number => {
  if (!start || !due) return 0;
  return Math.max(0, Math.round((due.getTime() - start.getTime()) / 86_400_000));
};

const contractLoanRef = (loan: { contractLoanId: bigint | number | null; id: string }) =>
  loan.contractLoanId?.toString() ?? loan.id;

const requireVerifiedId = (value: string | undefined, label: string): string => {
  if (!value) throw new ApiError(400, `${label} was not found in verified blockchain event`);
  return value;
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
    'Liquidated'
  ].find((item) => status.includes(item));
  return match as LoanStatus | undefined;
};

const dateFromLedgerSeconds = (seconds: number): Date | undefined =>
  seconds > 0 ? new Date(seconds * 1000) : undefined;

const patchFromOnChainLoan = async (onChainLoan: OnChainLoan) => {
  const status = statusFromOnChain(onChainLoan.status);
  const collateralAmount = new Prisma.Decimal(onChainLoan.collateralAmount);
  const outstandingDebt = new Prisma.Decimal(onChainLoan.outstandingDebt);

  if (status === 'Repaid' || outstandingDebt.lte(0)) {
    return {
      collateralAmount: new Prisma.Decimal(0),
      outstandingDebt: new Prisma.Decimal(0),
      healthFactor: new Prisma.Decimal(99.99),
      ltv: new Prisma.Decimal(0),
      riskZone: 'SAFE' as RiskZone,
      status,
      closedAt: new Date()
    };
  }

  if (status === 'Liquidated') {
    return {
      collateralAmount,
      outstandingDebt,
      healthFactor: outstandingDebt.lte(0) ? new Prisma.Decimal(99.99) : new Prisma.Decimal(0),
      ltv: new Prisma.Decimal(0),
      riskZone: 'LIQUIDATION_PLANNING' as RiskZone,
      status,
      closedAt: new Date()
    };
  }

  const riskPatch = await buildRiskPatch({
    collateralAsset: 'XLM',
    loanAsset: 'USDC',
    collateralAmount,
    outstandingDebt,
    liquidationThresholdBps: onChainLoan.liquidationThresholdBps,
    dueTime: dateFromLedgerSeconds(onChainLoan.dueTime)
  });

  return {
    collateralAmount,
    outstandingDebt,
    startTime: dateFromLedgerSeconds(onChainLoan.startTime),
    dueTime: dateFromLedgerSeconds(onChainLoan.dueTime),
    ...riskPatch,
    ...(status ? { status } : {})
  };
};

const upsertLedgerTransaction = async (
  tx: Prisma.TransactionClient,
  type: Parameters<typeof createLedgerTransaction>[0],
  wallet: string,
  input: Parameters<typeof createLedgerTransaction>[2]
) => {
  const data = createLedgerTransaction(type, wallet, input);
  await tx.transaction.upsert({
    where: { txHash: data.txHash },
    create: data,
    update: data
  });
};

const markVerifiedEventProcessed = async (
  tx: Prisma.TransactionClient,
  verified: VerifiedTransaction
) => {
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
    update: {
      processedAt: new Date()
    }
  });
};

const findPrice = async (collateralAsset: string, loanAsset: string) =>
  prisma.oraclePrice.findFirst({
    where: {
      OR: [
        { baseAsset: collateralAsset, quoteAsset: loanAsset },
        { assetPair: `${collateralAsset}/${loanAsset}` }
      ]
    },
    orderBy: { updatedAt: 'desc' }
  });

export const buildRiskPatch = async (loan: {
  collateralAsset: string;
  loanAsset: string;
  collateralAmount: Prisma.Decimal | string | number;
  outstandingDebt: Prisma.Decimal | string | number;
  liquidationThresholdBps: number;
  dueTime?: Date | null;
}) => {
  const price = await findPrice(loan.collateralAsset, loan.loanAsset);
  if (!price) return {};

  const healthFactor = calculateHealthFactor(
    loan.collateralAmount,
    price.price,
    loan.outstandingDebt,
    1,
    loan.liquidationThresholdBps / 100
  );
  const ltv = calculateLTV(loan.collateralAmount, price.price, loan.outstandingDebt, 1);
  const riskZone = getRiskZone(healthFactor);

  return {
    healthFactor: new Prisma.Decimal(healthFactor),
    ltv: new Prisma.Decimal(ltv),
    riskZone,
    status: timeBasedStatusForLoan(loan) ?? statusForRiskZone(riskZone)
  };
};

const ensureOpenLoan = (loan: { status: LoanStatus }) => {
  if (!activeStatuses.includes(loan.status)) {
    throw new ApiError(400, 'Loan is not active');
  }
};

const syncTimeBasedLoanStatuses = async () => {
  const now = new Date();
  const defaultCutoff = new Date(now.getTime() - DEFAULT_GRACE_PERIOD_DAYS * DAY_MS);

  await prisma.loan.updateMany({
    where: {
      status: { in: activeStatuses },
      outstandingDebt: { lte: new Prisma.Decimal(0) }
    },
    data: {
      status: 'Repaid',
      collateralAmount: new Prisma.Decimal(0),
      healthFactor: new Prisma.Decimal(99.99),
      ltv: new Prisma.Decimal(0),
      riskZone: 'SAFE',
      closedAt: now
    }
  });

  await prisma.loan.updateMany({
    where: {
      status: { in: ['Active', 'Warning', 'LiquidationPlanning', 'Expired'] },
      outstandingDebt: { gt: new Prisma.Decimal(0) },
      dueTime: { lt: defaultCutoff }
    },
    data: {
      status: 'Defaulted',
      riskZone: 'LIQUIDATION_PLANNING'
    }
  });

  await prisma.loan.updateMany({
    where: {
      status: { in: ['Active', 'Warning', 'LiquidationPlanning'] },
      outstandingDebt: { gt: new Prisma.Decimal(0) },
      dueTime: { lt: now, gte: defaultCutoff }
    },
    data: { status: 'Expired' }
  });
};

export const loansService = {
  async list(query: {
    status?: string;
    borrowerWallet?: string;
    lenderWallet?: string;
    riskZone?: string;
  }) {
    await syncTimeBasedLoanStatuses();
    return prisma.loan.findMany({
      where: {
        status: query.status as never,
        borrowerWallet: query.borrowerWallet,
        lenderWallet: query.lenderWallet,
        riskZone: query.riskZone as never
      },
      include: { offer: true },
      orderBy: { createdAt: 'desc' }
    });
  },

  async liquidatable() {
    await syncTimeBasedLoanStatuses();
    return prisma.loan.findMany({
      where: {
        OR: [
          { riskZone: 'LIQUIDATION_PLANNING' },
          { status: 'LiquidationPlanning' },
          { status: 'Defaulted' }
        ]
      },
      include: { offer: true },
      orderBy: { updatedAt: 'desc' }
    });
  },

  async getById(id: string) {
    await syncTimeBasedLoanStatuses();
    const loan = await prisma.loan.findUnique({
      where: { id },
      include: { offer: true }
    });
    if (!loan) throw new ApiError(404, 'Loan not found');
    return loan;
  },

  async activate(id: string, input?: ActivateLoanInput) {
    const loan = await this.getById(id);
    if (loan.status !== 'PendingCollateral') {
      throw new ApiError(400, 'Only PendingCollateral loans can be activated');
    }
    const verified = await verificationService.verifyAction({
      action: 'activate_loan',
      txHash: input?.txHash ?? '',
      expectedContractId: env.loanManagerContractId,
      expectedLoanId: contractLoanRef(loan),
      expectedAmount: loan.outstandingDebt
    });
    if (verified.alreadyProcessed) return this.getById(id);
    const contractLoanId = requireVerifiedId(verified.loanId ?? contractLoanRef(loan), 'contractLoanId');
    const onChainLoan = await contractReaderService.readLoan(contractLoanId, loan.borrowerWallet);

    const riskPatch = await buildRiskPatch(loan);
    if (
      !('healthFactor' in riskPatch) ||
      !(riskPatch.healthFactor instanceof Prisma.Decimal) ||
      !('ltv' in riskPatch) ||
      !(riskPatch.ltv instanceof Prisma.Decimal)
    ) {
      throw new ApiError(400, 'Oracle price not found for collateral pair');
    }

    const minHealthFactor = new Prisma.Decimal(loan.minHealthFactorBps).div(10_000);
    if (riskPatch.healthFactor.lt(minHealthFactor)) {
      throw new ApiError(400, `Initial Health Factor must be at least ${minHealthFactor.toString()}`);
    }

    const maxLtvPercent = new Prisma.Decimal(loan.maxLtvBps).div(100);
    if (riskPatch.ltv.gt(maxLtvPercent)) {
      throw new ApiError(400, 'Collateral below max LTV requirement');
    }

    const now = new Date();
    const termDays = loan.offer?.durationDays ?? durationDays(loan.startTime, loan.dueTime);
    const dueTime = new Date(now.getTime() + termDays * 86_400_000);
    const onChainPatch = await patchFromOnChainLoan(onChainLoan);
    const onChainStartTime = 'startTime' in onChainPatch ? onChainPatch.startTime : undefined;
    const onChainDueTime = 'dueTime' in onChainPatch ? onChainPatch.dueTime : undefined;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.loan.update({
        where: { id },
        data: {
          ...riskPatch,
          ...onChainPatch,
          contractLoanId: BigInt(contractLoanId),
          startTime: onChainStartTime ?? now,
          dueTime: onChainDueTime ?? dueTime,
          txHash: verified.transaction.txHash,
          explorerUrl: verified.explorerUrl,
          ledger: verified.transaction.ledger,
          blockTimestamp: verified.transaction.confirmedAt
        },
        include: { offer: true }
      });

      await markVerifiedEventProcessed(tx, verified);
      await upsertLedgerTransaction(tx, 'ACTIVATE_LOAN', loan.borrowerWallet, {
          offerId: loan.offerId,
          loanId: id,
          asset: loan.loanAsset,
          amount: loan.principal,
          receipt: verified,
          details: `Activated loan ${id}; collateral locked and loan asset transferred to borrower.`,
          metadata: {
            contractFunction: 'activate_loan',
            contractLoanId: contractLoanRef(loan)
          }
      });

      return updated;
    });
  },

  async create(input: CreateLoanInput) {
    const offer = input.offerId
      ? await prisma.loanOffer.findUnique({ where: { id: input.offerId } })
      : null;

    if (input.offerId && !offer) {
      throw new ApiError(404, 'Offer not found');
    }
    if (!offer) {
      throw new ApiError(400, 'Direct loan creation is disabled; submit a verified accept_offer transaction for an active offer');
    }
    if (offer?.status !== 'Active') {
      throw new ApiError(400, 'Offer is not active');
    }
    const fixedAprBps = offer?.fixedAprBps ?? input.fixedAprBps;
    if (fixedAprBps > MAX_FIXED_APR_BPS) {
      throw new ApiError(400, `Loan APR cannot exceed 20% per year (${MAX_FIXED_APR_BPS} bps)`);
    }
    const verified = await verificationService.verifyAction({
      action: 'accept_offer',
      txHash: input.txHash,
      expectedContractId: env.marketplaceContractId,
      expectedOfferId: offer.contractOfferId?.toString() ?? input.contractOfferId?.toString()
    });
    if (verified.alreadyProcessed) {
      const existing = await prisma.loan.findFirst({ where: { offerId: offer.id }, include: { offer: true } });
      if (existing) return existing;
      throw new ApiError(409, 'Accept offer transaction was already processed but no indexed loan exists yet');
    }
    const contractLoanId = requireVerifiedId(verified.loanId, 'contractLoanId');
    const onChainLoan = await contractReaderService.readLoan(contractLoanId, verified.actor ?? input.borrowerWallet);
    if (onChainLoan.borrower === offer.lenderWallet) {
      throw new ApiError(400, 'Borrower cannot accept their own offer');
    }

    const startTime = input.startTime ?? new Date();
    const dueTime =
      input.dueTime ??
      new Date(startTime.getTime() + (offer?.durationDays ?? 0) * 86_400_000);

    const baseData: Prisma.LoanUncheckedCreateInput = {
      contractLoanId: BigInt(contractLoanId),
      offerId: input.offerId,
      contractOfferId: input.contractOfferId ?? offer?.contractOfferId,
      lenderWallet: offer?.lenderWallet ?? input.lenderWallet,
      borrowerWallet: onChainLoan.borrower,
      loanAsset: offer?.loanAsset ?? input.loanAsset,
      principal: new Prisma.Decimal(onChainLoan.principal),
      outstandingDebt: new Prisma.Decimal(onChainLoan.outstandingDebt),
      fixedAprBps,
      collateralAsset: offer?.collateralAsset ?? input.collateralAsset,
      collateralAmount: new Prisma.Decimal(onChainLoan.collateralAmount),
      startTime: input.status && input.status !== 'PendingCollateral' ? startTime : undefined,
      dueTime: input.status && input.status !== 'PendingCollateral' ? dueTime : undefined,
      maxLtvBps: offer?.maxLtvBps ?? input.maxLtvBps,
      liquidationThresholdBps:
        offer?.liquidationThresholdBps ?? input.liquidationThresholdBps,
      liquidationBonusBps: offer?.liquidationBonusBps ?? input.liquidationBonusBps,
      minHealthFactorBps: offer?.minHealthFactorBps ?? input.minHealthFactorBps,
      gracePeriodDays: DEFAULT_GRACE_PERIOD_DAYS,
      txHash: verified.transaction.txHash,
      explorerUrl: verified.explorerUrl,
      ledger: verified.transaction.ledger,
      blockTimestamp: verified.transaction.confirmedAt
    };

    const riskPatch = await buildRiskPatch({
      collateralAsset: baseData.collateralAsset,
      loanAsset: baseData.loanAsset,
      collateralAmount: baseData.collateralAmount as Prisma.Decimal,
      outstandingDebt: baseData.outstandingDebt as Prisma.Decimal,
      liquidationThresholdBps: baseData.liquidationThresholdBps
    });
    const { status: _ignoredStatus, ...riskMetrics } = riskPatch;

    return prisma.$transaction(async (tx) => {
      const loan = await tx.loan.create({
        data: {
          ...baseData,
          ...riskMetrics,
          status: input.status ?? 'PendingCollateral'
        },
        include: { offer: true }
      });

      if (offer) {
        await tx.loanOffer.update({
          where: { id: offer.id },
          data: { status: 'Matched' }
        });
      }

      await markVerifiedEventProcessed(tx, verified);
      await upsertLedgerTransaction(tx, 'BORROW_LOAN', onChainLoan.borrower, {
          offerId: offer?.id,
          loanId: loan.id,
          asset: loan.loanAsset,
          amount: loan.principal,
          receipt: verified,
          details: `Borrowed ${loan.principal.toString()} ${loan.loanAsset} with ${loan.collateralAmount.toString()} ${loan.collateralAsset} collateral.`,
          metadata: {
            contractFunction: 'accept_offer',
            contractLoanId: loan.contractLoanId?.toString()
          }
      });

      return loan;
    });
  },

  async update(id: string, input: UpdateLoanInput) {
    if (input.action) {
      return this.applyAction(id, input);
    }

    throw new ApiError(400, 'Direct loan writes are disabled; submit a confirmed blockchain action');
  },

  async applyAction(id: string, input: UpdateLoanInput) {
    const loan = await this.getById(id);

    if (input.action === 'ADD_COLLATERAL') {
      ensureOpenLoan(loan);
      const verified = await verificationService.verifyAction({
        action: 'add_collateral',
        txHash: input.txHash ?? '',
        expectedContractId: env.loanManagerContractId,
        expectedLoanId: contractLoanRef(loan)
      });
      if (verified.alreadyProcessed) return this.getById(id);
      const amount = verificationService.amountOrThrow(verified);
      const onChainLoan = await contractReaderService.readLoan(contractLoanRef(loan), loan.borrowerWallet);
      const chainPatch = await patchFromOnChainLoan(onChainLoan);

      return prisma.$transaction(async (tx) => {
        const updated = await tx.loan.update({
          where: { id },
          data: {
            ...chainPatch,
            txHash: verified.transaction.txHash,
            explorerUrl: verified.explorerUrl,
            ledger: verified.transaction.ledger,
            blockTimestamp: verified.transaction.confirmedAt
          },
          include: { offer: true }
        });
        await markVerifiedEventProcessed(tx, verified);
        await upsertLedgerTransaction(tx, 'ADD_COLLATERAL', loan.borrowerWallet, {
            loanId: id,
            asset: loan.collateralAsset,
            amount,
            receipt: verified,
            details: `Added ${amount.toString()} ${loan.collateralAsset} collateral to ${id}.`,
            metadata: {
              contractFunction: 'add_collateral',
              contractLoanId: contractLoanRef(loan)
            }
        });
        return updated;
      });
    }

    if (input.action === 'PARTIAL_REPAY' || input.action === 'FULL_REPAY') {
      ensureOpenLoan(loan);
      const action = input.action === 'FULL_REPAY' ? 'full_repay' : 'partial_repay';
      const verified = await verificationService.verifyAction({
        action,
        txHash: input.txHash ?? '',
        expectedContractId: env.loanManagerContractId,
        expectedLoanId: contractLoanRef(loan)
      });
      if (verified.alreadyProcessed) return this.getById(id);
      const repayAmount = verificationService.amountOrThrow(verified);
      if (repayAmount.lte(0)) throw new ApiError(400, 'amount must be greater than zero');
      if (repayAmount.gt(loan.outstandingDebt)) {
        throw new ApiError(400, 'repayment exceeds outstanding debt');
      }

      const isFullRepay = input.action === 'FULL_REPAY';
      const chainPatch = isFullRepay
        ? {
            collateralAmount: new Prisma.Decimal(0),
            outstandingDebt: new Prisma.Decimal(0),
            healthFactor: new Prisma.Decimal(99.99),
            ltv: new Prisma.Decimal(0),
            riskZone: 'SAFE' as RiskZone,
            status: 'Repaid' as LoanStatus,
            closedAt: verified.transaction.confirmedAt
          }
        : await patchFromOnChainLoan(
            await contractReaderService.readLoan(contractLoanRef(loan), loan.borrowerWallet)
          );
      const isClosed = isFullRepay || chainPatch.status === 'Repaid';

      return prisma.$transaction(async (tx) => {
        const updated = await tx.loan.update({
          where: { id },
          data: {
            ...chainPatch,
            txHash: verified.transaction.txHash,
            explorerUrl: verified.explorerUrl,
            ledger: verified.transaction.ledger,
            blockTimestamp: verified.transaction.confirmedAt
          },
          include: { offer: true }
        });
        await markVerifiedEventProcessed(tx, verified);
        await upsertLedgerTransaction(tx, input.action === 'FULL_REPAY' ? 'FULL_REPAY' : 'PARTIAL_REPAY', loan.borrowerWallet, {
            loanId: id,
            asset: loan.loanAsset,
            amount: repayAmount,
            receipt: verified,
            details: isClosed
              ? `Fully repaid ${id}; collateral released.`
              : `Partially repaid ${repayAmount.toString()} ${loan.loanAsset} on ${id}.`,
            metadata: {
              contractFunction: input.action === 'FULL_REPAY' ? 'full_repay' : 'partial_repay',
              contractLoanId: contractLoanRef(loan)
            }
        });
        return updated;
      });
    }

    if (input.action === 'LIQUIDATE') {
      const eligible =
        loan.healthFactor.lt(1.2) ||
        loan.status === 'LiquidationPlanning' ||
        loan.status === 'Defaulted';
      if (!eligible) throw new ApiError(400, 'Loan is not eligible for liquidation');

      const verified = await verificationService.verifyAction({
        action: 'liquidate',
        txHash: input.txHash ?? '',
        expectedContractId: env.loanManagerContractId,
        expectedLoanId: contractLoanRef(loan)
      });
      if (verified.alreadyProcessed) return this.getById(id);
      const amount = verificationService.amountOrThrow(verified);

      const closeFactorAmount = loan.outstandingDebt.mul(0.5);
      const price = await findPrice(loan.collateralAsset, loan.loanAsset);
      if (!price) throw new ApiError(400, 'Oracle price not found for collateral pair');

      const bonusMultiplier = new Prisma.Decimal(1).add(
        new Prisma.Decimal(loan.liquidationBonusBps).div(10_000)
      );
      const maxByCollateral = loan.collateralAmount.mul(price.price).div(bonusMultiplier);
      const maxLiquidationAmount = Prisma.Decimal.min(
        closeFactorAmount,
        loan.outstandingDebt,
        maxByCollateral
      );
      if (amount.gt(maxLiquidationAmount)) {
        throw new ApiError(400, `amount exceeds liquidation limit (${maxLiquidationAmount.toDecimalPlaces(2).toString()})`);
      }

      const collateralReceived = amount.mul(bonusMultiplier).div(price.price);
      const onChainLoan = await contractReaderService.readLoan(contractLoanRef(loan), verified.actor ?? loan.borrowerWallet);
      const chainPatch = await patchFromOnChainLoan(onChainLoan);

      return prisma.$transaction(async (tx) => {
        const updated = await tx.loan.update({
          where: { id },
          data: {
            ...chainPatch,
            txHash: verified.transaction.txHash,
            explorerUrl: verified.explorerUrl,
            ledger: verified.transaction.ledger,
            blockTimestamp: verified.transaction.confirmedAt
          },
          include: { offer: true }
        });
        await markVerifiedEventProcessed(tx, verified);
        await upsertLedgerTransaction(tx, 'LIQUIDATE', verified.actor ?? 'unknown-liquidator', {
            loanId: id,
            asset: loan.loanAsset,
            amount,
            receipt: verified,
            details: `Liquidated ${amount.toString()} ${loan.loanAsset} on ${id}; received ${collateralReceived.toDecimalPlaces(2).toString()} ${loan.collateralAsset}.`,
            metadata: {
              contractFunction: 'liquidate',
              contractLoanId: contractLoanRef(loan)
            }
        });
        return updated;
      });
    }

    if (input.action === 'CLAIM_REPAYMENT') {
      throw new ApiError(400, 'CLAIM_REPAYMENT has no public Soroban contract method yet');
    }

    throw new ApiError(400, 'Unsupported loan action');
  },

  async recalculateHealth() {
    const loans = await prisma.loan.findMany({
      where: { status: { in: activeStatuses } }
    });

    const updated = [];
    for (const loan of loans) {
      const riskPatch = await buildRiskPatch(loan);
      if (Object.keys(riskPatch).length === 0) continue;

      const statusPatch =
        loan.status === 'Defaulted'
          ? { ...riskPatch, status: loan.status }
          : riskPatch;

      updated.push(
        await prisma.loan.update({
          where: { id: loan.id },
          data: statusPatch,
          include: { offer: true }
        })
      );
    }
    return updated;
  }
};
