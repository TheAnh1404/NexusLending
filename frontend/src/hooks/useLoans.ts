import { useLending } from '../contexts/LendingContext';
import { useWallet } from './useWallet';
import { getConnectedWalletAddress, isSameWalletAddress } from '../utils/wallet';

export const useLoans = () => {
  const { publicKey } = useWallet();
  const {
    loans,
    addCollateral,
    partialRepay,
    fullRepay,
    repayLoan,
    liquidateLoan,
    wallet,
  } = useLending();
  const connectedWalletAddress = getConnectedWalletAddress(publicKey, wallet.address);

  return {
    loans,
    walletLoans: loans.filter(
      (loan) =>
        isSameWalletAddress(loan.borrower, connectedWalletAddress) ||
        isSameWalletAddress(loan.lender, connectedWalletAddress)
    ),
    borrowerLoans: loans.filter((loan) => isSameWalletAddress(loan.borrower, connectedWalletAddress)),
    lenderLoans: loans.filter((loan) => isSameWalletAddress(loan.lender, connectedWalletAddress)),
    addCollateral,
    partialRepay,
    fullRepay,
    repayLoan,
    liquidateLoan,
  };
};
