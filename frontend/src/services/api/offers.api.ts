import type { LoanOffer, OfferStatus } from '../../types';
import type { CreateOfferInput } from '../offers/offers.service';
import { apiClient, toBps, toHealthFactorBps, toNumber } from './client';
import type { ConfirmedChainReceiptPayload } from './client';

interface BackendLoanOffer {
  id: string;
  contractOfferId?: string | null;
  lenderWallet: string;
  loanAsset: string;
  loanAmount: string;
  fixedAprBps: number;
  durationDays: number;
  collateralAsset: string;
  maxLtvBps: number;
  liquidationThresholdBps: number;
  liquidationBonusBps: number;
  gracePeriodDays: number;
  minHealthFactorBps: number;
  status: OfferStatus;
  description?: string | null;
  createdAt: string;
  loans?: Array<{ id: string }>;
}

export const mapBackendOffer = (offer: BackendLoanOffer): LoanOffer => ({
  id: offer.id,
  contractOfferId: offer.contractOfferId ? BigInt(offer.contractOfferId) : undefined,
  lender: offer.lenderWallet,
  amount: toNumber(offer.loanAmount),
  asset: offer.loanAsset,
  apr: offer.fixedAprBps / 100,
  duration: offer.durationDays,
  collateralAsset: offer.collateralAsset,
  maxLTV: offer.maxLtvBps / 100,
  liquidationThreshold: offer.liquidationThresholdBps / 100,
  liquidationBonus: offer.liquidationBonusBps / 100,
  gracePeriod: offer.gracePeriodDays,
  minHealthFactor: offer.minHealthFactorBps / 10_000,
  description: offer.description ?? '',
  createTime: offer.createdAt,
  status: offer.status,
  acceptedLoanId: offer.loans?.[0]?.id,
});

const mapCreateOffer = (
  input: CreateOfferInput,
  lenderWallet: string,
  extra: ConfirmedChainReceiptPayload & { contractOfferId: number | bigint }
) => ({
  lenderWallet,
  loanAsset: input.asset,
  loanAmount: String(input.amount),
  fixedAprBps: toBps(input.apr),
  durationDays: input.duration,
  collateralAsset: input.collateralAsset,
  maxLtvBps: toBps(input.maxLTV),
  liquidationThresholdBps: toBps(input.liquidationThreshold),
  liquidationBonusBps: toBps(input.liquidationBonus),
  gracePeriodDays: input.gracePeriod,
  minHealthFactorBps: toHealthFactorBps(input.minHealthFactor),
  description: input.description,
  ...extra,
  contractOfferId: String(extra.contractOfferId),
});

export const offersApi = {
  async list(options?: { marketplaceOnly?: boolean }): Promise<LoanOffer[]> {
    const query = options?.marketplaceOnly ? '?marketplaceOnly=true' : '';
    const offers = await apiClient.get<BackendLoanOffer[]>(`/api/offers${query}`);
    return offers.map(mapBackendOffer);
  },

  async create(
    input: CreateOfferInput,
    lenderWallet: string,
    extra: ConfirmedChainReceiptPayload & { contractOfferId: number | bigint }
  ): Promise<LoanOffer> {
    const offer = await apiClient.post<BackendLoanOffer>('/api/offers', mapCreateOffer(input, lenderWallet, extra));
    return mapBackendOffer(offer);
  },

  async createDraft(
    input: CreateOfferInput,
    lenderWallet: string,
  ): Promise<LoanOffer> {
    const offer = await apiClient.post<BackendLoanOffer>('/api/offers', {
      lenderWallet,
      loanAsset: input.asset,
      loanAmount: String(input.amount),
      fixedAprBps: toBps(input.apr),
      durationDays: input.duration,
      collateralAsset: input.collateralAsset,
      maxLtvBps: toBps(input.maxLTV),
      liquidationThresholdBps: toBps(input.liquidationThreshold),
      liquidationBonusBps: toBps(input.liquidationBonus),
      gracePeriodDays: input.gracePeriod,
      minHealthFactorBps: toHealthFactorBps(input.minHealthFactor),
      description: input.description,
    });
    return mapBackendOffer(offer);
  },

  async updateStatus(id: string, status: OfferStatus): Promise<LoanOffer> {
    const offer = await apiClient.patch<BackendLoanOffer>(`/api/offers/${id}/status`, { status });
    return mapBackendOffer(offer);
  },

  async fund(
    id: string,
    wallet: string,
    extra: ConfirmedChainReceiptPayload & { contractOfferId?: string }
  ): Promise<LoanOffer> {
    const offer = await apiClient.post<BackendLoanOffer>(`/api/offers/${id}/fund`, {
      wallet,
      ...extra,
    });
    return mapBackendOffer(offer);
  },

  async activate(id: string, wallet: string, extra: ConfirmedChainReceiptPayload): Promise<LoanOffer> {
    const offer = await apiClient.post<BackendLoanOffer>(`/api/offers/${id}/activate`, {
      wallet,
      ...extra,
    });
    return mapBackendOffer(offer);
  },

  async cancel(id: string, wallet: string, extra: ConfirmedChainReceiptPayload): Promise<LoanOffer> {
    const offer = await apiClient.post<BackendLoanOffer>(`/api/offers/${id}/cancel`, {
      wallet,
      ...extra,
    });
    return mapBackendOffer(offer);
  },
};
