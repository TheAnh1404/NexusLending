import { OfferStatus, Prisma, TransactionType } from '@prisma/client';

import { prisma } from '../../prisma/client';
import { ApiError } from '../../utils/apiError';
import { calculateRepaymentAmount } from '../../utils/finance';
import { buildRiskPatch } from '../loans/loans.service';
import { sorobanService } from '../soroban/soroban.service';
import type {
  AcceptOfferInput,
  CreateOfferInput,
  OfferActionWalletInput,
  UpdateOfferStatusInput
} from './offers.schemas';

const SAFE_HEALTH_FACTOR_BPS = 14_000;

const createMockTxHash = (type: string): string =>
  `mock_${type.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const decimal = (value: Prisma.Decimal.Value): Prisma.Decimal => new Prisma.Decimal(value);

const contractOfferRef = (offer: { contractOfferId: bigint | number | null; id: string }) =>
  offer.contractOfferId?.toString() ?? offer.id;

const ledgerTransaction = (
  type: TransactionType,
  wallet: string,
  input: {
    offerId?: string;
    loanId?: string;
    asset?: string;
    amount?: Prisma.Decimal.Value;
    details: string;
    txHash?: string;
    explorerUrl?: string;
    metadata?: Prisma.InputJsonValue;
  }
): Prisma.TransactionUncheckedCreateInput => ({
  txHash: input.txHash ?? createMockTxHash(type),
  explorerUrl: input.explorerUrl,
  type,
  wallet,
  offerId: input.offerId,
  loanId: input.loanId,
  asset: input.asset,
  amount: input.amount === undefined ? undefined : decimal(input.amount),
  metadata: {
    details: input.details,
    ...(input.metadata && typeof input.metadata === 'object' ? input.metadata : {})
  }
});

const requireOfferOwner = (
  offer: { lenderWallet: string },
  input: OfferActionWalletInput | undefined
) => {
  if (input?.wallet && input.wallet !== offer.lenderWallet) {
    throw new ApiError(403, 'Only the offer lender can perform this action');
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
  if (input.minHealthFactorBps < SAFE_HEALTH_FACTOR_BPS) {
    throw new ApiError(400, 'minHealthFactorBps must be at least 14000');
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

    const data: Prisma.LoanOfferUncheckedCreateInput = {
      ...input,
      loanAmount: decimal(input.loanAmount),
      status: input.status ?? 'Draft'
    };
    const sorobanTx = sorobanService.createOfferTx({
      lender: input.lenderWallet,
      loanAsset: input.loanAsset,
      loanAmount: input.loanAmount,
      fixedAprBps: input.fixedAprBps,
      durationDays: input.durationDays,
      collateralAsset: input.collateralAsset,
      maxLtvBps: input.maxLtvBps,
      liquidationThresholdBps: input.liquidationThresholdBps,
      liquidationBonusBps: input.liquidationBonusBps,
      gracePeriodDays: input.gracePeriodDays,
      minHealthFactorBps: input.minHealthFactorBps
    });

    return prisma.$transaction(async (tx) => {
      const offer = await tx.loanOffer.create({
        data: {
          ...data,
          txHash: input.txHash ?? sorobanTx.txHash,
          explorerUrl: input.explorerUrl ?? sorobanTx.explorerUrl
        },
        include: { loans: true }
      });
      await tx.transaction.create({
        data: ledgerTransaction('CREATE_OFFER', offer.lenderWallet, {
          offerId: offer.id,
          asset: offer.loanAsset,
          amount: offer.loanAmount,
          txHash: offer.txHash ?? undefined,
          explorerUrl: offer.explorerUrl ?? undefined,
          details: `Created Draft offer ${offer.id} for ${offer.loanAmount.toString()} ${offer.loanAsset}.`,
          metadata: {
            contractFunction: sorobanTx.functionName,
            mocked: sorobanTx.mocked
          }
        })
      });
      return offer;
    });
  },

  async fund(id: string, input?: OfferActionWalletInput) {
    const offer = await this.getById(id);
    requireOfferOwner(offer, input);
    if (offer.status !== 'Draft') {
      throw new ApiError(400, 'Only Draft offers can be funded');
    }

    const sorobanTx = sorobanService.fundOfferTx(contractOfferRef(offer));
    return prisma.$transaction(async (tx) => {
      const updated = await tx.loanOffer.update({
        where: { id },
        data: {
          status: 'Funding',
          txHash: sorobanTx.txHash,
          explorerUrl: sorobanTx.explorerUrl
        },
        include: { loans: true }
      });
      await tx.transaction.create({
        data: ledgerTransaction('FUND_OFFER', updated.lenderWallet, {
          offerId: id,
          asset: updated.loanAsset,
          amount: updated.loanAmount,
          txHash: sorobanTx.txHash,
          explorerUrl: sorobanTx.explorerUrl,
          details: `Funded offer ${id}; lender funds are locked in Vault/Escrow.`,
          metadata: {
            contractFunction: sorobanTx.functionName,
            mocked: sorobanTx.mocked
          }
        })
      });
      return updated;
    });
  },

  async activate(id: string, input?: OfferActionWalletInput) {
    const offer = await this.getById(id);
    requireOfferOwner(offer, input);
    if (offer.status !== 'Funding') {
      throw new ApiError(400, 'Only Funding offers can be activated');
    }

    const sorobanTx = sorobanService.activateOfferTx(contractOfferRef(offer));
    return prisma.$transaction(async (tx) => {
      const updated = await tx.loanOffer.update({
        where: { id },
        data: {
          status: 'Active',
          txHash: sorobanTx.txHash,
          explorerUrl: sorobanTx.explorerUrl
        },
        include: { loans: true }
      });
      await tx.transaction.create({
        data: ledgerTransaction('ACTIVATE_OFFER', updated.lenderWallet, {
          offerId: id,
          asset: updated.loanAsset,
          amount: updated.loanAmount,
          txHash: sorobanTx.txHash,
          explorerUrl: sorobanTx.explorerUrl,
          details: `Activated offer ${id}; it is now visible in the marketplace.`,
          metadata: {
            contractFunction: sorobanTx.functionName,
            mocked: sorobanTx.mocked
          }
        })
      });
      return updated;
    });
  },

  async cancel(id: string, input?: OfferActionWalletInput) {
    const offer = await this.getById(id);
    requireOfferOwner(offer, input);
    ensureCancelable(offer.status);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.loanOffer.update({
        where: { id },
        data: { status: 'Cancelled' },
        include: { loans: true }
      });
      await tx.transaction.create({
        data: ledgerTransaction('CANCEL_OFFER', updated.lenderWallet, {
          offerId: updated.id,
          asset: updated.loanAsset,
          amount: updated.loanAmount,
          details: `Cancelled offer ${updated.id}; locked lender funds are released by Vault/Escrow.`
        })
      });
      return updated;
    });
  },

  async expire(id: string) {
    const offer = await this.getById(id);
    ensureCancelable(offer.status);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.loanOffer.update({
        where: { id },
        data: { status: 'Expired' },
        include: { loans: true }
      });
      await tx.transaction.create({
        data: ledgerTransaction('EXPIRE_OFFER', updated.lenderWallet, {
          offerId: updated.id,
          asset: updated.loanAsset,
          amount: updated.loanAmount,
          details: `Expired offer ${updated.id}; locked lender funds are released by Vault/Escrow.`
        })
      });
      return updated;
    });
  },

  async accept(id: string, input: AcceptOfferInput) {
    const offer = await this.getById(id);
    if (offer.status !== 'Active') {
      throw new ApiError(400, 'Borrowers can only accept Active offers');
    }
    if (input.borrowerWallet === offer.lenderWallet) {
      throw new ApiError(400, 'Borrower cannot accept their own offer');
    }
    const collateralAmount = decimal(input.collateralAmount);
    if (collateralAmount.lte(0)) {
      throw new ApiError(400, 'collateralAmount must be greater than zero');
    }

    const outstandingDebt = decimal(
      calculateRepaymentAmount(offer.loanAmount, offer.fixedAprBps / 100, offer.durationDays)
    ).toDecimalPlaces(7);
    const riskPatch = await buildRiskPatch({
      collateralAsset: offer.collateralAsset,
      loanAsset: offer.loanAsset,
      collateralAmount,
      outstandingDebt,
      liquidationThresholdBps: offer.liquidationThresholdBps
    });
    const { status: _ignoredStatus, ...riskMetrics } = riskPatch;
    const sorobanTx = sorobanService.acceptOfferTx({
      offerId: contractOfferRef(offer),
      borrower: input.borrowerWallet,
      collateralAmount: input.collateralAmount
    });

    return prisma.$transaction(async (tx) => {
      const loan = await tx.loan.create({
        data: {
          contractLoanId: input.contractLoanId,
          offerId: offer.id,
          contractOfferId: offer.contractOfferId,
          lenderWallet: offer.lenderWallet,
          borrowerWallet: input.borrowerWallet,
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
          txHash: sorobanTx.txHash,
          explorerUrl: sorobanTx.explorerUrl,
          ...riskMetrics
        },
        include: { offer: true }
      });

      await tx.loanOffer.update({
        where: { id: offer.id },
        data: {
          status: 'Matched',
          txHash: sorobanTx.txHash,
          explorerUrl: sorobanTx.explorerUrl
        }
      });

      await tx.transaction.create({
        data: ledgerTransaction('ACCEPT_OFFER', input.borrowerWallet, {
          offerId: offer.id,
          loanId: loan.id,
          asset: offer.collateralAsset,
          amount: collateralAmount,
          txHash: sorobanTx.txHash,
          explorerUrl: sorobanTx.explorerUrl,
          details: `Accepted offer ${offer.id}; loan ${loan.id} is PendingCollateral until borrower activates it.`,
          metadata: {
            contractFunction: sorobanTx.functionName,
            mocked: sorobanTx.mocked
          }
        })
      });

      return loan;
    });
  },

  async updateStatus(id: string, input: UpdateOfferStatusInput) {
    if (input.status === 'Cancelled') {
      return this.cancel(id);
    }
    if (input.status === 'Expired') {
      return this.expire(id);
    }

    const offer = await this.getById(id);
    if (offer.status === 'Matched') {
      throw new ApiError(400, 'Matched offer status is terminal');
    }

    return prisma.loanOffer.update({
      where: { id },
      data: input,
      include: { loans: true }
    });
  }
};

