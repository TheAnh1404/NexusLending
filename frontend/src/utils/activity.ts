import type { Loan, LoanOffer, Transaction } from '../types';
import { isAdminWallet, normalizeWalletAddress } from '../config/admin';

const matchesWallet = (left?: string | null, right?: string | null): boolean =>
  normalizeWalletAddress(left) !== '' && normalizeWalletAddress(left) === normalizeWalletAddress(right);

export const isWalletRelatedActivity = (
  activity: Transaction,
  walletAddress: string | null | undefined,
  loans: Loan[],
  offers: LoanOffer[]
): boolean => {
  const normalizedWallet = normalizeWalletAddress(walletAddress);
  if (!normalizedWallet) return false;

  if (matchesWallet(activity.user, normalizedWallet)) return true;

  if (activity.type === 'UPDATE_ORACLE') {
    return isAdminWallet(normalizedWallet);
  }

  const directLoan = activity.loanId
    ? loans.find((loan) => loan.id === activity.loanId)
    : undefined;
  if (directLoan && (matchesWallet(directLoan.borrower, normalizedWallet) || matchesWallet(directLoan.lender, normalizedWallet))) {
    return true;
  }

  const directOffer = activity.offerId
    ? offers.find((offer) => offer.id === activity.offerId)
    : undefined;
  if (directOffer && matchesWallet(directOffer.lender, normalizedWallet)) {
    return true;
  }

  const offerLoan = activity.offerId
    ? loans.find((loan) => loan.offerId === activity.offerId || loan.id === directOffer?.acceptedLoanId)
    : undefined;
  return !!offerLoan && (matchesWallet(offerLoan.borrower, normalizedWallet) || matchesWallet(offerLoan.lender, normalizedWallet));
};

export const filterWalletActivities = (
  activities: Transaction[],
  walletAddress: string | null | undefined,
  loans: Loan[],
  offers: LoanOffer[]
): Transaction[] => activities.filter((activity) => isWalletRelatedActivity(activity, walletAddress, loans, offers));
