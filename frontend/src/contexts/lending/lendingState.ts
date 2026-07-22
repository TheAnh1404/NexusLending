import type { Loan, LoanOffer, OraclePrice, Transaction, WalletState } from '../../types';
import { initialActivities } from '../../data/mockActivities';
import { initialLoanOffers, initialLoans } from '../../data/mockLoans';
import { initialOraclePrices } from '../../data/mockOracle';
import { isOpenLoanStatus } from '../../utils/finance';
import { loansService } from '../../services/loans/loans.service';
import { offersService } from '../../services/offers/offers.service';

export const STORAGE_KEY = 'nexus_lending_state_v3';

export interface OracleImpact {
  loanId: string;
  oldHF: number;
  newHF: number;
  oldStatus: Loan['status'];
  newStatus: Loan['status'];
}

export interface LendingSnapshot {
  wallet: WalletState;
  offers: LoanOffer[];
  loans: Loan[];
  oraclePrices: OraclePrice[];
  transactions: Transaction[];
}

export const disconnectedWallet: WalletState = {
  connected: false,
  address: null,
  role: null,
  balanceXLM: 0,
  balanceUSDC: 0,
};

export const normalizeOffers = (offers: LoanOffer[]): LoanOffer[] => offers.map(offersService.normalize);

export const getPrices = (oraclePrices: OraclePrice[]) => ({
  xlmPrice: oraclePrices.find((price) => price.asset === 'XLM')?.price ?? 0.125,
  usdcPrice: oraclePrices.find((price) => price.asset === 'USDC')?.price ?? 1,
});

export const normalizeLoans = (loans: Loan[], oraclePrices: OraclePrice[]): Loan[] => {
  const prices = getPrices(oraclePrices);
  return loans.map((loan) => loansService.normalize(loan, prices));
};

export const getInitialSnapshot = (): LendingSnapshot => {
  const fallback: LendingSnapshot = {
    wallet: disconnectedWallet,
    offers: normalizeOffers(initialLoanOffers),
    loans: normalizeLoans(initialLoans, initialOraclePrices),
    oraclePrices: initialOraclePrices,
    transactions: initialActivities,
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<LendingSnapshot>;
    const oraclePrices = parsed.oraclePrices?.length ? parsed.oraclePrices : fallback.oraclePrices;
    return {
      wallet: parsed.wallet ?? fallback.wallet,
      offers: normalizeOffers(parsed.offers?.length ? parsed.offers : fallback.offers),
      loans: normalizeLoans(parsed.loans?.length ? parsed.loans : fallback.loans, oraclePrices),
      oraclePrices,
      transactions: parsed.transactions?.length ? parsed.transactions : fallback.transactions,
    };
  } catch {
    return fallback;
  }
};

export const buildOracleImpacts = (previousLoans: Loan[], nextLoans: Loan[]): OracleImpact[] => {
  return nextLoans.flatMap((loan) => {
    const previous = previousLoans.find((item) => item.id === loan.id);
    if (!previous || !isOpenLoanStatus(loan.status)) return [];
    if (previous.healthFactor === loan.healthFactor && previous.status === loan.status) return [];
    return [{
      loanId: loan.id,
      oldHF: previous.healthFactor,
      newHF: loan.healthFactor,
      oldStatus: previous.status,
      newStatus: loan.status,
    }];
  });
};
