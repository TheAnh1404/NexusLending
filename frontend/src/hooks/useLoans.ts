import { useLending } from '../contexts/LendingContext';

export const useLoans = () => {
  const {
    loans,
    addCollateral,
    partialRepay,
    fullRepay,
    repayLoan,
    liquidateLoan,
    wallet,
  } = useLending();

  return {
    loans,
    walletLoans: loans.filter((loan) => loan.borrower === wallet.address || loan.lender === wallet.address),
    borrowerLoans: loans.filter((loan) => loan.borrower === wallet.address),
    lenderLoans: loans.filter((loan) => loan.lender === wallet.address),
    addCollateral,
    partialRepay,
    fullRepay,
    repayLoan,
    liquidateLoan,
  };
};

