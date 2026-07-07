import { OfferStatus, Prisma, TransactionType } from '@prisma/client';

import { prisma } from '../../prisma/client';
import { ApiError } from '../../utils/apiError';
import { calculateRepaymentAmount } from '../../utils/finance';
import { buildRiskPatch } from '../loans/loans.service';
import { createLedgerTransaction, requireConfirmedReceipt } from '../transactions/chainReceipt';
import type {
  AcceptOfferInput,
  CreateOfferInput,
  OfferActionWalletInput,
  UpdateOfferStatusInput
} from './offers.schemas';

const SAFE_HEALTH_FACTOR_BPS = 14_000;

const decimal = (value: Prisma.Decimal.Value): Prisma.Decimal => new Prisma.Decimal(value);

const contractOfferRef = (offer: { contractOfferId: bigint | number | null; id: string }) =>
  offer.contractOfferId?.toString() ?? offer.id;

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
    const receipt = requireConfirmedReceipt(input);

    const data: Prisma.LoanOfferUncheckedCreateInput = {
      contractOfferId: input.contractOfferId,
      lenderWallet: input.lenderWallet,
      loanAsset: input.loanAsset,
      loanAmount: decimal(input.loanAmount),
      fixedAprBps: input.fixedAprBps,
      durationDays: input.durationDays,
      collateralAsset: input.collateralAsset,
      maxLtvBps: input.maxLtvBps,
      liquidationThresholdBps: input.liquidationThresholdBps,
      liquidationBonusBps: input.liquidationBonusBps,
      gracePeriodDays: input.gracePeriodDays,
      minHealthFactorBps: input.minHealthFactorBps,
      status: input.status ?? 'Draft',
      description: input.description,
      txHash: receipt.txHash,
      explorerUrl: receipt.explorerUrl,
      ledger: receipt.ledger,
      blockTimestamp: receipt.blockTimestamp
    };

    return prisma.$transaction(async (tx) => {
      const offer = await tx.loanOffer.create({
        data,
        include: { loans: true }
      });
      await tx.transaction.create({
        data: createLedgerTransaction('CREATE_OFFER', offer.lenderWallet, {
          offerId: offer.id,
          asset: offer.loanAsset,
          amount: offer.loanAmount,
          receipt,
          details: `Created Draft offer ${offer.id} for ${offer.loanAmount.toString()} ${offer.loanAsset}.`,
          metadata: {
            contractFunction: 'create_offer',
            contractOfferId: offer.contractOfferId?.toString()
          }
        })
      });
      return offer;
    });
  },

  async fund(id: string, input?: OfferActionWalletInput) {
    const offer = await this.getById(id);
    requireOfferOwner(offer, input);
    const receipt = requireConfirmedReceipt(input);
    if (offer.status !== 'Draft') {
      throw new ApiError(400, 'Only Draft offers can be funded');
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.loanOffer.update({
        where: { id },
        data: {
          status: 'Funding',
          txHash: receipt.txHash,
          explorerUrl: receipt.explorerUrl,
          ledger: receipt.ledger,
          blockTimestamp: receipt.blockTimestamp
        },
        include: { loans: true }
      });
      await tx.transaction.create({
        data: createLedgerTransaction('FUND_OFFER', updated.lenderWallet, {
          offerId: id,
          asset: updated.loanAsset,
          amount: updated.loanAmount,
          receipt,
          details: `Funded offer ${id}; lender funds are locked in Vault/Escrow.`,
          metadata: {
            contractFunction: 'fund_offer',
            contractOfferId: contractOfferRef(offer)
          }
        })
      });
      return updated;
    });
  },

  async activate(id: string, input?: OfferActionWalletInput) {
    const offer = await this.getById(id);
    requireOfferOwner(offer, input);
    const receipt = requireConfirmedReceipt(input);
    if (offer.status !== 'Funding') {
      throw new ApiError(400, 'Only Funding offers can be activated');
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.loanOffer.update({
        where: { id },
        data: {
          status: 'Active',
          txHash: receipt.txHash,
          explorerUrl: receipt.explorerUrl,
          ledger: receipt.ledger,
          blockTimestamp: receipt.blockTimestamp
        },
        include: { loans: true }
      });
      await tx.transaction.create({
        data: createLedgerTransaction('ACTIVATE_OFFER', updated.lenderWallet, {
          offerId: id,
          asset: updated.loanAsset,
          amount: updated.loanAmount,
          receipt,
          details: `Activated offer ${id}; it is now visible in the marketplace.`,
          metadata: {
            contractFunction: 'activate_offer',
            contractOfferId: contractOfferRef(offer)
          }
        })
      });
      return updated;
    });
  },

  async cancel(id: string, input?: OfferActionWalletInput) {
    const offer = await this.getById(id);
    requireOfferOwner(offer, input);
    const receipt = requireConfirmedReceipt(input);
    ensureCancelable(offer.status);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.loanOffer.update({
        where: { id },
        data: {
          status: 'Cancelled',
          txHash: receipt.txHash,
          explorerUrl: receipt.explorerUrl,
          ledger: receipt.ledger,
          blockTimestamp: receipt.blockTimestamp
        },
        include: { loans: true }
      });
      await tx.transaction.create({
        data: createLedgerTransaction('CANCEL_OFFER', updated.lenderWallet, {
          offerId: updated.id,
          asset: updated.loanAsset,
          amount: updated.loanAmount,
          receipt,
          details: `Cancelled offer ${updated.id}; locked lender funds are released by Vault/Escrow.`
        })
      });
      return updated;
    });
  },

  async expire(id: string, input: OfferActionWalletInput) {
    const offer = await this.getById(id);
    const receipt = requireConfirmedReceipt(input);
    ensureCancelable(offer.status);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.loanOffer.update({
        where: { id },
        data: {
          status: 'Expired',
          txHash: receipt.txHash,
          explorerUrl: receipt.explorerUrl,
          ledger: receipt.ledger,
          blockTimestamp: receipt.blockTimestamp
        },
        include: { loans: true }
      });
      await tx.transaction.create({
        data: createLedgerTransaction('EXPIRE_OFFER', updated.lenderWallet, {
          offerId: updated.id,
          asset: updated.loanAsset,
          amount: updated.loanAmount,
          receipt,
          details: `Expired offer ${updated.id}; locked lender funds are released by Vault/Escrow.`
        })
      });
      return updated;
    });
  },

  async accept(id: string, input: AcceptOfferInput) {
    const offer = await this.getById(id);
    const receipt = requireConfirmedReceipt(input);
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
          txHash: receipt.txHash,
          explorerUrl: receipt.explorerUrl,
          ledger: receipt.ledger,
          blockTimestamp: receipt.blockTimestamp,
          ...riskMetrics
        },
        include: { offer: true }
      });

      await tx.loanOffer.update({
        where: { id: offer.id },
        data: {
          status: 'Matched',
          txHash: receipt.txHash,
          explorerUrl: receipt.explorerUrl,
          ledger: receipt.ledger,
          blockTimestamp: receipt.blockTimestamp
        }
      });

      await tx.transaction.create({
        data: createLedgerTransaction('ACCEPT_OFFER', input.borrowerWallet, {
          offerId: offer.id,
          loanId: loan.id,
          asset: offer.collateralAsset,
          amount: collateralAmount,
          receipt,
          details: `Accepted offer ${offer.id}; loan ${loan.id} is PendingCollateral until borrower activates it.`,
          metadata: {
            contractFunction: 'accept_offer',
            contractOfferId: contractOfferRef(offer),
            contractLoanId: loan.contractLoanId?.toString()
          }
        })
      });

      return loan;
    });
  },

  async updateStatus(id: string, input: UpdateOfferStatusInput) {
    if (input.status === 'Cancelled') {
      return this.cancel(id, input);
    }
    if (input.status === 'Expired') {
      return this.expire(id, input);
    }

    throw new ApiError(400, 'Direct offer status writes are disabled; use a confirmed blockchain action endpoint');
  }
};
