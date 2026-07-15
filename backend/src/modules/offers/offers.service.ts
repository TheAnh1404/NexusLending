import { OfferStatus, Prisma, TransactionType } from '@prisma/client';

import { env } from '../../config/env';
import { prisma } from '../../prisma/client';
import { ApiError } from '../../utils/apiError';
import { MAX_FIXED_APR_BPS, calculateRepaymentAmount } from '../../utils/finance';
import { DEFAULT_GRACE_PERIOD_DAYS, buildRiskPatch } from '../loans/loans.service';
import { createLedgerTransaction, requireConfirmedReceipt } from '../transactions/chainReceipt';
import { contractReaderService, verificationService } from '../verification';
import type { VerifiedTransaction } from '../verification';
import type {
  AcceptOfferInput,
  CreateOfferInput,
  OfferActionWalletInput,
  SyncOfferInput,
  UpdateOfferStatusInput
} from './offers.schemas';

const SAFE_HEALTH_FACTOR_BPS = 14_000;

const decimal = (value: Prisma.Decimal.Value): Prisma.Decimal => new Prisma.Decimal(value);

const contractOfferRef = (offer: { contractOfferId: bigint | number | null; id: string }) =>
  offer.contractOfferId?.toString() ?? offer.id;

const requireVerifiedId = (value: string | undefined, label: string): string => {
  if (!value) throw new ApiError(400, `${label} was not found in verified blockchain event`);
  return value;
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

const validateCreateOffer = (input: CreateOfferInput) => {
  if (input.maxLtvBps > input.liquidationThresholdBps) {
    throw new ApiError(400, 'maxLtvBps cannot exceed liquidationThresholdBps');
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

    const data: Prisma.LoanOfferUncheckedCreateInput = {
      contractOfferId: verified?.offerId ? BigInt(verified.offerId) : input.contractOfferId,
      lenderWallet: verified?.actor ?? input.lenderWallet,
      loanAsset: input.loanAsset,
      loanAmount: verified?.amount ?? decimal(input.loanAmount),
      fixedAprBps: input.fixedAprBps,
      durationDays: input.durationDays,
      collateralAsset: input.collateralAsset,
      maxLtvBps: input.maxLtvBps,
      liquidationThresholdBps: input.liquidationThresholdBps,
      liquidationBonusBps: input.liquidationBonusBps,
      gracePeriodDays: DEFAULT_GRACE_PERIOD_DAYS,
      minHealthFactorBps: input.minHealthFactorBps,
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

    const verified = await verificationService.verifyAction({
      action: 'create_offer',
      txHash: input?.txHash ?? '',
      expectedContractId: env.marketplaceContractId,
      expectedWallet: offer.lenderWallet,
      expectedAmount: offer.loanAmount
    });
    const contractOfferId = requireVerifiedId(verified.offerId, 'contractOfferId');
    assertMatchingContractOfferId(contractOfferId, input?.contractOfferId);
    assertMatchingContractOfferId(contractOfferId, offer.contractOfferId);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.loanOffer.update({
        where: { id },
        data: {
          contractOfferId: BigInt(contractOfferId),
          txHash: verified.transaction.txHash,
          explorerUrl: verified.explorerUrl,
          ledger: verified.transaction.ledger,
          blockTimestamp: verified.transaction.confirmedAt
        },
        include: { loans: true }
      });
      await markVerifiedEventProcessed(tx, verified);
      await upsertLedgerTransaction(tx, 'CREATE_OFFER', updated.lenderWallet, {
        offerId: id,
        asset: updated.loanAsset,
        amount: updated.loanAmount,
        receipt: verified,
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
    if (onChainOffer.lender && onChainOffer.lender !== offer.lenderWallet) {
      throw new ApiError(400, 'On-chain offer lender does not match this offer');
    }
    if (!decimal(onChainOffer.loanAmount).eq(offer.loanAmount)) {
      throw new ApiError(400, 'On-chain offer amount does not match this offer');
    }
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
      expectedOfferId,
      expectedAmount: offer.loanAmount
    });
    const contractOfferId = requireVerifiedId(verified.offerId, 'contractOfferId');
    assertMatchingContractOfferId(contractOfferId, input?.contractOfferId);
    assertMatchingContractOfferId(contractOfferId, offer.contractOfferId);

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
      expectedOfferId: contractOfferRef(offer),
      expectedAmount: offer.loanAmount
    });
    if (verified.alreadyProcessed) return this.getById(id);
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
      expectedOfferId: contractOfferRef(offer),
      expectedAmount: offer.loanAmount
    });
    if (verified.alreadyProcessed) return this.getById(id);

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
    const verified = await verificationService.verifyAction({
      action: 'accept_offer',
      txHash: input.txHash,
      expectedContractId: env.marketplaceContractId,
      expectedOfferId: contractOfferRef(offer)
    });
    if (verified.alreadyProcessed) {
      const existing = await prisma.loan.findFirst({
        where: { offerId: id },
        include: { offer: true }
      });
      if (existing) return existing;
      throw new ApiError(409, 'Accept offer transaction was already processed but no indexed loan exists yet');
    }
    const contractLoanId = requireVerifiedId(verified.loanId, 'contractLoanId');
    const onChainLoan = await contractReaderService.readLoan(contractLoanId, verified.actor ?? offer.lenderWallet);
    const borrowerWallet = onChainLoan.borrower || verified.actor;
    if (!borrowerWallet) {
      throw new ApiError(400, 'Borrower wallet was not found in verified chain state');
    }
    if (borrowerWallet === offer.lenderWallet) {
      throw new ApiError(400, 'Borrower cannot accept their own offer');
    }
    const collateralAmount = decimal(onChainLoan.collateralAmount);
    if (collateralAmount.lte(0)) {
      throw new ApiError(400, 'collateralAmount must be greater than zero');
    }

    const outstandingDebt = decimal(onChainLoan.outstandingDebt || calculateRepaymentAmount(offer.loanAmount, offer.fixedAprBps / 100, offer.durationDays)).toDecimalPlaces(7);
    const riskPatch = await buildRiskPatch({
      collateralAsset: offer.collateralAsset,
      loanAsset: offer.loanAsset,
      collateralAmount,
      outstandingDebt,
      liquidationThresholdBps: offer.liquidationThresholdBps
    });
    const { status: _ignoredStatus, ...riskMetrics } = riskPatch;

    return prisma.$transaction(async (tx) => {
      await markVerifiedEventProcessed(tx, verified);

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
          txHash: verified.transaction.txHash,
          explorerUrl: verified.explorerUrl,
          ledger: verified.transaction.ledger,
          blockTimestamp: verified.transaction.confirmedAt,
          ...riskMetrics
        },
        update: {
          offerId: offer.id,
          contractOfferId: offer.contractOfferId,
          lenderWallet: offer.lenderWallet,
          borrowerWallet,
          outstandingDebt,
          collateralAmount,
          txHash: verified.transaction.txHash,
          explorerUrl: verified.explorerUrl,
          ledger: verified.transaction.ledger,
          blockTimestamp: verified.transaction.confirmedAt,
          ...riskMetrics
        },
        include: { offer: true }
      });

      await tx.loanOffer.update({
        where: { id: offer.id },
        data: {
          status: 'Matched',
          txHash: verified.transaction.txHash,
          explorerUrl: verified.explorerUrl,
          ledger: verified.transaction.ledger,
          blockTimestamp: verified.transaction.confirmedAt
        }
      });

      await upsertLedgerTransaction(tx, 'ACCEPT_OFFER', borrowerWallet, {
          offerId: offer.id,
          loanId: loan.id,
          asset: offer.collateralAsset,
          amount: collateralAmount,
          receipt: verified,
          details: `Accepted offer ${offer.id}; loan ${loan.id} is PendingCollateral until borrower activates it.`,
          metadata: {
            contractFunction: 'accept_offer',
            contractOfferId: contractOfferRef(offer),
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
