import { OfferStatus, Prisma, TransactionType } from '@prisma/client';

import { env } from '../../config/env';
import { prisma } from '../../prisma/client';
import { ApiError } from '../../utils/apiError';
import { MAX_FIXED_APR_BPS, calculateRepaymentAmount } from '../../utils/finance';
import { DEFAULT_GRACE_PERIOD_DAYS, buildRiskPatch } from '../loans/loans.service';
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
import type { VerificationTransactionInput, VerifiedTransaction } from '../verification';
import type {
  AcceptOfferInput,
  CreateOfferInput,
  OfferActionWalletInput,
  SyncOfferInput,
  UpdateOfferStatusInput
} from './offers.schemas';

const SAFE_HEALTH_FACTOR_BPS = 14_000;
const BPS_DENOMINATOR = 10_000;
const DEFAULT_LIQUIDATION_BONUS_BPS = 500;
const MAX_LIQUIDATION_BONUS_BPS = 5_000;

const decimal = (value: Prisma.Decimal.Value): Prisma.Decimal => new Prisma.Decimal(value);

const normalizedLiquidationBonusBps = (value: number): number =>
  value === 0 ? DEFAULT_LIQUIDATION_BONUS_BPS : value;

const contractOfferRef = (offer: { contractOfferId: bigint | number | null; id: string }) =>
  offer.contractOfferId?.toString() ?? offer.id;

const requireVerifiedId = (value: string | undefined, label: string): string => {
  if (!value) throw new ApiError(400, `${label} was not found in verified blockchain event`);
  return value;
};

const requireInputContractOfferId = (
  value: string | bigint | number | null | undefined,
): string => {
  if (value === undefined || value === null) {
    throw new ApiError(400, 'contractOfferId is required when the create_offer event cannot be parsed from RPC');
  }
  return String(value);
};

const requireInputContractLoanId = (
  value: string | bigint | number | null | undefined,
): string => {
  if (value === undefined || value === null) {
    throw new ApiError(400, 'contractLoanId is required when the accept_offer event cannot be parsed from RPC');
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
    error.message.includes('was not found in verified blockchain event');
};

const fallbackContractReceipt = async (
  input: { txHash?: string } | undefined,
  contractId: string,
  contractReturnValue: Record<string, unknown>,
  verificationError: unknown,
): Promise<VerificationTransactionInput> => {
  if (isHardVerificationMismatch(verificationError) || !isEventParsingFallback(verificationError)) {
    throw verificationError;
  }

  const txHash = input?.txHash ?? '';
  const transaction = await transactionVerifierService.verifyTransaction(txHash);
  const warning = verificationError instanceof Error ? verificationError.message : String(verificationError);

  return {
    txHash: transaction.txHash,
    explorerUrl: explorerService.getTransactionUrl(transaction.txHash),
    ledger: transaction.ledger,
    txStatus: transaction.status,
    contractId,
    blockTimestamp: transaction.confirmedAt,
    contractReturnValue: {
      ...contractReturnValue,
      verificationWarning: warning,
    },
  };
};

const fallbackVerifiedReceipt = async (
  input: OfferActionWalletInput | undefined,
  contractOfferId: string,
  verificationError: unknown,
): Promise<VerificationTransactionInput> => {
  return fallbackContractReceipt(input, env.marketplaceContractId, { contractOfferId }, verificationError);
};

const upsertLedgerTransaction = async (
  tx: Prisma.TransactionClient,
  type: TransactionType,
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

const requireOfferOwner = (
  offer: { lenderWallet: string },
  input: { wallet?: string } | undefined
) => {
  if (input?.wallet && input.wallet !== offer.lenderWallet) {
    throw new ApiError(403, 'Only the offer lender can perform this action');
  }
};

const offerStatusFromOnChain = (status: string | undefined): OfferStatus | undefined => {
  if (!status) return undefined;
  const match = ['Draft', 'Funding', 'Active', 'Matched', 'Cancelled', 'Expired']
    .find((item) => status.includes(item));
  return match as OfferStatus | undefined;
};

const assertMatchingContractOfferId = (
  verifiedOfferId: string,
  expectedOfferId?: string | bigint | number | null
) => {
  if (expectedOfferId !== undefined && expectedOfferId !== null && String(expectedOfferId) !== verifiedOfferId) {
    throw new ApiError(400, `Verified offer id ${verifiedOfferId} does not match expected offer id ${String(expectedOfferId)}`);
  }
};

const isContractAddress = (value: string | undefined): boolean => Boolean(value?.startsWith('C'));

const assertDecimalEq = (label: string, actual: Prisma.Decimal.Value, expected: Prisma.Decimal.Value) => {
  if (!decimal(actual).eq(decimal(expected))) {
    throw new ApiError(400, `On-chain offer ${label} does not match this offer`);
  }
};

const assertNumberEq = (label: string, actual: number, expected: number) => {
  if (actual !== expected) {
    throw new ApiError(400, `On-chain offer ${label} does not match this offer`);
  }
};

const validateOnChainOfferMatches = (
  onChainOffer: Awaited<ReturnType<typeof contractReaderService.readOffer>>,
  expected: {
    lenderWallet: string;
    loanAsset: string;
    loanAmount: Prisma.Decimal.Value;
    fixedAprBps: number;
    durationDays: number;
    collateralAsset: string;
    maxLtvBps: number;
    liquidationThresholdBps: number;
    liquidationBonusBps: number;
    gracePeriodDays: number;
    minHealthFactorBps: number;
  }
) => {
  if (onChainOffer.lender !== expected.lenderWallet) {
    throw new ApiError(400, 'On-chain offer lender does not match this offer');
  }
  if (isContractAddress(expected.loanAsset) && onChainOffer.loanAsset !== expected.loanAsset) {
    throw new ApiError(400, 'On-chain offer loan asset does not match this offer');
  }
  if (isContractAddress(expected.collateralAsset) && onChainOffer.collateralAsset !== expected.collateralAsset) {
    throw new ApiError(400, 'On-chain offer collateral asset does not match this offer');
  }
  assertDecimalEq('amount', onChainOffer.loanAmount, expected.loanAmount);
  assertNumberEq('APR', onChainOffer.fixedAprBps, expected.fixedAprBps);
  assertNumberEq('duration', onChainOffer.durationDays, expected.durationDays);
  assertNumberEq('max LTV', onChainOffer.maxLtvBps, expected.maxLtvBps);
  assertNumberEq('liquidation threshold', onChainOffer.liquidationThresholdBps, expected.liquidationThresholdBps);
  assertNumberEq('liquidation bonus', onChainOffer.liquidationBonusBps, normalizedLiquidationBonusBps(expected.liquidationBonusBps));
  assertNumberEq('grace period', onChainOffer.gracePeriodDays, expected.gracePeriodDays);
  assertNumberEq('minimum Health Factor', onChainOffer.minHealthFactorBps, expected.minHealthFactorBps);
};

const validateCreateOffer = (input: CreateOfferInput) => {
  if (input.maxLtvBps > input.liquidationThresholdBps) {
    throw new ApiError(400, 'maxLtvBps cannot exceed liquidationThresholdBps');
  }
  if (input.maxLtvBps > BPS_DENOMINATOR) {
    throw new ApiError(400, 'maxLtvBps cannot exceed 10000');
  }
  if (input.liquidationThresholdBps > BPS_DENOMINATOR) {
    throw new ApiError(400, 'liquidationThresholdBps cannot exceed 10000');
  }
  if (input.liquidationBonusBps > MAX_LIQUIDATION_BONUS_BPS) {
    throw new ApiError(400, `liquidationBonusBps cannot exceed ${MAX_LIQUIDATION_BONUS_BPS}`);
  }
  if (decimal(input.loanAmount).lte(0)) {
    throw new ApiError(400, 'loanAmount must be greater than zero');
  }
  if (input.fixedAprBps <= 0) {
    throw new ApiError(400, 'fixedAprBps must be greater than zero');
  }
  if (input.fixedAprBps > MAX_FIXED_APR_BPS) {
    throw new ApiError(400, `fixedAprBps cannot exceed ${MAX_FIXED_APR_BPS} (20% APR)`);
  }
  if (input.minHealthFactorBps < SAFE_HEALTH_FACTOR_BPS) {
    throw new ApiError(400, 'minHealthFactorBps must be at least 14000');
  }
  if (input.gracePeriodDays !== DEFAULT_GRACE_PERIOD_DAYS) {
    throw new ApiError(400, `gracePeriodDays must be ${DEFAULT_GRACE_PERIOD_DAYS}`);
  }
};

const ensureAprWithinLimit = (fixedAprBps: number) => {
  if (fixedAprBps > MAX_FIXED_APR_BPS) {
    throw new ApiError(400, `Loan APR cannot exceed 20% per year (${MAX_FIXED_APR_BPS} bps)`);
  }
};

const ensureCancelable = (status: OfferStatus) => {
  if (!['Draft', 'Funding', 'Active'].includes(status)) {
    throw new ApiError(400, 'Only Draft, Funding, or Active offers can be cancelled');
  }
};

export const offersService = {
  async list(query: { status?: string; lenderWallet?: string; marketplaceOnly?: boolean }) {
    return prisma.loanOffer.findMany({
      where: {
        status: query.marketplaceOnly ? 'Active' : (query.status as never),
        lenderWallet: query.lenderWallet
      },
      include: { loans: true },
      orderBy: { createdAt: 'desc' }
    });
  },

  async getById(id: string) {
    const offer = await prisma.loanOffer.findUnique({ where: { id }, include: { loans: true } });
    if (!offer) throw new ApiError(404, 'Offer not found');
    return offer;
  },

  async create(input: CreateOfferInput) {
    validateCreateOffer(input);
    const verified = input.txHash
      ? await verificationService.verifyAction({
          action: 'create_offer',
          txHash: input.txHash,
          expectedContractId: env.marketplaceContractId,
          expectedWallet: input.lenderWallet,
          expectedAmount: input.loanAmount
        })
      : undefined;
    const receipt = verified ? requireConfirmedReceipt(verified) : undefined;
    const onChainOffer = verified?.offerId
      ? await contractReaderService.readOffer(verified.offerId, verified.actor ?? input.lenderWallet)
      : undefined;
    if (onChainOffer) {
      validateOnChainOfferMatches(onChainOffer, {
        ...input,
        loanAmount: verified?.amount ?? input.loanAmount,
        gracePeriodDays: DEFAULT_GRACE_PERIOD_DAYS,
      });
    }

    const data: Prisma.LoanOfferUncheckedCreateInput = {
      contractOfferId: verified?.offerId ? BigInt(verified.offerId) : input.contractOfferId,
      lenderWallet: verified?.actor ?? input.lenderWallet,
      loanAsset: input.loanAsset,
      loanAmount: verified?.amount ?? decimal(input.loanAmount),
      fixedAprBps: onChainOffer?.fixedAprBps ?? input.fixedAprBps,
      durationDays: onChainOffer?.durationDays ?? input.durationDays,
      collateralAsset: input.collateralAsset,
      maxLtvBps: onChainOffer?.maxLtvBps ?? input.maxLtvBps,
      liquidationThresholdBps: onChainOffer?.liquidationThresholdBps ?? input.liquidationThresholdBps,
      liquidationBonusBps: onChainOffer?.liquidationBonusBps ?? normalizedLiquidationBonusBps(input.liquidationBonusBps),
      gracePeriodDays: DEFAULT_GRACE_PERIOD_DAYS,
      minHealthFactorBps: onChainOffer?.minHealthFactorBps ?? input.minHealthFactorBps,
      status: input.status ?? 'Draft',
      description: input.description,
      txHash: receipt?.txHash,
      explorerUrl: receipt?.explorerUrl,
      ledger: receipt?.ledger,
      blockTimestamp: receipt?.blockTimestamp
    };

    return prisma.$transaction(async (tx) => {
      const offer = await tx.loanOffer.create({
        data,
        include: { loans: true }
      });
      if (receipt && verified) {
        await markVerifiedEventProcessed(tx, verified);
        await upsertLedgerTransaction(tx, 'CREATE_OFFER', offer.lenderWallet, {
            offerId: offer.id,
            asset: offer.loanAsset,
            amount: offer.loanAmount,
            receipt: verified,
            details: `Created Draft offer ${offer.id} for ${offer.loanAmount.toString()} ${offer.loanAsset}.`,
            metadata: {
              contractFunction: 'create_offer',
              contractOfferId: offer.contractOfferId?.toString()
            }
        });
      }
      return offer;
    });
  },

  async deploy(id: string, input?: OfferActionWalletInput) {
    const offer = await this.getById(id);
    requireOfferOwner(offer, input);
    if (offer.status !== 'Draft') {
      throw new ApiError(400, 'Only Draft offers can be deployed');
    }

    let verified: VerifiedTransaction | undefined;
    let receipt: VerifiedTransaction | VerificationTransactionInput;
    let contractOfferId: string;
    try {
      verified = await verificationService.verifyAction({
        action: 'create_offer',
        txHash: input?.txHash ?? '',
        expectedContractId: env.marketplaceContractId,
        expectedWallet: offer.lenderWallet,
        expectedAmount: offer.loanAmount
      });
      contractOfferId = requireVerifiedId(verified.offerId, 'contractOfferId');
      receipt = verified;
    } catch (error) {
      contractOfferId = requireInputContractOfferId(input?.contractOfferId);
      receipt = await fallbackVerifiedReceipt(input, contractOfferId, error);
    }
    assertMatchingContractOfferId(contractOfferId, input?.contractOfferId);
    assertMatchingContractOfferId(contractOfferId, offer.contractOfferId);
    const onChainOffer = await contractReaderService.readOffer(contractOfferId, offer.lenderWallet);
    validateOnChainOfferMatches(onChainOffer, offer);
    const confirmedReceipt = requireConfirmedReceipt(receipt);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.loanOffer.update({
        where: { id },
        data: {
          contractOfferId: BigInt(contractOfferId),
          txHash: confirmedReceipt.txHash,
          explorerUrl: confirmedReceipt.explorerUrl,
          ledger: confirmedReceipt.ledger,
          blockTimestamp: confirmedReceipt.blockTimestamp
        },
        include: { loans: true }
      });
      if (verified) {
        await markVerifiedEventProcessed(tx, verified);
      }
      await upsertLedgerTransaction(tx, 'CREATE_OFFER', updated.lenderWallet, {
        offerId: id,
        asset: updated.loanAsset,
        amount: updated.loanAmount,
        receipt,
        details: `Deployed draft offer ${id} on-chain before escrow funding.`,
        metadata: {
          contractFunction: 'create_offer',
          contractOfferId
        }
      });
      return updated;
    });
  },

  async syncChain(id: string, input?: SyncOfferInput) {
    const offer = await this.getById(id);
    if (!offer.contractOfferId) {
      return offer;
    }

    const onChainOffer = await contractReaderService.readOffer(offer.contractOfferId, input?.wallet ?? offer.lenderWallet);
    validateOnChainOfferMatches(onChainOffer, offer);
    const status = offerStatusFromOnChain(onChainOffer.status);
    if (!status || status === offer.status) {
      return offer;
    }

    return prisma.loanOffer.update({
      where: { id },
      data: { status },
      include: { loans: true }
    });
  },

  async fund(id: string, input?: OfferActionWalletInput) {
    const offer = await this.getById(id);
    requireOfferOwner(offer, input);
    const expectedOfferId = offer.contractOfferId?.toString() ?? input?.contractOfferId?.toString();
    const verified = await verificationService.verifyAction({
      action: 'fund_offer',
      txHash: input?.txHash ?? '',
      expectedContractId: env.marketplaceContractId,
      expectedWallet: offer.lenderWallet,
      expectedOfferId,
      expectedAmount: offer.loanAmount
    });
    const contractOfferId = requireVerifiedId(verified.offerId, 'contractOfferId');
    assertMatchingContractOfferId(contractOfferId, input?.contractOfferId);
    assertMatchingContractOfferId(contractOfferId, offer.contractOfferId);
    const onChainOffer = await contractReaderService.readOffer(contractOfferId, offer.lenderWallet);
    validateOnChainOfferMatches(onChainOffer, offer);

    if (offer.status !== 'Draft') {
      return this.getById(id);
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.loanOffer.update({
        where: { id },
        data: {
          status: 'Funding',
          contractOfferId: BigInt(contractOfferId),
          txHash: verified.transaction.txHash,
          explorerUrl: verified.explorerUrl,
          ledger: verified.transaction.ledger,
          blockTimestamp: verified.transaction.confirmedAt
        },
        include: { loans: true }
      });
      await markVerifiedEventProcessed(tx, verified);
      await upsertLedgerTransaction(tx, 'FUND_OFFER', updated.lenderWallet, {
          offerId: id,
          asset: updated.loanAsset,
          amount: updated.loanAmount,
          receipt: verified,
          details: `Funded offer ${id}; lender funds are locked in Vault/Escrow.`,
          metadata: {
            contractFunction: 'fund_offer',
            contractOfferId: contractOfferRef(updated)
          }
      });
      return updated;
    });
  },

  async activate(id: string, input?: OfferActionWalletInput) {
    const offer = await this.getById(id);
    requireOfferOwner(offer, input);
    if (offer.status === 'Active') {
      return offer;
    }
    const verified = await verificationService.verifyAction({
      action: 'activate_offer',
      txHash: input?.txHash ?? '',
      expectedContractId: env.marketplaceContractId,
      expectedWallet: offer.lenderWallet,
      expectedOfferId: contractOfferRef(offer),
      expectedAmount: offer.loanAmount
    });
    if (verified.alreadyProcessed) return this.getById(id);
    const onChainOffer = await contractReaderService.readOffer(contractOfferRef(offer), offer.lenderWallet);
    validateOnChainOfferMatches(onChainOffer, offer);
    if (offer.status !== 'Funding') {
      throw new ApiError(400, 'Only Funding offers can be activated');
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.loanOffer.update({
        where: { id },
        data: {
          status: 'Active',
          txHash: verified.transaction.txHash,
          explorerUrl: verified.explorerUrl,
          ledger: verified.transaction.ledger,
          blockTimestamp: verified.transaction.confirmedAt
        },
        include: { loans: true }
      });
      await markVerifiedEventProcessed(tx, verified);
      await upsertLedgerTransaction(tx, 'ACTIVATE_OFFER', updated.lenderWallet, {
          offerId: id,
          asset: updated.loanAsset,
          amount: updated.loanAmount,
          receipt: verified,
          details: `Activated offer ${id}; it is now visible in the marketplace.`,
          metadata: {
            contractFunction: 'activate_offer',
            contractOfferId: contractOfferRef(offer)
          }
      });
      return updated;
    });
  },

  async cancel(id: string, input?: OfferActionWalletInput) {
    const offer = await this.getById(id);
    ensureCancelable(offer.status);
    const verified = await verificationService.verifyAction({
      action: 'cancel_offer',
      txHash: input?.txHash ?? '',
      expectedContractId: env.marketplaceContractId,
      expectedWallet: offer.lenderWallet,
      expectedOfferId: contractOfferRef(offer),
      expectedAmount: offer.loanAmount
    });
    if (verified.alreadyProcessed) return this.getById(id);
    const onChainOffer = await contractReaderService.readOffer(contractOfferRef(offer), offer.lenderWallet);
    validateOnChainOfferMatches(onChainOffer, offer);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.loanOffer.update({
        where: { id },
        data: {
          status: 'Cancelled',
          txHash: verified.transaction.txHash,
          explorerUrl: verified.explorerUrl,
          ledger: verified.transaction.ledger,
          blockTimestamp: verified.transaction.confirmedAt
        },
        include: { loans: true }
      });
      await markVerifiedEventProcessed(tx, verified);
      await upsertLedgerTransaction(tx, 'CANCEL_OFFER', updated.lenderWallet, {
          offerId: updated.id,
          asset: updated.loanAsset,
          amount: updated.loanAmount,
          receipt: verified,
          details: `Cancelled offer ${updated.id}; locked lender funds are released by Vault/Escrow.`
      });
      return updated;
    });
  },

  async expire(id: string, input: OfferActionWalletInput) {
    const offer = await this.getById(id);
    ensureCancelable(offer.status);
    const verified = await verificationService.verifyAction({
      action: 'expire_offer',
      txHash: input?.txHash ?? '',
      expectedContractId: env.marketplaceContractId,
      expectedOfferId: contractOfferRef(offer),
      expectedAmount: offer.loanAmount
    });
    if (verified.alreadyProcessed) return this.getById(id);
    const onChainOffer = await contractReaderService.readOffer(contractOfferRef(offer), input.wallet ?? offer.lenderWallet);
    validateOnChainOfferMatches(onChainOffer, offer);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.loanOffer.update({
        where: { id },
        data: {
          status: 'Expired',
          txHash: verified.transaction.txHash,
          explorerUrl: verified.explorerUrl,
          ledger: verified.transaction.ledger,
          blockTimestamp: verified.transaction.confirmedAt
        },
        include: { loans: true }
      });
      await markVerifiedEventProcessed(tx, verified);
      await upsertLedgerTransaction(tx, 'EXPIRE_OFFER', updated.lenderWallet, {
          offerId: updated.id,
          asset: updated.loanAsset,
          amount: updated.loanAmount,
          receipt: verified,
          details: `Expired offer ${updated.id}; locked lender funds are released by Vault/Escrow.`
      });
      return updated;
    });
  },

  async accept(id: string, input: AcceptOfferInput) {
    const offer = await this.getById(id);
    ensureAprWithinLimit(offer.fixedAprBps);
    if (offer.status !== 'Active') {
      throw new ApiError(400, 'Borrowers can only accept Active offers');
    }
    if (!offer.contractOfferId) {
      throw new ApiError(400, 'Offer is missing contractOfferId and cannot be accepted on-chain');
    }

    const expectedContractOfferId = offer.contractOfferId.toString();
    let verified: VerifiedTransaction | undefined;
    let receipt: VerifiedTransaction | VerificationTransactionInput;
    let contractLoanId: string;
    try {
      verified = await verificationService.verifyAction({
        action: 'accept_offer',
        txHash: input.txHash,
        expectedContractId: env.marketplaceContractId,
        expectedWallet: input.borrowerWallet,
        expectedOfferId: expectedContractOfferId
      });
      if (verified.alreadyProcessed) {
        const existing = await prisma.loan.findFirst({
          where: { offerId: id },
          include: { offer: true }
        });
        if (existing) return existing;
        throw new ApiError(409, 'Accept offer transaction was already processed but no indexed loan exists yet');
      }
      contractLoanId = requireVerifiedId(verified.loanId, 'contractLoanId');
      if (input.contractLoanId !== undefined && String(input.contractLoanId) !== contractLoanId) {
        throw new ApiError(400, `Verified loan id ${contractLoanId} does not match returned contractLoanId ${String(input.contractLoanId)}`);
      }
      receipt = verified;
    } catch (error) {
      contractLoanId = requireInputContractLoanId(input.contractLoanId);
      receipt = await fallbackContractReceipt(input, env.marketplaceContractId, {
        contractOfferId: expectedContractOfferId,
        contractLoanId,
      }, error);
    }

    const readSource = verified?.actor ?? input.borrowerWallet ?? offer.lenderWallet;
    const onChainOffer = await contractReaderService.readOffer(expectedContractOfferId, readSource);
    validateOnChainOfferMatches(onChainOffer, offer);
    const onChainOfferStatus = offerStatusFromOnChain(onChainOffer.status);
    if (onChainOfferStatus && onChainOfferStatus !== 'Matched') {
      throw new ApiError(400, `On-chain offer is ${onChainOfferStatus}; expected Matched after accept_offer`);
    }

    const onChainLoan = await contractReaderService.readLoan(contractLoanId, readSource);
    if (onChainLoan.offerId !== expectedContractOfferId) {
      throw new ApiError(400, `On-chain loan offer id ${onChainLoan.offerId} does not match accepted offer ${expectedContractOfferId}`);
    }
    const borrowerWallet = onChainLoan.borrower || verified?.actor || input.borrowerWallet;
    if (!borrowerWallet) {
      throw new ApiError(400, 'Borrower wallet was not found in verified chain state');
    }
    if (input.borrowerWallet && borrowerWallet !== input.borrowerWallet) {
      throw new ApiError(400, 'On-chain loan borrower does not match the accepting wallet');
    }
    if (borrowerWallet === offer.lenderWallet) {
      throw new ApiError(400, 'Borrower cannot accept their own offer');
    }
    const collateralAmount = decimal(onChainLoan.collateralAmount);
    if (collateralAmount.lte(0)) {
      throw new ApiError(400, 'collateralAmount must be greater than zero');
    }

    const outstandingDebt = decimal(onChainLoan.outstandingDebt || calculateRepaymentAmount(offer.loanAmount, offer.fixedAprBps / 100, offer.durationDays)).toDecimalPlaces(7);
    let riskMetrics: Pick<Prisma.LoanUncheckedCreateInput, 'healthFactor' | 'ltv' | 'riskZone'> = {};
    try {
      const riskPatch = await buildRiskPatch({
        contractLoanId,
        outstandingDebt,
      }, borrowerWallet);
      const { status: _ignoredStatus, ...metrics } = riskPatch;
      riskMetrics = metrics;
    } catch (error) {
      console.warn(`Unable to read pending loan risk metrics for contract loan ${contractLoanId}:`, error);
    }
    const confirmedReceipt = requireConfirmedReceipt(receipt);

    return prisma.$transaction(async (tx) => {
      if (verified) {
        await markVerifiedEventProcessed(tx, verified);
      }

      const loan = await tx.loan.upsert({
        where: { contractLoanId: BigInt(contractLoanId) },
        create: {
          contractLoanId: BigInt(contractLoanId),
          offerId: offer.id,
          contractOfferId: offer.contractOfferId,
          lenderWallet: offer.lenderWallet,
          borrowerWallet,
          loanAsset: offer.loanAsset,
          principal: offer.loanAmount,
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
          txHash: confirmedReceipt.txHash,
          explorerUrl: confirmedReceipt.explorerUrl,
          ledger: confirmedReceipt.ledger,
          blockTimestamp: confirmedReceipt.blockTimestamp,
          ...riskMetrics
        },
        update: {
          offerId: offer.id,
          contractOfferId: offer.contractOfferId,
          lenderWallet: offer.lenderWallet,
          borrowerWallet,
          outstandingDebt,
          collateralAmount,
          txHash: confirmedReceipt.txHash,
          explorerUrl: confirmedReceipt.explorerUrl,
          ledger: confirmedReceipt.ledger,
          blockTimestamp: confirmedReceipt.blockTimestamp,
          ...riskMetrics
        },
        include: { offer: true }
      });

      await tx.loanOffer.update({
        where: { id: offer.id },
        data: {
          status: 'Matched',
          txHash: confirmedReceipt.txHash,
          explorerUrl: confirmedReceipt.explorerUrl,
          ledger: confirmedReceipt.ledger,
          blockTimestamp: confirmedReceipt.blockTimestamp
        }
      });

      await upsertLedgerTransaction(tx, 'ACCEPT_OFFER', borrowerWallet, {
          offerId: offer.id,
          loanId: loan.id,
          asset: offer.collateralAsset,
          amount: collateralAmount,
          receipt,
          details: `Accepted offer ${offer.id}; loan ${loan.id} is PendingCollateral until borrower activates it.`,
          eventName: verified?.eventName ?? 'offer_matched',
          actor: borrowerWallet,
          entityType: 'offer',
          entityId: expectedContractOfferId,
          network: verified?.transaction.network ?? env.stellarNetwork,
          metadata: {
            contractFunction: 'accept_offer',
            contractOfferId: expectedContractOfferId,
            contractLoanId: loan.contractLoanId?.toString()
          }
      });

      return loan;
    });
  },

  async updateStatus(id: string, input: UpdateOfferStatusInput) {
    if (input.status === 'Cancelled') {
      if (!input.txHash) {
        throw new ApiError(400, 'txHash is required to cancel an offer through blockchain verification');
      }
      return this.cancel(id, { ...input, txHash: input.txHash });
    }
    if (input.status === 'Expired') {
      if (!input.txHash) {
        throw new ApiError(400, 'txHash is required to expire an offer through blockchain verification');
      }
      return this.expire(id, { ...input, txHash: input.txHash });
    }

    throw new ApiError(400, 'Direct offer status writes are disabled; use a confirmed blockchain action endpoint');
  }
};
