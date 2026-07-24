import type { WalletState } from '../../types';
import { loansApi } from '../../services/api/loans.api';
import { offersApi } from '../../services/api/offers.api';
import { oracleApi } from '../../services/api/oracle.api';
import { transactionsApi } from '../../services/api/transactions.api';
import type { LendingSnapshot } from './lendingState';
import { fetchWalletBalances } from './walletState';

export const loadLendingSnapshotFromApi = async (currentWallet: WalletState): Promise<LendingSnapshot> => {
  const address = currentWallet.address;
  const balancesPromise = address
    ? fetchWalletBalances(address)
    : Promise.resolve(null);
  const transactionsPromise = address
    ? transactionsApi.list({ relatedWallet: address })
    : Promise.resolve([]);
  const [offers, loans, oraclePrices, transactions, liveBalances] = await Promise.all([
    offersApi.list(),
    loansApi.list(),
    oracleApi.list(),
    transactionsPromise,
    balancesPromise,
  ]);

  const wallet = address && liveBalances
    ? {
        ...currentWallet,
        balanceXLM: liveBalances.balanceXLM,
        balanceUSDC: liveBalances.balanceUSDC,
      }
    : currentWallet;

  return {
    wallet,
    offers,
    loans,
    oraclePrices,
    transactions,
  };
};
