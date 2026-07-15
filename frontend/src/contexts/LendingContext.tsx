import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { App } from 'antd';

import type { Loan, LoanOffer, OraclePrice, Transaction, UserRole, WalletState } from '../types';
import { initialLoanOffers, initialLoans } from '../data/mockLoans';
import { initialOraclePrices } from '../data/mockOracle';
import { initialActivities } from '../data/mockActivities';
import { MAX_FIXED_APR_PERCENT, calculateMaxLiquidationRepay, isLiquidatable, isOpenLoanStatus } from '../utils/finance';
import { loansService } from '../services/loans/loans.service';
import { offersService, type CreateOfferInput } from '../services/offers/offers.service';
import { oracleService } from '../services/oracle/oracle.service';
import { transactionsService } from '../services/transactions/transactions.service';
import { CHAIN_MODE, DATA_MODE, DEFAULT_MOCK_WALLET_ADDRESS } from '../services/api/client';
import type { ConfirmedChainReceiptPayload } from '../services/api/client';
import { offersApi } from '../services/api/offers.api';
import { loansApi } from '../services/api/loans.api';
import { oracleApi } from '../services/api/oracle.api';
import { transactionsApi } from '../services/api/transactions.api';
import { marketplaceContract } from '../services/soroban/marketplace.contract';
import { loanManagerContract } from '../services/soroban/loanManager.contract';
import { oracleContract } from '../services/soroban/oracle.contract';
import { CONTRACTS } from '../services/soroban/config';
import { createUsdcTrustline, hasUsdcTrustline, swapStellarAssets } from '../services/soroban/transaction';
import type { SwapDirection, TxResult, TxStage } from '../services/soroban/transaction';
import { ADMIN_WALLET_ADDRESS, isAdminWallet } from '../config/admin';

const STORAGE_KEY = 'nexus_lending_state_v3';

export const clearLegacyFrontendData = () => {
  localStorage.removeItem('nexus_lending_state_v2');
  localStorage.removeItem('nexus_lending_state_v3');
  localStorage.removeItem('nexus_notification_settings');
  Object.keys(localStorage)
    .filter((key) => key.startsWith('nexus_notification_settings_'))
    .forEach((key) => localStorage.removeItem(key));
  localStorage.removeItem('nexus_freighter_connected');
};

export const clearDemoData = clearLegacyFrontendData;

if (typeof window !== 'undefined') {
  (window as any).clearLegacyFrontendData = clearLegacyFrontendData;
  (window as any).clearDemoData = clearDemoData;
}


export interface OracleImpact {
  loanId: string;
  oldHF: number;
  newHF: number;
  oldStatus: Loan['status'];
  newStatus: Loan['status'];
}

interface LendingSnapshot {
  wallet: WalletState;
  offers: LoanOffer[];
  loans: Loan[];
  oraclePrices: OraclePrice[];
  transactions: Transaction[];
}

interface LendingContextValue {
  wallet: WalletState;
  currentUserWallet: string | null;
  offers: LoanOffer[];
  loanOffers: LoanOffer[];
  loans: Loan[];
  oraclePrices: OraclePrice[];
  transactions: Transaction[];
  activities: Transaction[];
  connectWallet: (address: string, role?: UserRole) => void;
  disconnectWallet: () => void;
  createOffer: (offer: CreateOfferInput) => Promise<LoanOffer | null>;
  createLoanOffer: (offer: CreateOfferInput) => Promise<void>;
  fundOffer: (offerId: string) => Promise<LoanOffer | null>;
  activateOffer: (offerId: string) => Promise<LoanOffer | null>;
  cancelOffer: (offerId: string) => Promise<void>;
  acceptOffer: (offerId: string, collateralAmount: number) => Promise<Loan | null>;
  activateLoan: (loanId: string) => Promise<Loan | null>;
  borrowLoan: (offerId: string, collateralAmount: number) => Promise<void>;
  addCollateral: (loanId: string, amount: number) => Promise<void>;
  partialRepay: (loanId: string, amount: number) => Promise<void>;
  fullRepay: (loanId: string) => Promise<void>;
  repayLoan: (loanId: string, amount: number, isFullRepay: boolean) => Promise<Loan | null>;
  updateOraclePrice: (newPrice: number) => Promise<OracleImpact[]>;
  recalculateAllHealthFactors: () => Promise<OracleImpact[]>;
  liquidateLoan: (loanId: string, repayAmount: number) => Promise<void>;
  addTransaction: (transaction: Transaction) => void;
  swapTokens: (direction: SwapDirection, receiveAmount: number, maxSendAmount: number) => Promise<boolean>;
  refreshData: () => Promise<void>;
}

const disconnectedWallet: WalletState = {
  connected: false,
  address: null,
  role: null,
  balanceXLM: 0,
  balanceUSDC: 0,
};

const normalizeOffers = (offers: LoanOffer[]): LoanOffer[] => offers.map(offersService.normalize);

const getPrices = (oraclePrices: OraclePrice[]) => ({
  xlmPrice: oraclePrices.find((price) => price.asset === 'XLM')?.price ?? 0.125,
  usdcPrice: oraclePrices.find((price) => price.asset === 'USDC')?.price ?? 1,
});

const txStageLabels: Record<TxStage, string> = {
  preparing: 'Preparing Transaction...',
  wallet: 'Waiting for Wallet Signature...',
  submitting: 'Submitting Transaction...',
  confirming: 'Waiting for Blockchain Confirmation...',
  confirmed: 'Transaction Confirmed',
};

const txReceiptFromResult = (txRes: TxResult): ConfirmedChainReceiptPayload => ({
  txHash: txRes.txHash,
  explorerUrl: txRes.explorerUrl,
  ledger: txRes.ledger,
  txStatus: txRes.status,
  contractId: txRes.contractId,
  blockTimestamp: txRes.blockTimestamp,
  contractReturnValue: txRes.contractReturnValue,
});

const randomHex64 = (): string => {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
};

const nextMockContractId = (): bigint =>
  BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000));

const createMockTxResult = (
  contractId: string,
  functionName: string,
  contractReturnValue?: unknown
): TxResult => {
  const txHash = randomHex64();
  return {
    txHash,
    explorerUrl: `https://stellar.expert/explorer/testnet/tx/${txHash}`,
    ledger: Math.max(1, Math.floor(Date.now() / 1000)),
    status: 'SUCCESS',
    contractId,
    functionName,
    blockTimestamp: new Date().toISOString(),
    contractReturnValue,
  };
};

const contractReturnId = (txRes: TxResult, label: string): bigint => {
  if (txRes.contractReturnValue === undefined || txRes.contractReturnValue === null) {
    throw new Error(`${label} was not returned by the Soroban contract.`);
  }
  return BigInt(String(txRes.contractReturnValue));
};

const normalizeLoans = (loans: Loan[], oraclePrices: OraclePrice[]): Loan[] => {
  const prices = getPrices(oraclePrices);
  return loans.map((loan) => loansService.normalize(loan, prices));
};

const getInitialSnapshot = (): LendingSnapshot => {
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

const buildOracleImpacts = (previousLoans: Loan[], nextLoans: Loan[]): OracleImpact[] => {
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

interface WalletBalances {
  balanceXLM: number;
  balanceUSDC: number;
}

const zeroWalletBalances: WalletBalances = {
  balanceXLM: 0,
  balanceUSDC: 0,
};

const mockWalletBalances: WalletBalances = {
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

const calculateMockWalletBalances = (
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

const fetchWalletBalances = async (
  address: string,
  fallbackBalances: WalletBalances = zeroWalletBalances
): Promise<WalletBalances> => {
  try {
    const response = await fetch(`https://horizon-testnet.stellar.org/accounts/${address}`);
    if (!response.ok) {
      return fallbackBalances;
    }
    const data = await response.json();
    let xlm = 0;
    let usdc = 0;
    
    if (data && Array.isArray(data.balances)) {
      for (const bal of data.balances) {
        if (bal.asset_type === 'native') {
          xlm = parseFloat(bal.balance);
        } else if (bal.asset_code === 'USDC') {
          usdc = parseFloat(bal.balance);
        }
      }
    }
    return { balanceXLM: xlm, balanceUSDC: usdc };
  } catch (e) {
    console.error('Error fetching wallet balances from Horizon:', e);
    return fallbackBalances;
  }
};

const LendingContext = createContext<LendingContextValue | undefined>(undefined);

export const LendingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { message, notification } = App.useApp();

  const [snapshot, setSnapshot] = useState<LendingSnapshot>(() => getInitialSnapshot());
  const walletRef = useRef(snapshot.wallet);
  const lastSorobanErrorRef = useRef<string | null>(null);
  const isApiMode = DATA_MODE === 'api';
  const isMockChainMode = isApiMode && CHAIN_MODE === 'mock';

  const refreshLiveWalletBalances = useCallback(async (): Promise<void> => {
    if (!isApiMode || isMockChainMode) return;

    const currentWallet = walletRef.current;
    if (!currentWallet.connected || !currentWallet.address) return;

    const balances = await fetchWalletBalances(currentWallet.address, {
      balanceXLM: currentWallet.balanceXLM,
      balanceUSDC: currentWallet.balanceUSDC,
    });

    setSnapshot((prev) => {
      if (!prev.wallet.connected || prev.wallet.address !== currentWallet.address) return prev;
      const nextWallet = {
        ...prev.wallet,
        balanceXLM: balances.balanceXLM,
        balanceUSDC: balances.balanceUSDC,
      };
      walletRef.current = nextWallet;
      return {
        ...prev,
        wallet: nextWallet,
      };
    });
  }, [isApiMode, isMockChainMode]);

  const runSorobanTransaction = useCallback(async (
    send: (onStage: (stage: TxStage) => void) => Promise<TxResult>
  ): Promise<TxResult | null> => {
    let closeStageMessage: (() => void) | undefined;
    const showStage = (stage: TxStage) => {
      closeStageMessage?.();
      closeStageMessage = message.loading(txStageLabels[stage], 0);
    };

    try {
      lastSorobanErrorRef.current = null;
      const txRes = await send(showStage);
      closeStageMessage?.();
      notification.success({
        message: 'Transaction Confirmed',
        description: <a href={txRes.explorerUrl} target="_blank" rel="noreferrer">View on Stellar Expert</a>,
      });
      return txRes;
    } catch (error) {
      closeStageMessage?.();
      const details = error instanceof Error ? error.message : 'Transaction failed';
      lastSorobanErrorRef.current = details;
      message.error(details);
      void refreshLiveWalletBalances().catch((balanceError) => {
        console.error('Unable to refresh wallet balances after failed transaction:', balanceError);
      });
      return null;
    }
  }, [message, notification, refreshLiveWalletBalances]);

  const runChainTransaction = useCallback(async (
    contractId: string,
    functionName: string,
    send: (onStage: (stage: TxStage) => void) => Promise<TxResult>,
    mockReturnValue?: unknown
  ): Promise<TxResult | null> => {
    if (!isMockChainMode) {
      return runSorobanTransaction(send);
    }

    const txRes = createMockTxResult(contractId, functionName, mockReturnValue);
    notification.success({
      message: 'Mock chain transaction confirmed',
      description: `${functionName} was recorded through the backend without calling Soroban.`,
    });
    return txRes;
  }, [isMockChainMode, notification, runSorobanTransaction]);


  useEffect(() => {
    walletRef.current = snapshot.wallet;
  }, [snapshot.wallet]);

  useEffect(() => {
    if (!isApiMode) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    }
  }, [isApiMode, snapshot]);

  const refreshFromApi = useCallback(async (): Promise<LendingSnapshot> => {
    const currentWallet = walletRef.current;
    const address = currentWallet.address;
    const balancesPromise = address && !isMockChainMode
      ? fetchWalletBalances(address)
      : Promise.resolve(null);
    const transactionsPromise = address
      ? isAdminWallet(address)
        ? transactionsApi.list()
        : transactionsApi.list({ relatedWallet: address })
      : Promise.resolve([]);
    const [offers, loans, oraclePrices, transactions, liveBalances] = await Promise.all([
      offersApi.list(),
      loansApi.list(),
      oracleApi.list(),
      transactionsPromise,
      balancesPromise,
    ]);
    const normalizedLoans = normalizeLoans(loans, oraclePrices);
    const balances = address
      ? isMockChainMode
        ? calculateMockWalletBalances(address, normalizedLoans, transactions)
        : liveBalances
      : null;

    let updatedWallet = currentWallet;
    if (address && balances) {
      updatedWallet = {
        ...currentWallet,
        balanceXLM: balances.balanceXLM,
        balanceUSDC: balances.balanceUSDC,
      };
    }

    setSnapshot((prev) => {
      const nextWallet = address && balances && prev.wallet.address === address
        ? {
            ...prev.wallet,
            balanceXLM: balances.balanceXLM,
            balanceUSDC: balances.balanceUSDC,
          }
        : prev.wallet;
      walletRef.current = nextWallet;
      return {
        ...prev,
        wallet: nextWallet,
        offers,
        loans: normalizedLoans,
        oraclePrices,
        transactions,
      };
    });

    return {
      wallet: updatedWallet,
      offers,
      loans: normalizedLoans,
      oraclePrices,
      transactions,
    };
  }, [isMockChainMode]);

  useEffect(() => {
    if (!isApiMode) return;
    void refreshFromApi().catch((error) => {
      message.error(error instanceof Error ? error.message : 'Unable to load backend data.');
    });
  }, [isApiMode, message, refreshFromApi]);

  const pushTransaction = useCallback((transaction: Transaction) => {
    if (isApiMode) {
      void transactionsApi.create(transaction)
        .then(() => refreshFromApi())
        .catch((error) => {
          message.error(error instanceof Error ? error.message : 'Unable to record transaction.');
        });
      return;
    }

    setSnapshot((prev) => ({
      ...prev,
      transactions: [transaction, ...prev.transactions],
    }));
  }, [isApiMode, message, refreshFromApi]);

  const refreshData = useCallback(async (): Promise<void> => {
    if (isApiMode) {
      await refreshFromApi();
      return;
    }

    setSnapshot((prev) => ({
      ...prev,
      loans: normalizeLoans(prev.loans, prev.oraclePrices),
      offers: normalizeOffers(prev.offers),
    }));
  }, [isApiMode, refreshFromApi]);

  const connectWallet = useCallback((address: string, _role?: UserRole) => {
    const isMockSandboxAddress = address === DEFAULT_MOCK_WALLET_ADDRESS;
    const shouldUseLiveBalances = isApiMode && !isMockChainMode;
    const initialBalances = shouldUseLiveBalances ? zeroWalletBalances : mockWalletBalances;
    const nextWallet: WalletState = {
      connected: true,
      address,
      role: null, // role is now optional/null for multi-role accounts
      balanceXLM: initialBalances.balanceXLM,
      balanceUSDC: initialBalances.balanceUSDC,
    };
    setSnapshot((prev) => ({
      ...prev,
      wallet: nextWallet,
    }));
    walletRef.current = nextWallet;

    if (isApiMode) {
      void refreshFromApi().catch((error) => {
        message.error(error instanceof Error ? error.message : 'Unable to load wallet activity.');
      });
    }

    if (shouldUseLiveBalances || (!isMockSandboxAddress && !isMockChainMode)) {
      void fetchWalletBalances(address, shouldUseLiveBalances ? zeroWalletBalances : mockWalletBalances).then((balances) => {
        setSnapshot((prev) => {
          if (!prev.wallet.connected || prev.wallet.address !== address) return prev;
          return {
            ...prev,
            wallet: {
              ...prev.wallet,
              balanceXLM: balances.balanceXLM,
              balanceUSDC: balances.balanceUSDC,
            },
          };
        });
      });
    }
  }, [isApiMode, isMockChainMode, message, refreshFromApi]);

  const disconnectWallet = useCallback(() => {
    setSnapshot((prev) => ({
      ...prev,
      wallet: disconnectedWallet,
    }));
  }, []);

  const createOffer = useCallback(async (offer: CreateOfferInput) => {
    const { wallet } = snapshot;
    const walletAddress = wallet.address;
    if (!wallet.connected || !walletAddress) {
      throw new Error('Connect your wallet before creating a loan offer.');
    }
    if (offer.asset !== 'USDC' || offer.collateralAsset !== 'XLM') {
      throw new Error('Loan creation currently supports USDC lending backed by XLM collateral only.');
    }
    if (offer.maxLTV > offer.liquidationThreshold) {
      throw new Error('Max LTV must be less than or equal to liquidation threshold.');
    }
    if (offer.apr > MAX_FIXED_APR_PERCENT) {
      throw new Error(`Fixed APR cannot exceed ${MAX_FIXED_APR_PERCENT}% per year.`);
    }
    if (offer.minHealthFactor < 1.4) {
      throw new Error('Minimum Health Factor must be at least 1.40.');
    }

    if (isApiMode) {
      try {
        const created = await offersApi.createDraft(offer, walletAddress);
        await refreshFromApi();
        notification.success({
          message: 'Draft offer created',
          description: `${offer.amount.toLocaleString()} ${offer.asset} terms are saved. Fund the offer to deploy on-chain.`,
        });
        return created;
      } catch (error) {
        const details = error instanceof Error ? error.message : 'Failed to create draft offer.';
        message.error(details);
        throw error instanceof Error ? error : new Error(details);
      }
    }

    const newOffer = offersService.create(offer, walletAddress);
    const transaction = transactionsService.create({
      type: 'CREATE_OFFER',
      user: walletAddress,
      amount: offer.amount,
      asset: offer.asset,
      offerId: newOffer.id,
      details: `Created offer ${newOffer.id} for ${offer.amount.toLocaleString()} ${offer.asset} at ${offer.apr}% APR.`,
    });

    setSnapshot((prev) => ({
      ...prev,
      offers: [newOffer, ...prev.offers],
      transactions: [transaction, ...prev.transactions],
    }));

    notification.success({
      message: 'Draft offer created',
      description: 'Fund this offer to lock lender funds before marketplace activation.',
    });

    return newOffer;
  }, [isApiMode, message, notification, refreshFromApi, snapshot]);

  const getLatestOfferForAction = useCallback(async (offerId: string): Promise<LoanOffer | null> => {
    if (!isApiMode) {
      return snapshot.offers.find((item) => item.id === offerId) ?? null;
    }

    try {
      const offers = await offersApi.list();
      return offers.find((item) => item.id === offerId)
        ?? snapshot.offers.find((item) => item.id === offerId)
        ?? null;
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Unable to load the latest offer state.');
      return snapshot.offers.find((item) => item.id === offerId) ?? null;
    }
  }, [isApiMode, message, snapshot.offers]);

  const getLatestLoanForAction = useCallback(async (loanId: string): Promise<Loan | null> => {
    if (!isApiMode) {
      return snapshot.loans.find((item) => item.id === loanId) ?? null;
    }

    try {
      const loans = await loansApi.list();
      return loans.find((item) => item.id === loanId)
        ?? snapshot.loans.find((item) => item.id === loanId)
        ?? null;
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Unable to load the latest loan state.');
      return snapshot.loans.find((item) => item.id === loanId) ?? null;
    }
  }, [isApiMode, message, snapshot.loans]);

  const fundOffer = useCallback(async (offerId: string) => {
    const walletAddress = snapshot.wallet.address;
    const offer = await getLatestOfferForAction(offerId);
    if (!offer) {
      message.error('Offer not found.');
      return null;
    }
    if (offer.status !== 'Draft') {
      message.error('Only Draft offers can be funded.');
      return null;
    }
    if (!walletAddress || offer.lender !== walletAddress) {
      message.error('Only the offer lender can fund this offer.');
      return null;
    }
    const fundingBalance = offer.asset === 'XLM' ? snapshot.wallet.balanceXLM : snapshot.wallet.balanceUSDC;
    if (fundingBalance < offer.amount) {
      message.error(`Insufficient ${offer.asset} balance to fund this offer.`);
      return null;
    }

    if (isApiMode) {
      let currentOffer = offer;
      let contractOfferId = currentOffer.contractOfferId;

      if (contractOfferId !== undefined && !isMockChainMode) {
        let synced: LoanOffer;
        try {
          synced = await offersApi.syncChain(offerId, walletAddress);
          await refreshFromApi();
        } catch (error) {
          const details = error instanceof Error ? error.message : 'Unable to verify the on-chain offer state.';
          message.error(details);
          return null;
        }

        currentOffer = synced;
        contractOfferId = synced.contractOfferId;
        if (['Funding', 'Active', 'Matched'].includes(synced.status ?? 'Draft')) {
          notification.info({
            message: 'Offer already funded',
            description: 'The on-chain state has been synced. No additional funding transaction was submitted.',
          });
          return synced;
        }
        if (synced.status !== 'Draft') {
          message.error(`Offer is ${synced.status ?? 'unknown'} and cannot be funded.`);
          return null;
        }
      }

      if (contractOfferId === undefined) {
        // Step 1: Deploy offer on-chain via create_offer (wallet signature required)
        const createInput: CreateOfferInput = {
          amount: currentOffer.amount,
          asset: currentOffer.asset,
          apr: currentOffer.apr,
          duration: currentOffer.duration,
          collateralAsset: currentOffer.collateralAsset,
          maxLTV: currentOffer.maxLTV,
          liquidationThreshold: currentOffer.liquidationThreshold,
          liquidationBonus: currentOffer.liquidationBonus,
          gracePeriod: currentOffer.gracePeriod,
          minHealthFactor: currentOffer.minHealthFactor,
          description: currentOffer.description,
        };
        const mockContractOfferId = nextMockContractId();
        const createTxRes = await runChainTransaction(
          CONTRACTS.marketplace,
          'create_offer',
          (onStage) => marketplaceContract.createOfferTx(createInput, walletAddress, onStage),
          mockContractOfferId.toString()
        );
        if (!createTxRes) return null;

        contractOfferId = contractReturnId(createTxRes, 'contractOfferId');
        try {
          currentOffer = await offersApi.deploy(offerId, walletAddress, {
            ...txReceiptFromResult(createTxRes),
            contractOfferId: String(contractOfferId),
          });
          contractOfferId = currentOffer.contractOfferId ?? contractOfferId;
          await refreshFromApi();
        } catch (error) {
          const details = error instanceof Error ? error.message : 'Unable to save deployed offer before funding.';
          message.error(details);
          notification.warning({
            message: 'Offer deployed but not funded',
            description: 'No escrow funding transaction was submitted because the backend did not persist the contract offer id.',
          });
          return null;
        }
      }

      // Step 2: Fund the offer escrow on-chain (wallet signature required)
      const fundTxRes = await runChainTransaction(
        CONTRACTS.marketplace,
        'fund_offer',
        (onStage) => marketplaceContract.fundOfferTx(contractOfferId, walletAddress, onStage)
      );
      if (!fundTxRes) return null;

      try {
        const funded = await offersApi.fund(offerId, walletAddress, {
          ...txReceiptFromResult(fundTxRes),
          contractOfferId: String(contractOfferId),
        });
        await refreshFromApi();
        notification.success({ message: 'Offer funded', description: 'Offer deployed on-chain and lender funds locked in Vault/Escrow.' });
        return funded;
      } catch (error) {
        if (!isMockChainMode) {
          try {
            const synced = await offersApi.syncChain(offerId, walletAddress);
            await refreshFromApi();
            if (['Funding', 'Active', 'Matched'].includes(synced.status ?? 'Draft')) {
              notification.warning({
                message: 'Offer funded and synced',
                description: 'The funding transaction was confirmed. Backend receipt persistence failed, but the on-chain status is now recorded so it will not fund again.',
              });
              return synced;
            }
          } catch (syncError) {
            console.error('Unable to sync offer after confirmed funding transaction:', syncError);
          }
        }

        const details = error instanceof Error ? error.message : 'Unable to persist the funding transaction.';
        message.error(details);
        return null;
      }
    }

    const transaction = transactionsService.create({
      type: 'FUND_OFFER',
      user: offer.lender,
      amount: offer.amount,
      asset: offer.asset,
      offerId,
      details: `Funded offer ${offerId}; ${offer.amount.toLocaleString()} ${offer.asset} locked in escrow.`,
    });
    const updatedOffer = offersService.updateStatus(offer, 'Funding');

    setSnapshot((prev) => ({
      ...prev,
      wallet: {
        ...prev.wallet,
        balanceXLM: offer.asset === 'XLM' ? prev.wallet.balanceXLM - offer.amount : prev.wallet.balanceXLM,
        balanceUSDC: offer.asset === 'USDC' ? prev.wallet.balanceUSDC - offer.amount : prev.wallet.balanceUSDC,
      },
      offers: prev.offers.map((item) => (item.id === offerId ? updatedOffer : item)),
      transactions: [transaction, ...prev.transactions],
    }));

    notification.success({ message: 'Offer funded', description: 'Activate it to list it in the marketplace.' });
    return updatedOffer;
  }, [getLatestOfferForAction, isApiMode, isMockChainMode, message, notification, refreshFromApi, runChainTransaction, snapshot]);

  const activateOffer = useCallback(async (offerId: string) => {
    const walletAddress = snapshot.wallet.address;
    let offer = await getLatestOfferForAction(offerId);
    if (!offer) {
      message.error('Offer not found.');
      return null;
    }
    if (!walletAddress || offer.lender !== walletAddress) {
      message.error('Only the offer lender can activate this offer.');
      return null;
    }

    if (isApiMode && !isMockChainMode && offer.contractOfferId !== undefined) {
      try {
        offer = await offersApi.syncChain(offerId, walletAddress);
        await refreshFromApi();
        if (offer.status === 'Active') {
          notification.info({
            message: 'Offer already activated',
            description: 'The on-chain listing is already Active. No additional activation transaction was submitted.',
          });
          return offer;
        }
      } catch (error) {
        console.error('Unable to sync offer before activation:', error);
      }
    }

    if (offer.status !== 'Funding') {
      message.error(`Offer is ${offer.status ?? 'unknown'}. Only Funding offers can be activated.`);
      return null;
    }

    if (isApiMode) {
      if (!isMockChainMode && offer.contractOfferId === undefined) {
        throw new Error('Offer is missing contractOfferId. Fund the offer on-chain before activation.');
      }
      const contractOfferId = offer.contractOfferId ?? nextMockContractId();
      const txRes = await runChainTransaction(
        CONTRACTS.marketplace,
        'activate_offer',
        (onStage) => marketplaceContract.activateOfferTx(contractOfferId, walletAddress, onStage)
      );
      if (!txRes) return null;

      try {
        const active = await offersApi.activate(offerId, walletAddress, txReceiptFromResult(txRes));
        await refreshFromApi();
        notification.success({ message: 'Offer activated', description: 'The offer is now visible in the marketplace.' });
        return active;
      } catch (error) {
        if (!isMockChainMode) {
          try {
            const synced = await offersApi.syncChain(offerId, walletAddress);
            await refreshFromApi();
            if (synced.status === 'Active') {
              notification.warning({
                message: 'Offer activated and synced',
                description: 'The activation transaction was confirmed. Backend receipt persistence raced with chain indexing, so the Active state was synced.',
              });
              return synced;
            }
          } catch (syncError) {
            console.error('Unable to sync offer after confirmed activation transaction:', syncError);
          }
        }

        const details = error instanceof Error ? error.message : 'Unable to persist the activation transaction.';
        message.error(details);
        return null;
      }
    }

    const transaction = transactionsService.create({
      type: 'ACTIVATE_OFFER',
      user: offer.lender,
      amount: offer.amount,
      asset: offer.asset,
      offerId,
      details: `Activated offer ${offerId}; borrower matching is now enabled.`,
    });
    const updatedOffer = offersService.updateStatus(offer, 'Active');

    setSnapshot((prev) => ({
      ...prev,
      offers: prev.offers.map((item) => (item.id === offerId ? updatedOffer : item)),
      transactions: [transaction, ...prev.transactions],
    }));

    notification.success({ message: 'Offer activated', description: 'The offer is now listed in the marketplace.' });
    return updatedOffer;
  }, [getLatestOfferForAction, isApiMode, isMockChainMode, message, notification, refreshFromApi, runChainTransaction, snapshot]);

  const cancelOffer = useCallback(async (offerId: string) => {
    const walletAddress = snapshot.wallet.address;
    const offer = snapshot.offers.find((item) => item.id === offerId);
    if (!offer) {
      message.error('Offer not found.');
      return;
    }
    if (!['Draft', 'Funding', 'Active'].includes(offer.status ?? 'Draft')) {
      message.error('Only Draft, Funding, or Active offers can be cancelled.');
      return;
    }
    if (!walletAddress || offer.lender !== walletAddress) {
      message.error('Only the offer lender can cancel this offer.');
      return;
    }

    if (isApiMode) {
      if (!isMockChainMode && offer.contractOfferId === undefined) {
        throw new Error('Offer is missing contractOfferId. It cannot be cancelled on-chain.');
      }
      const contractOfferId = offer.contractOfferId ?? nextMockContractId();
      const txRes = await runChainTransaction(
        CONTRACTS.marketplace,
        'cancel_offer',
        (onStage) => marketplaceContract.cancelOfferTx(contractOfferId, walletAddress, onStage)
      );
      if (!txRes) return;

      await offersApi.cancel(offerId, walletAddress, txReceiptFromResult(txRes));
      await refreshFromApi();
      notification.success({ message: 'Offer cancelled', description: `${offerId} is no longer available.` });
      return;
    }

    const transaction = transactionsService.create({
      type: 'CANCEL_OFFER',
      user: offer.lender,
      amount: offer.amount,
      asset: offer.asset,
      offerId,
      details: `Cancelled offer ${offerId} and released ${offer.amount.toLocaleString()} ${offer.asset}.`,
    });

    setSnapshot((prev) => ({
      ...prev,
      wallet: {
        ...prev.wallet,
        balanceUSDC: offer.status === 'Funding' || offer.status === 'Active'
          ? prev.wallet.balanceUSDC + offer.amount
          : prev.wallet.balanceUSDC,
      },
      offers: prev.offers.map((item) => (item.id === offerId ? offersService.updateStatus(item, 'Cancelled') : item)),
      transactions: [transaction, ...prev.transactions],
    }));

    notification.success({ message: 'Offer cancelled', description: `${offerId} is no longer available.` });
  }, [isApiMode, isMockChainMode, message, notification, refreshFromApi, runChainTransaction, snapshot]);

  const acceptOffer = useCallback(async (offerId: string, collateralAmount: number) => {
    const { wallet, oraclePrices } = snapshot;
    const failAccept = (details: string): null => {
      message.error(details);
      if (isApiMode) throw new Error(details);
      return null;
    };

    if (!wallet.connected || !wallet.address) {
      return failAccept('Connect your wallet before borrowing.');
    }
    const walletAddress = wallet.address;

    const offer = snapshot.offers.find((item) => item.id === offerId);
    if (!offer || offer.status !== 'Active') {
      return failAccept('This offer is no longer available.');
    }
    if (offer.lender === walletAddress) {
      return failAccept('You cannot borrow from your own offer.');
    }
    if (collateralAmount <= 0) {
      return failAccept('Collateral amount must be greater than zero.');
    }
    const walletBalances = isApiMode && !isMockChainMode ? await fetchWalletBalances(walletAddress) : wallet;
    if (isApiMode && !isMockChainMode) {
      setSnapshot((prev) => {
        if (!prev.wallet.connected || prev.wallet.address !== walletAddress) return prev;
        return {
          ...prev,
          wallet: {
            ...prev.wallet,
            balanceXLM: walletBalances.balanceXLM,
            balanceUSDC: walletBalances.balanceUSDC,
          },
        };
      });
    }
    if (walletBalances.balanceXLM < collateralAmount) {
      return failAccept(
        `Insufficient XLM balance for collateral. Required ${collateralAmount.toLocaleString()} XLM, `
        + `available ${walletBalances.balanceXLM.toLocaleString()} XLM.`
      );
    }

    const prices = getPrices(oraclePrices);
    const preview = loansService.previewBorrow(offer, collateralAmount, prices);
    if (preview.healthFactor < offer.minHealthFactor) {
      return failAccept(`Initial Health Factor must be at least ${offer.minHealthFactor.toFixed(2)}.`);
    }

    if (isApiMode) {
      if (!isMockChainMode && offer.contractOfferId === undefined) {
        throw new Error('Offer is missing contractOfferId. It cannot be accepted on-chain.');
      }
      const contractOfferId = offer.contractOfferId ?? nextMockContractId();
      if (!isMockChainMode) {
        const onChainStatus = await marketplaceContract.getOfferStatus(contractOfferId, walletAddress);
        if (onChainStatus !== 'Active') {
          try {
            await offersApi.syncChain(offer.id, walletAddress);
          } catch (syncError) {
            console.error('Unable to sync stale offer state:', syncError);
          }
          await refreshFromApi().catch((refreshError) => {
            console.error('Unable to refresh after stale offer state:', refreshError);
          });
          return failAccept(
            `Offer is ${onChainStatus ?? 'unavailable'} on-chain and is no longer available. Choose another active offer.`
          );
        }
      }
      const mockContractLoanId = nextMockContractId();
      const txRes = await runChainTransaction(
        CONTRACTS.marketplace,
        'accept_offer',
        (onStage) => marketplaceContract.acceptOfferTx(contractOfferId, walletAddress, collateralAmount, walletAddress, onStage),
        mockContractLoanId.toString()
      );
      if (!txRes) {
        throw new Error(lastSorobanErrorRef.current ?? 'Accept offer transaction failed');
      }
      const extra = {
        ...txReceiptFromResult(txRes),
        contractLoanId: contractReturnId(txRes, 'contractLoanId'),
      };
      const loan = await loansApi.acceptOffer(offer.id, walletAddress, collateralAmount, extra);
      await refreshFromApi();
      notification.success({
        message: 'Offer accepted',
        description: 'Loan is PendingCollateral. Activate it to lock collateral and receive funds.',
      });
      return loan;
    }

    const loan = loansService.createFromOffer(offer, wallet.address, collateralAmount, prices);
    const transaction = transactionsService.create({
      type: 'ACCEPT_OFFER',
      user: wallet.address,
      amount: collateralAmount,
      asset: offer.collateralAsset,
      loanId: loan.id,
      offerId,
      details: `Accepted offer ${offerId}; loan ${loan.id} is PendingCollateral with ${collateralAmount.toLocaleString()} XLM planned collateral.`,
    });

    setSnapshot((prev) => ({
      ...prev,
      offers: prev.offers.map((item) => (item.id === offerId ? offersService.updateStatus(item, 'Matched', loan.id) : item)),
      loans: [loan, ...prev.loans],
      transactions: [transaction, ...prev.transactions],
    }));

    notification.success({
      message: 'Offer accepted',
      description: 'Activate the pending loan to lock collateral and receive funds.',
    });

    return loan;
  }, [isApiMode, isMockChainMode, message, notification, refreshFromApi, runChainTransaction, snapshot]);

  const activateLoan = useCallback(async (loanId: string) => {
    const walletAddress = snapshot.wallet.address;
    const failActivation = (details: string): null => {
      message.error(details);
      if (isApiMode) throw new Error(details);
      return null;
    };

    const loan = await getLatestLoanForAction(loanId);
    if (!loan) {
      return failActivation('Loan not found.');
    }
    if (loan.status !== 'PendingCollateral') {
      return failActivation('Only PendingCollateral loans can be activated.');
    }
    if (!walletAddress || walletAddress !== loan.borrower) {
      return failActivation('Only the borrower can activate this loan.');
    }
    const walletBalances = isApiMode && !isMockChainMode ? await fetchWalletBalances(walletAddress) : snapshot.wallet;
    if (isApiMode && !isMockChainMode) {
      setSnapshot((prev) => {
        if (!prev.wallet.connected || prev.wallet.address !== walletAddress) return prev;
        return {
          ...prev,
          wallet: {
            ...prev.wallet,
            balanceXLM: walletBalances.balanceXLM,
            balanceUSDC: walletBalances.balanceUSDC,
          },
        };
      });
    }
    if (walletBalances.balanceXLM < loan.collateralAmount) {
      return failActivation(
        `Insufficient XLM balance for collateral. Required ${loan.collateralAmount.toLocaleString()} XLM, `
        + `available ${walletBalances.balanceXLM.toLocaleString()} XLM.`
      );
    }
    const prices = getPrices(snapshot.oraclePrices);
    const previewLoan = loansService.activateLoan(loan, prices);
    if (previewLoan.healthFactor < (loan.minHealthFactor ?? 1.4)) {
      return failActivation(`Initial Health Factor must be at least ${(loan.minHealthFactor ?? 1.4).toFixed(2)}.`);
    }

    if (isApiMode) {
      if (!isMockChainMode && loan.contractLoanId === undefined) {
        throw new Error('Loan is missing contractLoanId. The accepted offer was not saved with its Soroban loan id, so it cannot be activated on-chain.');
      }
      const contractLoanId = loan.contractLoanId ?? nextMockContractId();
      if (!isMockChainMode) {
        const onChainStatus = await loanManagerContract.getLoanStatus(contractLoanId, walletAddress);
        if (onChainStatus !== 'PendingCollateral') {
          await refreshFromApi().catch((refreshError) => {
            console.error('Unable to refresh after stale loan state:', refreshError);
          });
          return failActivation(
            `Loan is ${onChainStatus ?? 'unavailable'} on-chain. Only PendingCollateral loans can be activated.`
          );
        }
      }

      if (!isMockChainMode && loan.asset === 'USDC') {
        let hasTrustline = false;
        try {
          hasTrustline = await hasUsdcTrustline(walletAddress);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Unable to verify USDC trustline before loan activation.');
        }

        if (!hasTrustline) {
          notification.info({
            message: 'USDC trustline required',
            description: 'Approve the Freighter transaction to add a USDC trustline before receiving the loan principal.',
          });
          const trustlineTx = await runSorobanTransaction((onStage) => createUsdcTrustline(walletAddress, onStage));
          if (!trustlineTx) {
            throw new Error(lastSorobanErrorRef.current ?? 'USDC trustline is required before loan activation.');
          }
        }
      }

      const txRes = await runChainTransaction(
        CONTRACTS.loanManager,
        'activate_loan',
        (onStage) => loanManagerContract.activateLoanTx(contractLoanId, walletAddress, onStage)
      );
      if (!txRes) {
        throw new Error(lastSorobanErrorRef.current ?? 'Activation transaction failed');
      }

      const activated = await loansApi.activate(loanId, walletAddress, {
        ...txReceiptFromResult(txRes),
        contractLoanId,
      });
      await refreshFromApi();
      notification.success({
        message: 'Loan activated',
        description: 'Collateral locked and loan asset transferred by Vault/Escrow.',
      });
      return activated;
    }

    const updatedLoan = previewLoan;
    const transaction = transactionsService.create({
      type: 'ACTIVATE_LOAN',
      user: loan.borrower,
      amount: loan.amount,
      asset: loan.asset,
      loanId,
      offerId: loan.offerId,
      details: `Activated loan ${loanId}; ${loan.collateralAmount.toLocaleString()} ${loan.collateralAsset} locked and ${loan.amount.toLocaleString()} ${loan.asset} released.`,
    });

    setSnapshot((prev) => ({
      ...prev,
      wallet: {
        ...prev.wallet,
        balanceXLM: prev.wallet.balanceXLM - loan.collateralAmount,
        balanceUSDC: prev.wallet.balanceUSDC + loan.amount,
      },
      loans: prev.loans.map((item) => (item.id === loanId ? updatedLoan : item)),
      transactions: [transaction, ...prev.transactions],
    }));

    notification.success({
      message: 'Loan activated',
      description: `Health Factor is ${updatedLoan.healthFactor.toFixed(2)}. Funds are now available after confirmation.`,
    });
    return updatedLoan;
  }, [getLatestLoanForAction, isApiMode, isMockChainMode, message, notification, refreshFromApi, runChainTransaction, runSorobanTransaction, snapshot]);

  const addCollateral = useCallback(async (loanId: string, amount: number) => {
    const walletAddress = snapshot.wallet.address;
    const loan = snapshot.loans.find((item) => item.id === loanId);
    if (!loan) {
      message.error('Loan not found.');
      return;
    }
    if (!walletAddress || walletAddress !== loan.borrower) {
      message.error('Only the borrower can add collateral.');
      return;
    }
    if (amount <= 0 || amount > snapshot.wallet.balanceXLM) {
      message.error('Invalid collateral amount.');
      return;
    }

    if (isApiMode) {
      if (!isMockChainMode && loan.contractLoanId === undefined) {
        throw new Error('Loan is missing contractLoanId. It cannot add collateral on-chain.');
      }
      const contractLoanId = loan.contractLoanId ?? nextMockContractId();
      const txRes = await runChainTransaction(
        CONTRACTS.loanManager,
        'add_collateral',
        (onStage) => loanManagerContract.addCollateralTx(contractLoanId, amount, walletAddress, onStage)
      );
      if (!txRes) return;

      await loansApi.action(loanId, 'ADD_COLLATERAL', walletAddress, amount, txReceiptFromResult(txRes));
      await refreshFromApi();
      notification.success({ message: 'Collateral added', description: 'Backend Health Factor has been recalculated.' });
      return;
    }

    const prices = getPrices(snapshot.oraclePrices);
    const updatedLoan = loansService.addCollateral(loan, amount, prices);
    const transaction = transactionsService.create({
      type: 'ADD_COLLATERAL',
      user: loan.borrower,
      amount,
      asset: loan.collateralAsset,
      loanId,
      details: `Added ${amount.toLocaleString()} ${loan.collateralAsset} to ${loanId}. HF ${loan.healthFactor.toFixed(2)} -> ${updatedLoan.healthFactor.toFixed(2)}.`,
    });

    setSnapshot((prev) => ({
      ...prev,
      wallet: {
        ...prev.wallet,
        balanceXLM: prev.wallet.balanceXLM - amount,
      },
      loans: prev.loans.map((item) => (item.id === loanId ? updatedLoan : item)),
      transactions: [transaction, ...prev.transactions],
    }));

    notification.success({ message: 'Collateral added', description: `Health Factor is now ${updatedLoan.healthFactor.toFixed(2)}.` });
  }, [isApiMode, isMockChainMode, message, notification, refreshFromApi, runChainTransaction, snapshot]);

  const repayLoan = useCallback(async (loanId: string, amount: number, isFullRepay: boolean): Promise<Loan | null> => {
    const walletAddress = snapshot.wallet.address;
    const loan = snapshot.loans.find((item) => item.id === loanId);
    if (!loan) {
      message.error('Loan not found.');
      return null;
    }
    if (!walletAddress || walletAddress !== loan.borrower) {
      message.error('Only the borrower can repay this loan.');
      return null;
    }
    const repayAmount = isFullRepay ? loan.outstandingDebt : amount;
    if (repayAmount <= 0 || repayAmount > loan.outstandingDebt + 0.01) {
      message.error('Invalid repayment amount.');
      return null;
    }
    if (snapshot.wallet.balanceUSDC < repayAmount) {
      message.error('Insufficient USDC balance.');
      return null;
    }

    if (isApiMode) {
      if (!isMockChainMode && loan.contractLoanId === undefined) {
        throw new Error('Loan is missing contractLoanId. It cannot be repaid on-chain.');
      }
      const contractLoanId = loan.contractLoanId ?? nextMockContractId();
      const functionName = isFullRepay ? 'full_repay' : 'partial_repay';
      const txRes = await runChainTransaction(
        CONTRACTS.loanManager,
        functionName,
        (onStage) => isFullRepay
          ? loanManagerContract.fullRepayTx(contractLoanId, walletAddress, onStage)
          : loanManagerContract.partialRepayTx(contractLoanId, repayAmount, walletAddress, onStage)
      );
      if (!txRes) return null;

      try {
        const updatedLoan = await loansApi.action(
          loanId,
          isFullRepay ? 'FULL_REPAY' : 'PARTIAL_REPAY',
          walletAddress,
          repayAmount,
          txReceiptFromResult(txRes)
        );
        await refreshFromApi();
        notification.success({
          message: isFullRepay ? 'Loan fully repaid' : 'Partial repayment complete',
          description: 'Repayment has been recorded and transferred to the lender wallet.',
        });
        return updatedLoan;
      } catch (error) {
        await refreshFromApi().catch((refreshError) => {
          console.error('Unable to refresh after repayment verification error:', refreshError);
        });
        const details = error instanceof Error ? error.message : 'Repayment verification failed.';
        message.error(details);
        throw error;
      }
    }

    const prices = getPrices(snapshot.oraclePrices);
    const updatedLoan = loansService.repay(loan, repayAmount, isFullRepay, prices);
    const transaction = transactionsService.create({
      type: isFullRepay ? 'FULL_REPAY' : 'PARTIAL_REPAY',
      user: loan.borrower,
      amount: repayAmount,
      asset: loan.asset,
      loanId,
      details: isFullRepay
        ? `Fully repaid ${loanId}; ${loan.collateralAmount.toLocaleString()} ${loan.collateralAsset} collateral released.`
        : `Partially repaid ${repayAmount.toLocaleString()} ${loan.asset} on ${loanId}. HF ${loan.healthFactor.toFixed(2)} -> ${updatedLoan.healthFactor.toFixed(2)}.`,
    });

    setSnapshot((prev) => ({
      ...prev,
      wallet: {
        ...prev.wallet,
        balanceUSDC: prev.wallet.balanceUSDC - repayAmount,
        balanceXLM: isFullRepay ? prev.wallet.balanceXLM + loan.collateralAmount : prev.wallet.balanceXLM,
      },
      loans: prev.loans.map((item) => (item.id === loanId ? updatedLoan : item)),
      transactions: [transaction, ...prev.transactions],
    }));

    notification.success({
      message: isFullRepay ? 'Loan fully repaid' : 'Partial repayment complete',
      description: isFullRepay ? 'Collateral has been released after confirmation.' : `Health Factor is now ${updatedLoan.healthFactor.toFixed(2)}.`,
    });
    return updatedLoan;
  }, [isApiMode, isMockChainMode, message, notification, refreshFromApi, runChainTransaction, snapshot]);

  const recalculateAllHealthFactors = useCallback(async (): Promise<OracleImpact[]> => {
    const walletAddress = snapshot.wallet.address;
    if (!snapshot.wallet.connected || !walletAddress) {
      message.error('Connect the admin wallet before recalculating loan health factors.');
      return [];
    }
    if (!isAdminWallet(walletAddress)) {
      message.error(`This action is restricted to the admin wallet: ${ADMIN_WALLET_ADDRESS}.`);
      return [];
    }

    if (isApiMode) {
      const previousLoans = snapshot.loans;
      await oracleApi.recalculateHealth();
      const nextSnapshot = await refreshFromApi();
      return buildOracleImpacts(previousLoans, nextSnapshot.loans);
    }

    const prices = getPrices(snapshot.oraclePrices);
    const impacts: OracleImpact[] = [];
    const recalculated = snapshot.loans.map((loan) => {
      if (!isOpenLoanStatus(loan.status)) return loan;
      const updated = loansService.recalculate(loan, prices);
      if (updated.healthFactor !== loan.healthFactor || updated.status !== loan.status) {
        impacts.push({
          loanId: loan.id,
          oldHF: loan.healthFactor,
          newHF: updated.healthFactor,
          oldStatus: loan.status,
          newStatus: updated.status,
        });
      }
      return updated;
    });

    setSnapshot((prev) => ({
      ...prev,
      loans: recalculated,
    }));

    return impacts;
  }, [isApiMode, message, refreshFromApi, snapshot]);

  const updateOraclePrice = useCallback(async (newPrice: number): Promise<OracleImpact[]> => {
    if (newPrice <= 0) {
      message.error('Oracle price must be greater than zero.');
      return [];
    }
    const walletAddress = snapshot.wallet.address;
    if (!snapshot.wallet.connected || !walletAddress) {
      message.error('Connect the oracle admin wallet before updating prices.');
      return [];
    }
    if (!isAdminWallet(walletAddress)) {
      message.error(`Oracle updates are restricted to the admin wallet: ${ADMIN_WALLET_ADDRESS}.`);
      return [];
    }

    if (isApiMode) {
      const previousLoans = snapshot.loans;
      const txRes = await runChainTransaction(
        CONTRACTS.oracle,
        'update_price',
        (onStage) => oracleContract.updateOraclePriceTx(
          'XLM/USDC',
          'XLM',
          'USDC',
          newPrice,
          7,
          'Nexus Oracle Update',
          walletAddress,
          onStage
        )
      );
      if (!txRes) return [];

      await oracleApi.updateXlmPrice(newPrice, walletAddress, txReceiptFromResult(txRes));
      const nextSnapshot = await refreshFromApi();
      const impacts = buildOracleImpacts(previousLoans, nextSnapshot.loans);
      const liquidatableCount = nextSnapshot.loans.filter((loan) => isLiquidatable(loan.healthFactor, loan.status)).length;
      notification.success({
        message: 'Oracle price updated',
        description: `${impacts.length} loans recalculated. ${liquidatableCount} loans are now liquidatable.`,
      });
      return impacts;
    }

    const nextOraclePrices = oracleService.updateXlmPrice(snapshot.oraclePrices, newPrice);
    const prices = getPrices(nextOraclePrices);
    const impacts: OracleImpact[] = [];
    const nextLoans = snapshot.loans.map((loan) => {
      if (!isOpenLoanStatus(loan.status)) return loan;
      const updated = loansService.recalculate(loan, prices);
      impacts.push({
        loanId: loan.id,
        oldHF: loan.healthFactor,
        newHF: updated.healthFactor,
        oldStatus: loan.status,
        newStatus: updated.status,
      });
      return updated;
    });

    const user = walletAddress;
    const transaction = transactionsService.create({
      type: 'UPDATE_ORACLE',
      user,
      amount: newPrice,
      asset: 'XLM',
      details: `Updated XLM/USDC oracle price to $${newPrice.toFixed(4)} and recalculated ${impacts.length} open loans.`,
    });

    setSnapshot((prev) => ({
      ...prev,
      oraclePrices: nextOraclePrices,
      loans: nextLoans,
      transactions: [transaction, ...prev.transactions],
    }));

    const liquidatableCount = nextLoans.filter((loan) => isLiquidatable(loan.healthFactor, loan.status)).length;
    notification.success({
      message: 'Oracle price updated',
      description: `${impacts.length} loans recalculated. ${liquidatableCount} loans are now liquidatable.`,
    });

    return impacts;
  }, [isApiMode, message, notification, refreshFromApi, runChainTransaction, snapshot]);

  const liquidateLoan = useCallback(async (loanId: string, repayAmount: number) => {
    const walletAddress = snapshot.wallet.address;
    const loan = snapshot.loans.find((item) => item.id === loanId);
    if (!loan) {
      message.error('Loan not found.');
      return;
    }
    if (!snapshot.wallet.connected || !walletAddress) {
      message.error('Connect as a liquidator before liquidation.');
      return;
    }
    if (!isLiquidatable(loan.healthFactor, loan.status)) {
      message.error('Loan is not eligible for liquidation.');
      return;
    }
    const { xlmPrice } = getPrices(snapshot.oraclePrices);
    const maxRepayAmount = calculateMaxLiquidationRepay(
      loan.outstandingDebt,
      loan.collateralAmount,
      xlmPrice,
      loan.liquidationBonus
    );
    if (repayAmount <= 0 || repayAmount > maxRepayAmount + 0.01) {
      message.error(`Repay amount must be between 0 and ${maxRepayAmount.toFixed(2)} USDC.`);
      return;
    }
    if (snapshot.wallet.balanceUSDC < repayAmount) {
      message.error('Insufficient USDC balance to liquidate.');
      return;
    }

    if (isApiMode) {
      if (!isMockChainMode && loan.contractLoanId === undefined) {
        throw new Error('Loan is missing contractLoanId. It cannot be liquidated on-chain.');
      }
      const contractLoanId = loan.contractLoanId ?? nextMockContractId();
      if (!isMockChainMode && loan.status === 'Defaulted') {
        notification.info({
          message: 'Marking loan defaulted on-chain',
          description: 'Approve the first Freighter transaction to sync the 7-day grace-period default before liquidation.',
        });
        const defaultTxRes = await runChainTransaction(
          CONTRACTS.loanManager,
          'mark_defaulted',
          (onStage) => loanManagerContract.markDefaultedTx(contractLoanId, walletAddress, onStage)
        );
        if (!defaultTxRes) return;
      }
      const txRes = await runChainTransaction(
        CONTRACTS.loanManager,
        'liquidate',
        (onStage) => loanManagerContract.liquidateTx(contractLoanId, walletAddress, repayAmount, walletAddress, onStage)
      );
      if (!txRes) return;

      await loansApi.action(loanId, 'LIQUIDATE', walletAddress, repayAmount, txReceiptFromResult(txRes));
      await refreshFromApi();
      notification.success({
        message: 'Liquidation executed',
        description: 'Backend loan state has been updated.',
      });
      return;
    }

    const prices = getPrices(snapshot.oraclePrices);
    const result = loansService.liquidate(loan, repayAmount, prices);
    const transaction = transactionsService.create({
      type: 'LIQUIDATE',
      user: walletAddress,
      amount: repayAmount,
      asset: loan.asset,
      loanId,
      details: `Liquidated ${repayAmount.toFixed(2)} ${loan.asset} on ${loanId}; received ${result.collateralReceived.toFixed(2)} ${loan.collateralAsset}.`,
    });

    setSnapshot((prev) => ({
      ...prev,
      wallet: {
        ...prev.wallet,
        balanceUSDC: prev.wallet.balanceUSDC - repayAmount,
        balanceXLM: prev.wallet.balanceXLM + result.collateralReceived,
      },
      loans: prev.loans.map((item) => (item.id === loanId ? result.loan : item)),
      transactions: [transaction, ...prev.transactions],
    }));

    notification.success({
      message: 'Liquidation executed',
      description: `Received ${result.collateralReceived.toFixed(2)} ${loan.collateralAsset} collateral after confirmation.`,
    });
  }, [isApiMode, isMockChainMode, message, notification, refreshFromApi, runChainTransaction, snapshot]);

  const swapTokens = useCallback(async (
    direction: SwapDirection,
    receiveAmount: number,
    maxSendAmount: number
  ) => {
    const { wallet } = snapshot;
    if (!wallet.connected || !wallet.address) {
      message.error('Connect your wallet first.');
      return false;
    }
    if (receiveAmount <= 0 || maxSendAmount <= 0) {
      message.error('Enter a valid swap amount.');
      return false;
    }

    const walletAddress = wallet.address;
    const sendAsset = direction === 'XLM_TO_USDC' ? 'XLM' : 'USDC';
    const receiveAsset = direction === 'XLM_TO_USDC' ? 'USDC' : 'XLM';
    const sendBalance = direction === 'XLM_TO_USDC' ? wallet.balanceXLM : wallet.balanceUSDC;

    if (sendBalance < maxSendAmount) {
      message.error(`Insufficient ${sendAsset} balance for this swap.`);
      return false;
    }

    if (isApiMode) {
      const txRes = await runSorobanTransaction((onStage) =>
        swapStellarAssets(walletAddress, direction, receiveAmount, maxSendAmount, onStage)
      );
      if (!txRes) return false;
      await refreshFromApi();
      notification.success({
        message: 'Swap completed',
        description: `Successfully received ${receiveAmount.toLocaleString()} ${receiveAsset}.`,
      });
      return true;
    }

    const { xlmPrice } = getPrices(snapshot.oraclePrices);
    const estimatedSendAmount = direction === 'XLM_TO_USDC'
      ? receiveAmount / xlmPrice
      : receiveAmount * xlmPrice;
    const debitedAmount = Math.min(maxSendAmount, estimatedSendAmount);

    setSnapshot((prev) => ({
      ...prev,
      wallet: {
        ...prev.wallet,
        balanceXLM: direction === 'XLM_TO_USDC'
          ? prev.wallet.balanceXLM - debitedAmount
          : prev.wallet.balanceXLM + receiveAmount,
        balanceUSDC: direction === 'XLM_TO_USDC'
          ? prev.wallet.balanceUSDC + receiveAmount
          : prev.wallet.balanceUSDC - debitedAmount,
      }
    }));
    notification.success({
      message: 'Swap completed (Mock)',
      description: `Successfully received ${receiveAmount.toLocaleString()} mock ${receiveAsset}.`,
    });
    return true;
  }, [isApiMode, message, notification, refreshFromApi, runSorobanTransaction, snapshot]);



  const value = useMemo<LendingContextValue>(
    () => ({
      wallet: snapshot.wallet,
      currentUserWallet: snapshot.wallet.address,
      offers: snapshot.offers,
      loanOffers: snapshot.offers,
      loans: snapshot.loans,
      oraclePrices: snapshot.oraclePrices,
      transactions: snapshot.transactions,
      activities: snapshot.transactions,
      connectWallet,
      disconnectWallet,
      createOffer,
      createLoanOffer: async (offer) => {
        await createOffer(offer);
      },
      fundOffer,
      activateOffer,
      cancelOffer,
      acceptOffer,
      activateLoan,
      borrowLoan: async (offerId, collateralAmount) => {
        await acceptOffer(offerId, collateralAmount);
      },
      addCollateral,
      partialRepay: async (loanId, amount) => {
        await repayLoan(loanId, amount, false);
      },
      fullRepay: async (loanId) => {
        await repayLoan(loanId, 0, true);
      },
      repayLoan,
      updateOraclePrice,
      recalculateAllHealthFactors,
      liquidateLoan,
      addTransaction: pushTransaction,
      swapTokens,
      refreshData,
    }),
    [
      acceptOffer,
      activateLoan,
      activateOffer,
      addCollateral,
      cancelOffer,
      connectWallet,
      createOffer,
      disconnectWallet,
      liquidateLoan,
      fundOffer,
      pushTransaction,
      refreshData,
      recalculateAllHealthFactors,
      repayLoan,
      snapshot,
      updateOraclePrice,
      swapTokens,
    ]
  );

  return <LendingContext.Provider value={value}>{children}</LendingContext.Provider>;
};

// oxlint-disable-next-line react/only-export-components
export const useLending = (): LendingContextValue => {
  const context = useContext(LendingContext);
  if (!context) {
    throw new Error('useLending must be used within a LendingProvider');
  }
  return context;
};
