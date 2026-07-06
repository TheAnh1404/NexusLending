import type { Loan, LoanOffer, LoanStatus, RiskZone } from '../../types';
import { calculateRepaymentAmount } from '../../utils/finance';
import { apiClient, toBps, toHealthFactorBps, toNumber } from './client';
import { mapBackendOffer } from './offers.api';

interface BackendLoan {
  id: string;
  offerId?: string | null;
  lenderWallet: string;
  borrowerWallet: string;
  loanAsset: string;
  principal: string;
  outstandingDebt: string;
  fixedAprBps: number;
  collateralAsset: string;
  collateralAmount: string;
  startTime?: string | null;
  dueTime?: string | null;
  maxLtvBps: number;
  liquidationThresholdBps: number;
  liquidationBonusBps: number;
  minHealthFactorBps: number;
  gracePeriodDays: number;
  healthFactor: string;
  ltv: string;
  riskZone: RiskZone;
  status: LoanStatus;
  claimedByLender?: boolean;
  closedAt?: string | null;
  createdAt: string;
  offer?: Parameters<typeof mapBackendOffer>[0] | null;
}

const durationFromDates = (start?: string | null, due?: string | null, offerDuration?: number): number => {
  if (offerDuration) return offerDuration;
  if (!start || !due) return 0;
  const days = Math.round((new Date(due).getTime() - new Date(start).getTime()) / 86_400_000);
  return Number.isFinite(days) ? Math.max(0, days) : 0;
};

export const mapBackendLoan = (loan: BackendLoan): Loan => {
  const offer = loan.offer ? mapBackendOffer(loan.offer) : undefined;

  return {
    id: loan.id,
    offerId: loan.offerId ?? offer?.id ?? '',
    borrower: loan.borrowerWallet,
    lender: loan.lenderWallet,
    amount: toNumber(loan.principal),
    asset: loan.loanAsset,
    apr: loan.fixedAprBps / 100,
    duration: durationFromDates(loan.startTime, loan.dueTime, offer?.duration),
    collateralAsset: loan.collateralAsset,
    collateralAmount: toNumber(loan.collateralAmount),
    outstandingDebt: toNumber(loan.outstandingDebt),
    maxLTV: loan.maxLtvBps / 100,
    liquidationThreshold: loan.liquidationThresholdBps / 100,
    liquidationBonus: loan.liquidationBonusBps / 100,
    healthFactor: toNumber(loan.healthFactor, 99.99),
    status: loan.status,
    borrowTime: loan.startTime ?? loan.createdAt,
    dueDate: loan.dueTime ?? loan.createdAt,
    minHealthFactor: loan.minHealthFactorBps / 10_000,
    gracePeriod: loan.gracePeriodDays,
    claimedByLender: loan.claimedByLender,
    closedAt: loan.closedAt ?? undefined,
  };
};

const mapCreateLoanFromOffer = (
  offer: LoanOffer,
  borrowerWallet: string,
  collateralAmount: number
) => {
  const now = new Date();
  return {
    offerId: offer.id,
    lenderWallet: offer.lender,
    borrowerWallet,
    loanAsset: offer.asset,
    principal: String(offer.amount),
    outstandingDebt: String(calculateRepaymentAmount(offer.amount, offer.apr, offer.duration)),
    fixedAprBps: toBps(offer.apr),
    collateralAsset: offer.collateralAsset,
    collateralAmount: String(collateralAmount),
    startTime: now.toISOString(),
    dueTime: new Date(now.getTime() + offer.duration * 86_400_000).toISOString(),
    maxLtvBps: toBps(offer.maxLTV),
    liquidationThresholdBps: toBps(offer.liquidationThreshold),
    liquidationBonusBps: toBps(offer.liquidationBonus),
    minHealthFactorBps: toHealthFactorBps(offer.minHealthFactor),
    gracePeriodDays: offer.gracePeriod,
  };
};

export const loansApi = {
  async list(): Promise<Loan[]> {
    const loans = await apiClient.get<BackendLoan[]>('/api/loans');
    return loans.map(mapBackendLoan);
  },

  async liquidatable(): Promise<Loan[]> {
    const loans = await apiClient.get<BackendLoan[]>('/api/loans/liquidatable');
    return loans.map(mapBackendLoan);
  },

  async createFromOffer(
    offer: LoanOffer,
    borrowerWallet: string,
    collateralAmount: number
  ): Promise<Loan> {
    const loan = await apiClient.post<BackendLoan>(
      '/api/loans',
      mapCreateLoanFromOffer(offer, borrowerWallet, collateralAmount)
    );
    return mapBackendLoan(loan);
  },

  async acceptOffer(
    offerId: string,
    borrowerWallet: string,
    collateralAmount: number
  ): Promise<Loan> {
    const loan = await apiClient.post<BackendLoan>(`/api/offers/${offerId}/accept`, {
      borrowerWallet,
      collateralAmount: String(collateralAmount),
    });
    return mapBackendLoan(loan);
  },

  async activate(loanId: string, wallet?: string | null): Promise<Loan> {
    const loan = await apiClient.post<BackendLoan>(`/api/loans/${loanId}/activate`, {
      wallet: wallet ?? undefined,
    });
    return mapBackendLoan(loan);
  },

  async action(
    loanId: string,
    action: 'ADD_COLLATERAL' | 'PARTIAL_REPAY' | 'FULL_REPAY' | 'LIQUIDATE' | 'CLAIM_REPAYMENT',
    wallet: string,
    amount?: number
  ): Promise<Loan> {
    const loan = await apiClient.patch<BackendLoan>(`/api/loans/${loanId}`, {
      action,
      wallet,
      amount: amount === undefined ? undefined : String(amount),
    });
    return mapBackendLoan(loan);
  },
};
