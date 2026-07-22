import type { Loan, Transaction } from '../../types';
import { HORIZON_URL, USDC_ASSET_CODE, USDC_ISSUER } from '../../services/soroban/config';

export interface WalletBalances {
  balanceXLM: number;
  balanceUSDC: number;
}

interface HorizonBalance {
  asset_type?: string;
  asset_code?: string;
  asset_issuer?: string;
  balance?: string;
}

export const zeroWalletBalances: WalletBalances = {
  balanceXLM: 0,
  balanceUSDC: 0,
};

export const mockWalletBalances: WalletBalances = {
  balanceXLM: 250000,
  balanceUSDC: 50000,
};

const applyAssetDelta = (balances: WalletBalances, asset: string | undefined, amount: number): void => {
  if (!Number.isFinite(amount) || amount === 0) return;
  if (asset === 'XLM') {
    balances.balanceXLM += amount;
    return;
  }
  if (asset === 'USDC') {
    balances.balanceUSDC += amount;
  }
};

export const calculateMockWalletBalances = (
  walletAddress: string,
  loans: Loan[],
  transactions: Transaction[]
): WalletBalances => {
  const balances = { ...mockWalletBalances };
  const loansById = new Map(loans.map((loan) => [loan.id, loan]));

  transactions.forEach((transaction) => {
    const loan = transaction.loanId ? loansById.get(transaction.loanId) : undefined;
    const amount = Number.isFinite(transaction.amount) ? transaction.amount : 0;

    if (transaction.type === 'FUND_OFFER' && transaction.user === walletAddress) {
      applyAssetDelta(balances, transaction.asset, -amount);
      return;
    }

    if (transaction.type === 'CANCEL_OFFER' && transaction.user === walletAddress) {
      applyAssetDelta(balances, transaction.asset, amount);
      return;
    }

    if (transaction.type === 'ACTIVATE_LOAN' && loan?.borrower === walletAddress) {
      applyAssetDelta(balances, loan.asset, loan.amount);
      applyAssetDelta(balances, loan.collateralAsset, -loan.collateralAmount);
      return;
    }

    if (transaction.type === 'ADD_COLLATERAL' && transaction.user === walletAddress) {
      applyAssetDelta(balances, transaction.asset, -amount);
      return;
    }

    if (transaction.type === 'PARTIAL_REPAY' || transaction.type === 'FULL_REPAY' || transaction.type === 'REPAY') {
      if (transaction.user === walletAddress) {
        applyAssetDelta(balances, transaction.asset, -amount);
      }
      if (loan?.lender === walletAddress) {
        applyAssetDelta(balances, transaction.asset, amount);
      }
      return;
    }

    if (transaction.type === 'LIQUIDATE' && transaction.user === walletAddress) {
      applyAssetDelta(balances, transaction.asset, -amount);
    }
  });

  return balances;
};

const isConfiguredUsdcBalance = (balance: HorizonBalance): boolean =>
  balance.asset_type !== 'native'
  && balance.asset_code === USDC_ASSET_CODE
  && !!USDC_ISSUER
  && balance.asset_issuer === USDC_ISSUER;

export const fetchWalletBalances = async (
  address: string,
  fallbackBalances: WalletBalances = zeroWalletBalances
): Promise<WalletBalances> => {
  try {
    const horizonUrl = HORIZON_URL.replace(/\/$/, '');
    const response = await fetch(`${horizonUrl}/accounts/${address}`);
    if (!response.ok) {
      return fallbackBalances;
    }

    const data = await response.json() as { balances?: HorizonBalance[] };
    let xlm = 0;
    let usdc = 0;

    if (Array.isArray(data.balances)) {
      for (const balance of data.balances) {
        if (balance.asset_type === 'native') {
          xlm = Number(balance.balance ?? 0);
        } else if (isConfiguredUsdcBalance(balance)) {
          usdc = Number(balance.balance ?? 0);
        }
      }
    }

    return {
      balanceXLM: Number.isFinite(xlm) ? xlm : fallbackBalances.balanceXLM,
      balanceUSDC: Number.isFinite(usdc) ? usdc : fallbackBalances.balanceUSDC,
    };
  } catch (error) {
    console.error('Error fetching wallet balances from Horizon:', error);
    return fallbackBalances;
  }
};
