import { LoanStatus, Prisma, RiskZone } from '@prisma/client';

import { env } from '../../config/env';
import { prisma } from '../../prisma/client';
import { ApiError } from '../../utils/apiError';
import {
  MAX_FIXED_APR_BPS,
} from '../../utils/finance';
import { createLedgerTransaction, requireConfirmedReceipt } from '../transactions/chainReceipt';
import {
  contractReaderService,
  explorerService,
  transactionVerifierService,
  verificationService,
  WrongAmountError,
  WrongContractError,
  WrongNetworkError,
  WrongWalletError,
} from '../verification';
import type { OnChainLoan, VerificationTransactionInput, VerifiedTransaction } from '../verification';
import type { ActivateLoanInput, CreateLoanInput, SyncLoanInput, UpdateLoanInput } from './loans.schemas';

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

const riskZoneFromHealthFactorBps = (healthFactorBps: number): RiskZone => {
  if (healthFactorBps >= 14_000) return 'SAFE';
  if (healthFactorBps >= 12_000) return 'WARNING';
  return 'LIQUIDATION_PLANNING';
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

const requireAvailableContractLoanId = (
  value: string | bigint | number | null | undefined,
): string => {
  if (value === undefined || value === null) {
    throw new ApiError(400, 'Loan is missing contractLoanId and cannot be activated on-chain');
  }
  return String(value);
};

const isHardVerificationMismatch = (error: unknown): boolean =>
  error instanceof WrongAmountError ||
  error instanceof WrongContractError ||
  error instanceof WrongNetworkError ||
  error instanceof WrongWalletError;

const isEventParsingFallback = (error: unknown): boolean => {
  if (!(error instanceof ApiError)) return true;
  return error.message.startsWith('Transaction does not contain the expected event') ||
    error.message.includes('was not found in verified blockchain event') ||
    error.message.includes('did not include an amount');
};

const fallbackLoanReceipt = async (
  input: { txHash?: string } | undefined,
  contractLoanId: string,
  verificationError: unknown,
): Promise<VerificationTransactionInput> => {
  if (isHardVerificationMismatch(verificationError) || !isEventParsingFallback(verificationError)) {
    throw verificationError;
  }

  const transaction = await transactionVerifierService.verifyTransaction(input?.txHash ?? '');
  const warning = verificationError instanceof Error ? verificationError.message : String(verificationError);

  return {
    txHash: transaction.txHash,
    explorerUrl: explorerService.getTransactionUrl(transaction.txHash),
    ledger: transaction.ledger,
    txStatus: transaction.status,
    contractId: env.loanManagerContractId,
    blockTimestamp: transaction.confirmedAt,
    contractReturnValue: {
      contractLoanId,
      verificationWarning: warning,
    },
  };
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

const validateOnChainLoanIdentity = (
  onChainLoan: OnChainLoan,
  expected: { contractLoanId: string; borrowerWallet: string },
) => {
  if (onChainLoan.loanId !== expected.contractLoanId) {
    throw new ApiError(400, `On-chain loan id ${onChainLoan.loanId} does not match expected loan id ${expected.contractLoanId}`);
  }
  if (onChainLoan.borrower !== expected.borrowerWallet) {
    throw new ApiError(400, 'On-chain loan borrower does not match the persisted borrower');
  }
};

const inferRepayAmountFromChain = (
  loan: { outstandingDebt: Prisma.Decimal | string | number },
  onChainLoan: OnChainLoan,
  requestedAmount?: Prisma.Decimal.Value,
): Prisma.Decimal => {
  const beforeDebt = decimal(loan.outstandingDebt);
  const afterDebt = decimal(onChainLoan.outstandingDebt);
  const delta = beforeDebt.minus(afterDebt).toDecimalPlaces(7);
  if (delta.gt(0)) return delta;

  if (requestedAmount !== undefined) {
    const requested = decimal(requestedAmount).toDecimalPlaces(7);
    if (requested.gt(0)) return Prisma.Decimal.min(requested, beforeDebt).toDecimalPlaces(7);
  }

  throw new ApiError(400, 'Repayment transaction was confirmed but backend could not infer the repaid amount from on-chain state');
};

const patchAfterRepayment = async (
  onChainLoan: OnChainLoan,
  confirmedAt: Date,
): Promise<Prisma.LoanUncheckedUpdateInput> => {
  const onChainStatus = statusFromOnChain(onChainLoan.status);
  const outstandingDebt = new Prisma.Decimal(onChainLoan.outstandingDebt);

  if (onChainStatus === 'Repaid' || outstandingDebt.lte(0)) {
    return {
      collateralAmount: new Prisma.Decimal(0),
      outstandingDebt: new Prisma.Decimal(0),
      healthFactor: new Prisma.Decimal(99.99),
      ltv: new Prisma.Decimal(0),
      riskZone: 'SAFE' as RiskZone,
      status: 'Repaid' as LoanStatus,
      closedAt: confirmedAt,
    };
  }

  try {
    return await patchFromOnChainLoan(onChainLoan);
  } catch (error) {
    console.warn(`Unable to read repayment risk metrics for contract loan ${onChainLoan.loanId}:`, error);
    return {
      collateralAmount: new Prisma.Decimal(onChainLoan.collateralAmount),
      outstandingDebt,
      ...(onChainStatus ? { status: onChainStatus } : {}),
    };
  }
};

type ChainRecoverableLoan = Awaited<ReturnType<typeof prisma.loan.findMany>>[number];

const decimalPatchChanged = (
  loan: ChainRecoverableLoan,
  patch: Record<string, unknown>,
  field: 'collateralAmount' | 'outstandingDebt' | 'healthFactor' | 'ltv',
): boolean => {
  const value = patch[field];
  if (value === undefined) return false;
  return !decimal(loan[field]).eq(value as Prisma.Decimal.Value);
};

const datePatchChanged = (
  loan: ChainRecoverableLoan,
  patch: Record<string, unknown>,
  field: 'startTime' | 'dueTime' | 'closedAt',
): boolean => {
  const value = patch[field];
  if (value === undefined) return false;
  const current = loan[field]?.getTime() ?? null;
  const next = value instanceof Date ? value.getTime() : null;
  return current !== next;
};

const chainPatchChanged = (
  loan: ChainRecoverableLoan,
  patch: Prisma.LoanUncheckedUpdateInput,
): boolean => {
  const data = patch as Record<string, unknown>;
  return (
    (data.status !== undefined && data.status !== loan.status) ||
    (data.riskZone !== undefined && data.riskZone !== loan.riskZone) ||
    decimalPatchChanged(loan, data, 'collateralAmount') ||
    decimalPatchChanged(loan, data, 'outstandingDebt') ||
    decimalPatchChanged(loan, data, 'healthFactor') ||
    decimalPatchChanged(loan, data, 'ltv') ||
    datePatchChanged(loan, data, 'startTime') ||
    datePatchChanged(loan, data, 'dueTime') ||
    datePatchChanged(loan, data, 'closedAt')
  );
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
    contractLoanId: onChainLoan.loanId,
    outstandingDebt,
    dueTime: dateFromLedgerSeconds(onChainLoan.dueTime)
  }, onChainLoan.borrower);

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

export const buildRiskPatch = async (loan: {
  contractLoanId?: bigint | number | string | null;
  outstandingDebt: Prisma.Decimal | string | number;
  dueTime?: Date | null;
}, sourceAccount?: string) => {
  if (!loan.contractLoanId) return {};

  const risk = await contractReaderService.readLoanRisk(loan.contractLoanId, sourceAccount);
  const riskZone = riskZoneFromHealthFactorBps(risk.healthFactorBps);

  return {
    healthFactor: new Prisma.Decimal(risk.healthFactor),
    ltv: new Prisma.Decimal(risk.ltv),
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

  async syncChain(id: string, input?: SyncLoanInput) {
    const loan = await this.getById(id);
    const contractLoanId = requireAvailableContractLoanId(loan.contractLoanId);
    const onChainLoan = await contractReaderService.readLoan(contractLoanId, input?.wallet ?? loan.borrowerWallet);
    validateOnChainLoanIdentity(onChainLoan, {
      contractLoanId,
      borrowerWallet: loan.borrowerWallet,
    });

    const chainPatch = await patchAfterRepayment(onChainLoan, loan.closedAt ?? new Date());
    return prisma.loan.update({
      where: { id },
      data: chainPatch,
      include: { offer: true }
    });
  },

  async recoverChain(input?: SyncLoanInput) {
    await syncTimeBasedLoanStatuses();
    const loans = await prisma.loan.findMany({
      where: { contractLoanId: { not: null } },
      orderBy: { createdAt: 'desc' }
    });

    const results: Array<{
      loanId: string;
      contractLoanId: string;
      previousStatus: LoanStatus;
      status?: LoanStatus;
      previousOutstandingDebt: string;
      outstandingDebt?: string;
      previousCollateralAmount: string;
      collateralAmount?: string;
      recovered: boolean;
      error?: string;
    }> = [];

    for (const loan of loans) {
      const contractLoanId = requireAvailableContractLoanId(loan.contractLoanId);
      try {
        const onChainLoan = await contractReaderService.readLoan(contractLoanId, input?.wallet ?? loan.borrowerWallet);
        validateOnChainLoanIdentity(onChainLoan, {
          contractLoanId,
          borrowerWallet: loan.borrowerWallet,
        });

        const chainPatch = await patchAfterRepayment(onChainLoan, loan.closedAt ?? new Date());
        const recovered = chainPatchChanged(loan, chainPatch);
        const updated = recovered
          ? await prisma.loan.update({
              where: { id: loan.id },
              data: chainPatch,
              include: { offer: true }
            })
          : loan;

        results.push({
          loanId: loan.id,
          contractLoanId,
          previousStatus: loan.status,
          status: updated.status,
          previousOutstandingDebt: loan.outstandingDebt.toString(),
          outstandingDebt: updated.outstandingDebt.toString(),
          previousCollateralAmount: loan.collateralAmount.toString(),
          collateralAmount: updated.collateralAmount.toString(),
          recovered,
        });
      } catch (error) {
        results.push({
          loanId: loan.id,
          contractLoanId,
          previousStatus: loan.status,
          previousOutstandingDebt: loan.outstandingDebt.toString(),
          previousCollateralAmount: loan.collateralAmount.toString(),
          recovered: false,
          error: error instanceof Error ? error.message : 'Unknown recovery error',
        });
      }
    }

    return {
      scanned: results.length,
      recovered: results.filter((result) => result.recovered).length,
      unchanged: results.filter((result) => !result.recovered && !result.error).length,
      failed: results.filter((result) => Boolean(result.error)).length,
      results,
    };
  },

  async activate(id: string, input?: ActivateLoanInput) {
    const loan = await this.getById(id);
    if (loan.status !== 'PendingCollateral') {
      throw new ApiError(400, 'Only PendingCollateral loans can be activated');
    }
    const expectedContractLoanId = requireAvailableContractLoanId(input?.contractLoanId ?? loan.contractLoanId);
    if (loan.contractLoanId && input?.contractLoanId && loan.contractLoanId.toString() !== String(input.contractLoanId)) {
      throw new ApiError(400, `Returned contractLoanId ${String(input.contractLoanId)} does not match persisted loan id ${loan.contractLoanId.toString()}`);
    }

    let verified: VerifiedTransaction | undefined;
    let receipt: VerifiedTransaction | VerificationTransactionInput;
    let contractLoanId = expectedContractLoanId;
    try {
      verified = await verificationService.verifyAction({
        action: 'activate_loan',
        txHash: input?.txHash ?? '',
        expectedContractId: env.loanManagerContractId,
        expectedWallet: loan.borrowerWallet,
        expectedLoanId: expectedContractLoanId,
        expectedAmount: loan.outstandingDebt
      });
      if (verified.alreadyProcessed) return this.getById(id);
      contractLoanId = requireVerifiedId(verified.loanId ?? expectedContractLoanId, 'contractLoanId');
      if (contractLoanId !== expectedContractLoanId) {
        throw new ApiError(400, `Verified loan id ${contractLoanId} does not match expected loan id ${expectedContractLoanId}`);
      }
      receipt = verified;
    } catch (error) {
      contractLoanId = expectedContractLoanId;
      receipt = await fallbackLoanReceipt(input, contractLoanId, error);
    }

    const onChainLoan = await contractReaderService.readLoan(contractLoanId, loan.borrowerWallet);
    if (onChainLoan.loanId !== contractLoanId) {
      throw new ApiError(400, `On-chain loan id ${onChainLoan.loanId} does not match expected loan id ${contractLoanId}`);
    }
    if (onChainLoan.borrower !== loan.borrowerWallet) {
      throw new ApiError(400, 'On-chain loan borrower does not match the persisted borrower');
    }
    const onChainStatus = statusFromOnChain(onChainLoan.status);
    if (!onChainStatus || onChainStatus === 'PendingCollateral') {
      throw new ApiError(400, `Activation transaction was confirmed but loan is still ${onChainStatus ?? 'unknown'} on-chain`);
    }
    if (!['Active', 'Warning', 'LiquidationPlanning'].includes(onChainStatus)) {
      throw new ApiError(400, `Activation transaction resulted in unexpected on-chain status ${onChainStatus}`);
    }

    const now = new Date();
    const termDays = loan.offer?.durationDays ?? durationDays(loan.startTime, loan.dueTime);
    const dueTime = new Date(now.getTime() + termDays * 86_400_000);
    let onChainPatch: Prisma.LoanUncheckedUpdateInput;
    try {
      onChainPatch = await patchFromOnChainLoan(onChainLoan);
    } catch (error) {
      console.warn(`Unable to read activated loan risk metrics for contract loan ${contractLoanId}:`, error);
      onChainPatch = {
        collateralAmount: new Prisma.Decimal(onChainLoan.collateralAmount),
        outstandingDebt: new Prisma.Decimal(onChainLoan.outstandingDebt),
        status: onChainStatus,
      };
    }
    const onChainStartTime = dateFromLedgerSeconds(onChainLoan.startTime);
    const onChainDueTime = dateFromLedgerSeconds(onChainLoan.dueTime);
    const confirmedReceipt = requireConfirmedReceipt(receipt);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.loan.update({
        where: { id },
        data: {
          ...onChainPatch,
          contractLoanId: BigInt(contractLoanId),
          startTime: onChainStartTime ?? now,
          dueTime: onChainDueTime ?? dueTime,
          txHash: confirmedReceipt.txHash,
          explorerUrl: confirmedReceipt.explorerUrl,
          ledger: confirmedReceipt.ledger,
          blockTimestamp: confirmedReceipt.blockTimestamp
        },
        include: { offer: true }
      });

      if (verified) {
        await markVerifiedEventProcessed(tx, verified);
      }
      await upsertLedgerTransaction(tx, 'ACTIVATE_LOAN', loan.borrowerWallet, {
          offerId: loan.offerId,
          loanId: id,
          asset: loan.loanAsset,
          amount: loan.principal,
          receipt,
          details: `Activated loan ${id}; collateral locked and loan asset transferred to borrower.`,
          eventName: verified?.eventName ?? 'loan_activated',
          actor: loan.borrowerWallet,
          entityType: 'loan',
          entityId: contractLoanId,
          network: verified?.transaction.network ?? env.stellarNetwork,
          metadata: {
            contractFunction: 'activate_loan',
            contractLoanId
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
      contractLoanId,
      outstandingDebt: baseData.outstandingDebt as Prisma.Decimal,
    }, onChainLoan.borrower);
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
        expectedWallet: loan.borrowerWallet,
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
      const contractLoanId = requireAvailableContractLoanId(input.contractLoanId ?? loan.contractLoanId);
      if (loan.contractLoanId && input.contractLoanId && loan.contractLoanId.toString() !== String(input.contractLoanId)) {
        throw new ApiError(400, `Returned contractLoanId ${String(input.contractLoanId)} does not match persisted loan id ${loan.contractLoanId.toString()}`);
      }

      let verified: VerifiedTransaction | undefined;
      let receipt: VerifiedTransaction | VerificationTransactionInput;
      try {
        verified = await verificationService.verifyAction({
          action,
          txHash: input.txHash ?? '',
          expectedContractId: env.loanManagerContractId,
          expectedWallet: loan.borrowerWallet,
          expectedLoanId: contractLoanId
        });
        if (verified.alreadyProcessed) return this.getById(id);
        receipt = verified;
      } catch (error) {
        receipt = await fallbackLoanReceipt(input, contractLoanId, error);
      }

      const confirmedReceipt = requireConfirmedReceipt(receipt);
      const onChainLoan = await contractReaderService.readLoan(contractLoanId, loan.borrowerWallet);
      validateOnChainLoanIdentity(onChainLoan, {
        contractLoanId,
        borrowerWallet: loan.borrowerWallet,
      });

      let repayAmount: Prisma.Decimal;
      try {
        repayAmount = verified
          ? verificationService.amountOrThrow(verified)
          : inferRepayAmountFromChain(loan, onChainLoan, input.amount);
      } catch (error) {
        repayAmount = inferRepayAmountFromChain(loan, onChainLoan, input.amount);
      }
      if (repayAmount.lte(0)) throw new ApiError(400, 'amount must be greater than zero');
      if (repayAmount.gt(loan.outstandingDebt)) {
        throw new ApiError(400, 'repayment exceeds outstanding debt');
      }

      const isFullRepay = input.action === 'FULL_REPAY';
      const chainPatch = await patchAfterRepayment(onChainLoan, confirmedReceipt.blockTimestamp);
      const isClosed = isFullRepay || chainPatch.status === 'Repaid';

      return prisma.$transaction(async (tx) => {
        const updated = await tx.loan.update({
          where: { id },
          data: {
            ...chainPatch,
            txHash: confirmedReceipt.txHash,
            explorerUrl: confirmedReceipt.explorerUrl,
            ledger: confirmedReceipt.ledger,
            blockTimestamp: confirmedReceipt.blockTimestamp
          },
          include: { offer: true }
        });
        if (verified) {
          await markVerifiedEventProcessed(tx, verified);
        }
        await upsertLedgerTransaction(tx, input.action === 'FULL_REPAY' ? 'FULL_REPAY' : 'PARTIAL_REPAY', loan.borrowerWallet, {
            loanId: id,
            asset: loan.loanAsset,
            amount: repayAmount,
            receipt,
            details: isClosed
              ? `Fully repaid ${id}; collateral released.`
              : `Partially repaid ${repayAmount.toString()} ${loan.loanAsset} on ${id}.`,
            eventName: verified?.eventName ?? (input.action === 'FULL_REPAY' ? 'loan_repaid' : 'partial_repaid'),
            actor: loan.borrowerWallet,
            entityType: 'loan',
            entityId: contractLoanId,
            network: verified?.transaction.network ?? env.stellarNetwork,
            metadata: {
              contractFunction: input.action === 'FULL_REPAY' ? 'full_repay' : 'partial_repay',
              contractLoanId
            }
        });
        return updated;
      });
    }

    if (input.action === 'LIQUIDATE') {
      const verified = await verificationService.verifyAction({
        action: 'liquidate',
        txHash: input.txHash ?? '',
        expectedContractId: env.loanManagerContractId,
        expectedWallet: input.wallet,
        expectedLoanId: contractLoanRef(loan)
      });
      if (verified.alreadyProcessed) return this.getById(id);
      const amount = verificationService.amountOrThrow(verified);
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
            details: `Liquidated ${amount.toString()} ${loan.loanAsset} on ${id}; collateral transfer was enforced by the LoanManager/Vault contracts.`,
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

  async adminClose(loanIds: string[], reason?: string) {
    const now = new Date();
    const results: Array<{
      loanId: string;
      success: boolean;
      previousStatus?: string;
      newStatus?: string;
      offerId?: string | null;
      offerReverted?: boolean;
      lenderWallet?: string;
      principal?: string;
      error?: string;
    }> = [];

    for (const loanId of loanIds) {
      try {
        const loan = await prisma.loan.findUnique({
          where: { id: loanId },
          include: { offer: true }
        });

        if (!loan) {
          results.push({ loanId, success: false, error: 'Loan not found' });
          continue;
        }

        if (['Repaid', 'Closed', 'Liquidated'].includes(loan.status)) {
          results.push({
            loanId,
            success: false,
            error: `Loan already in terminal status: ${loan.status}`
          });
          continue;
        }

        const offerReverted = loan.offerId != null && loan.offer?.status === 'Matched';

        await prisma.$transaction(async (tx) => {
          await tx.loan.update({
            where: { id: loanId },
            data: {
              status: 'Closed',
              outstandingDebt: new Prisma.Decimal(0),
              collateralAmount: new Prisma.Decimal(0),
              healthFactor: new Prisma.Decimal(99.99),
              ltv: new Prisma.Decimal(0),
              riskZone: 'SAFE',
              closedAt: now,
              claimedByLender: false
            }
          });

          if (offerReverted && loan.offerId) {
            await tx.loanOffer.update({
              where: { id: loan.offerId },
              data: { status: 'Active' }
            });
          }

          await tx.transaction.create({
            data: {
              txHash: `admin_close_${loanId}_${now.getTime()}`,
              type: 'CLAIM_REPAYMENT',
              wallet: loan.lenderWallet,
              loanId,
              offerId: loan.offerId,
              asset: loan.loanAsset,
              amount: loan.principal,
              status: 'ADMIN',
              metadata: {
                action: 'ADMIN_CLOSE',
                reason: reason ?? 'Loan closed by admin due to error; funds to be refunded to lender',
                previousStatus: loan.status,
                closedAt: now.toISOString()
              }
            }
          });
        });

        results.push({
          loanId,
          success: true,
          previousStatus: loan.status,
          newStatus: 'Closed',
          offerId: loan.offerId,
          offerReverted,
          lenderWallet: loan.lenderWallet,
          principal: loan.principal.toString()
        });
      } catch (error) {
        results.push({
          loanId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return {
      processed: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results
    };
  },

  async recalculateHealth() {
    const loans = await prisma.loan.findMany({
      where: { status: { in: activeStatuses } }
    });

    const updated = [];
    for (const loan of loans) {
      const riskPatch = await buildRiskPatch(loan, loan.borrowerWallet);
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
